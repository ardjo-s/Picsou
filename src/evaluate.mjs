import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scoreDocument } from "../scripts/score.mjs";
import { annotatePackStats, packContext } from "./context.mjs";
import { estimateCost, rankResults } from "./score-lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODEL_TIMEOUT_MS = 120_000;

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

function extractJson(text) {
  const trimmed = String(text || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate);
}

export function createOpenAICompatibleProvider({
  baseUrl,
  apiKey,
  fetchImpl = fetch,
}) {
  const root = baseUrl.replace(/\/$/, "");
  const headers = {
    Authorization: `Bearer ${apiKey || "EMPTY"}`,
    "Content-Type": "application/json",
  };

  return {
    providerName: "openai-compatible",
    async accessibleModels() {
      const response = await fetchImpl(`${root}/models`, {
        headers,
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error(`Model discovery failed (${response.status}).`);
      }
      const body = await response.json();
      return new Set((body.data || []).map((item) => item.id));
    },
    async run(model, pack) {
      const response = await fetchImpl(`${root}/chat/completions`, {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
        body: JSON.stringify({
          model: model.id,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: pack.system },
            { role: "user", content: pack.user },
          ],
        }),
      });
      if (!response.ok) {
        throw new Error(`Provider returned ${response.status}.`);
      }
      const body = await response.json();
      const content = body.choices?.[0]?.message?.content;
      const usage = body.usage
        ? {
            input_tokens: body.usage.prompt_tokens,
            output_tokens: body.usage.completion_tokens,
            input_tokens_details: {
              cached_tokens: body.usage.prompt_tokens_details?.cached_tokens || 0,
            },
          }
        : null;
      return { output: extractJson(content), usage };
    },
  };
}

async function fixtureRun(model, perfect) {
  const latency =
    model.role === "slm_under_test" || model.id.includes("e4b") ? 1800 : 5200;
  const usage =
    model.id.includes("e4b")
      ? { input_tokens: 2400, output_tokens: 900, input_tokens_details: { cached_tokens: 200 } }
      : { input_tokens: 2400, output_tokens: 900, input_tokens_details: { cached_tokens: 100 } };
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
  let accessible = new Set(candidates.map((item) => item.id));
  let skipped = [];

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
    });
    try {
      accessible = await provider.accessibleModels();
    } catch (error) {
      throw new Error(`Model discovery failed: ${error.message}`);
    }
    skipped = candidates
      .filter((model) => !accessible.has(model.id))
      .map((model) => ({
        model: model.id,
        reason: "Not accessible through this OpenAI-compatible endpoint.",
      }));
  }

  const runnable = fixture
    ? candidates
    : candidates.filter((model) => accessible.has(model.id));

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
      results.push({
        model: model.id,
        role: model.role,
        status: "completed",
        latency_ms,
        usage: response.usage,
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

  const recommendation_text = winner
    ? `Recommend ${winner.model}. Quality ${winner.score.quality_score.toFixed(3)}, estimated cost $${winner.estimated_cost_usd.toFixed(6)}, latency ${winner.latency_ms} ms. Tested: ${tested}. Skipped: ${skippedText}. Failed: ${failedText}. Confidence: demo-low (${workflow.cases.cases.length} frozen cases, one trial).`
    : `No model met the recommendation gate. Tested: ${tested}. Skipped: ${skippedText}. Failed: ${failedText}.`;

  return {
    report_version: "1.0.0",
    generated_at: new Date().toISOString(),
    mode: fixture ? "fixture" : "live",
    track: "Context Engineering for SLMs",
    gemma_core: "gemma-4-e4b-it",
    context_pack_stats: pack.stats,
    provider: fixture ? "fixture" : provider.providerName,
    workflow: {
      benchmark_id: workflow.benchmark.benchmark_id,
      workflow_version: workflow.benchmark.workflow_version,
      case_count: workflow.cases.cases.length,
    },
    recommendation_text,
    recommendation: winner
      ? {
          model: winner.model,
          confidence: "demo-low",
          quality_score: winner.score.quality_score,
          estimated_cost_usd: winner.estimated_cost_usd,
          latency_ms: winner.latency_ms,
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
