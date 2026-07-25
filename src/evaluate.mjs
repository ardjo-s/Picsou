import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scoreDocument } from "../scripts/score.mjs";
import { annotatePackStats, packContext } from "./context.mjs";
import { candidateApiId, matchAccessibleId } from "./model-ids.mjs";
import {
  createOpenAICompatibleProvider,
  normalizeOutput,
} from "./providers.mjs";
import {
  estimateCost,
  rankResults,
  summarizeTokens,
} from "./score-lib.mjs";

export { normalizeOutput };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(ROOT, relativePath), "utf8"));
}

async function loadWorkflow() {
  const [
    benchmark,
    cases,
    truth,
    schema,
    models,
    pricing,
    prompt,
  ] = await Promise.all([
    readJson("workflow/benchmark.json"),
    readJson("workflow/cases.json"),
    readJson("workflow/ground-truth.json"),
    readJson("workflow/output.schema.json"),
    readJson("config/models.json"),
    readJson("config/model-pricing.json"),
    fs.readFile(path.join(ROOT, "workflow/prompt.md"), "utf8"),
  ]);
  return { benchmark, cases, truth, schema, models, pricing, prompt };
}

async function fixtureRun(model, perfect) {
  const isSlm = model.role === "slm_under_test";
  const latency = isSlm ? 1800 : 5200;
  const usage = {
    input_tokens: 2400,
    output_tokens: isSlm ? 900 : 900,
    input_tokens_details: { cached_tokens: isSlm ? 200 : 100 },
  };
  return {
    output: structuredClone(perfect),
    usage,
    latency_ms: latency,
  };
}

export async function evaluate({ fixture = false, fetchImpl = fetch } = {}) {
  const workflow = await loadWorkflow();
  const pack = annotatePackStats(packContext(workflow.cases, workflow.prompt));
  const perfect = await readJson("examples/perfect-output.json");
  const candidates = workflow.models.demo_candidates;

  let provider = null;
  let skipped = [];
  let runnable = candidates.map((model) => ({
    ...model,
    resolved_id: candidateApiId(model),
  }));

  if (!fixture) {
    const baseUrl = process.env.OPENAI_BASE_URL;
    if (!baseUrl) {
      throw new Error(
        "OPENAI_BASE_URL is required for live evaluation. Use --fixture for offline demo.",
      );
    }
    provider = createOpenAICompatibleProvider({
      baseUrl,
      apiKey: process.env.OPENAI_API_KEY || "EMPTY",
      fetchImpl,
      providerName: "brev-sglang",
    });
    let accessible;
    try {
      accessible = await provider.accessibleModels();
    } catch (error) {
      throw new Error(`Model discovery failed: ${error.message}`);
    }

    const resolved = [];
    for (const model of runnable) {
      // Classic evaluate path stays on a single OpenAI-compatible endpoint.
      if (model.role === "external_control") {
        skipped.push({
          model: model.id,
          api_id: model.resolved_id,
          reason: "Use --matrix for Grok via xAI; classic evaluate is Brev/SGLang only.",
        });
        continue;
      }
      const matched = matchAccessibleId(model.resolved_id, accessible);
      if (!matched) {
        skipped.push({
          model: model.id,
          api_id: model.resolved_id,
          reason: "Not accessible through this OpenAI-compatible endpoint.",
          accessible: [...accessible],
        });
        continue;
      }
      resolved.push({ ...model, resolved_id: matched });
    }
    runnable = resolved;
  }

  const results = [];
  for (const model of runnable) {
    const started = Date.now();
    try {
      const response = fixture
        ? await fixtureRun(model, perfect)
        : await provider.run(model, pack);
      const latency_ms = response.latency_ms ?? Math.max(1, Date.now() - started);
      const score = await scoreDocument(response.output);
      const price = workflow.pricing.models[model.id];
      const tokens = summarizeTokens(response.usage);
      results.push({
        model: model.id,
        role: model.role,
        status: "completed",
        latency_ms,
        usage: response.usage,
        tokens,
        estimated_cost_usd: estimateCost(response.usage, price),
        pricing_verified_at: price ? workflow.pricing.verified_at : null,
        score,
      });
    } catch (error) {
      results.push({
        model: model.id,
        role: model.role,
        status: "failed",
        latency_ms: Math.max(1, Date.now() - started),
        error: String(error.message || error),
      });
    }
  }

  const ranking = rankResults(results, workflow);
  const winner = ranking.find((item) => item.eligible);
  const failed = results.filter((item) => item.status === "failed");
  const tested = ranking.map((item) => item.model).join(", ") || "none";
  const skippedText = skipped.map((item) => item.model).join(", ") || "none";
  const failedText = failed.map((item) => item.model).join(", ") || "none";

  const winnerTokens = winner ? summarizeTokens(winner.usage) : null;
  const recommendation_text = winner
    ? `Recommend ${winner.model}. Quality ${winner.score.quality_score.toFixed(3)}, tokens ${winnerTokens.total_tokens} (in ${winnerTokens.input_tokens}/out ${winnerTokens.output_tokens}), estimated cost $${winner.estimated_cost_usd.toFixed(6)}, latency ${winner.latency_ms} ms. Tested: ${tested}. Skipped: ${skippedText}. Failed: ${failedText}. Confidence: demo-low (${workflow.cases.cases.length} frozen cases, one trial).`
    : `No model met the recommendation gate. Tested: ${tested}. Skipped: ${skippedText}. Failed: ${failedText}.`;

  return {
    report_version: "1.0.0",
    generated_at: new Date().toISOString(),
    mode: fixture ? "fixture" : "live",
    track: "Context Engineering for SLMs",
    gemma_core:
      process.env.PICSOU_GEMMA_E2B_MODEL ||
      process.env.PICSOU_GEMMA_E4B_MODEL ||
      "google/gemma-4-E2B-it",
    context_pack_stats: pack.stats,
    provider: fixture ? "fixture" : provider.providerName,
    workflow: {
      benchmark_id: workflow.benchmark.benchmark_id,
      workflow_version: workflow.benchmark.workflow_version,
      case_count: workflow.cases.cases.length,
    },
    tokens: winnerTokens,
    recommendation_text,
    recommendation: winner
      ? {
          model: winner.model,
          confidence: "demo-low",
          quality_score: winner.score.quality_score,
          estimated_cost_usd: winner.estimated_cost_usd,
          latency_ms: winner.latency_ms,
          tokens: winnerTokens,
        }
      : null,
    ranking,
    skipped_models: skipped,
    failed_models: failed,
    limitations: [
      "Frozen OpenAIRE-style demo corpus; not live discovery.",
      "One trial per model; variance not measured.",
      "Pricing rows are planning estimates unless replaced with billed usage.",
    ],
  };
}
