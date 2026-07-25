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
import {
  deriveConfidence,
  qualityFormulaFromBenchmark,
  scoreMetricsFromResult,
} from "./calibration.mjs";

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

export async function evaluate({
  fixture = false,
  fetchImpl = fetch,
  trials = 1,
  keepTrials = false,
} = {}) {
  const requestedTrials = Math.max(1, Number(trials) || 1);
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
    const trialRuns = [];
    for (let trialIndex = 0; trialIndex < requestedTrials; trialIndex += 1) {
      const started = Date.now();
      try {
        const response = fixture
          ? await fixtureRun(model, perfect)
          : await provider.run(model, pack);
        const latency_ms =
          response.latency_ms ?? Math.max(1, Date.now() - started);
        const score = await scoreDocument(response.output);
        const price = workflow.pricing.models[model.id];
        const tokens = summarizeTokens(response.usage);
        trialRuns.push({
          model: model.id,
          role: model.role,
          status: "completed",
          trial_index: trialIndex,
          latency_ms: latency_ms + trialIndex * (fixture ? 3 : 0),
          usage: response.usage,
          tokens,
          estimated_cost_usd: estimateCost(response.usage, price),
          pricing_verified_at: price ? workflow.pricing.verified_at : null,
          score,
        });
      } catch (error) {
        trialRuns.push({
          model: model.id,
          role: model.role,
          status: "failed",
          trial_index: trialIndex,
          latency_ms: Math.max(1, Date.now() - started),
          error: String(error.message || error),
        });
      }
    }
    const completed = trialRuns.filter((item) => item.status === "completed");
    if (!completed.length) {
      results.push({ ...trialRuns[0], trials: { requested: requestedTrials, completed: 0 } });
      continue;
    }
    const last = completed[completed.length - 1];
    const qualities = completed.map((item) => item.score.quality_score);
    const meanQuality =
      qualities.reduce((sum, value) => sum + value, 0) / qualities.length;
    const entry = {
      ...last,
      score: { ...last.score, quality_score: Number(meanQuality.toFixed(12)) },
      trials: {
        requested: requestedTrials,
        completed: completed.length,
        quality_score: {
          mean: Number(meanQuality.toFixed(6)),
          min: Math.min(...qualities),
          max: Math.max(...qualities),
        },
      },
    };
    if (keepTrials) entry.trial_runs = trialRuns;
    results.push(entry);
  }

  const ranking = rankResults(results, workflow);
  const winner = ranking.find((item) => item.eligible);
  const failed = results.filter((item) => item.status === "failed");
  const tested = ranking.map((item) => item.model).join(", ") || "none";
  const skippedText = skipped.map((item) => item.model).join(", ") || "none";
  const failedText = failed.map((item) => item.model).join(", ") || "none";

  const winnerTokens = winner ? summarizeTokens(winner.usage) : null;
  const winnerQualityStdev = winner?.trials?.quality_score?.stdev;
  const confidence = deriveConfidence({
    fixture,
    trialsRequested: requestedTrials,
    winnerQualityStdev,
    allCellsCompleted: failed.length === 0,
  });
  const perfectScore = await scoreDocument(perfect);
  const calibration = {
    oracle: {
      source: "perfect-output",
      quality_score: perfectScore.quality_score,
      schema_valid: perfectScore.schema_valid,
      metrics: scoreMetricsFromResult(perfectScore),
      meaning:
        "Theoretical ceiling: perfect triage + exact evidence on frozen workflow ground truth.",
    },
    reference_model: null,
    quality_formula: qualityFormulaFromBenchmark(workflow.benchmark),
    worked_examples: [
      { label: "oracle", quality_score: 1.0, note: "examples/perfect-output.json" },
      {
        label: "typical_failure",
        quality_score: 0.47,
        note: "Illustrative: good citations, wrong priorities.",
      },
    ],
  };
  const referenceModelId =
    workflow.models.demo_candidates.find((item) => item.role === "reference_ceiling")
      ?.id ||
    workflow.models.demo_candidates.find((item) => item.role === "larger_baseline")
      ?.id;
  if (referenceModelId) {
    const refResult = ranking.find((item) => item.model === referenceModelId);
    calibration.reference_model = {
      model_id: referenceModelId,
      role: "reference_ceiling",
      best_cell: refResult
        ? {
            quality_score: refResult.score.quality_score,
            metrics: scoreMetricsFromResult(refResult.score),
            tokens: refResult.tokens ?? null,
          }
        : null,
      meaning: "Best completed classic-eval cell for the reference model.",
    };
  }
  const recommendation_text = winner
    ? `Recommend ${winner.model}. Quality ${winner.score.quality_score.toFixed(3)}, tokens ${winnerTokens.total_tokens} (in ${winnerTokens.input_tokens}/out ${winnerTokens.output_tokens}), estimated cost $${winner.estimated_cost_usd.toFixed(6)}, latency ${winner.latency_ms} ms. Tested: ${tested}. Skipped: ${skippedText}. Failed: ${failedText}. Confidence: ${confidence} (${workflow.cases.cases.length} frozen cases, ${requestedTrials} trial(s)).`
    : `No model met the recommendation gate. Tested: ${tested}. Skipped: ${skippedText}. Failed: ${failedText}.`;

  const report = {
    report_version: "1.1.0",
    generated_at: new Date().toISOString(),
    mode: fixture ? "fixture" : "live",
    track: "Context Engineering for SLMs",
    gemma_core:
      process.env.PICSOU_GEMMA_E2B_MODEL ||
      process.env.PICSOU_GEMMA_E4B_MODEL ||
      "google/gemma-4-E2B-it",
    context_pack_stats: pack.stats,
    provider: fixture ? "fixture" : provider.providerName,
    trials: { requested: requestedTrials, keep_trial_runs: keepTrials },
    workflow: {
      benchmark_id: workflow.benchmark.benchmark_id,
      workflow_version: workflow.benchmark.workflow_version,
      case_count: workflow.cases.cases.length,
    },
    tokens: winnerTokens,
    calibration,
    recommendation_text,
    recommendation: winner
      ? {
          model: winner.model,
          confidence,
          quality_score: winner.score.quality_score,
          estimated_cost_usd: winner.estimated_cost_usd,
          latency_ms: winner.latency_ms,
          tokens: winnerTokens,
          trials: winner.trials ?? null,
        }
      : null,
    ranking,
    skipped_models: skipped,
    failed_models: failed,
    limitations: [
      "Frozen OpenAIRE-style demo corpus; not live discovery.",
      requestedTrials < 2
        ? "One trial per model; use --trials to measure variance."
        : fixture
          ? "Fixture trials use deterministic timing jitter; confidence stays demo-low until live repeats."
          : "Live trials at temperature 0; residual variance is timing/usage unless the provider is non-deterministic.",
      "Pricing rows are planning estimates unless replaced with billed usage.",
    ],
  };
  const refScore = calibration.reference_model?.best_cell?.quality_score;
  report.calibration_summary = winner
    ? `Calibration: oracle=${Number(perfectScore.quality_score).toFixed(3)} | reference=${referenceModelId || "n/a"} ${refScore == null ? "n/a" : Number(refScore).toFixed(3)} | winner=${winner.model} ${winner.score.quality_score.toFixed(3)} (confidence=${confidence}, trials=${requestedTrials})`
    : `Calibration: oracle=${Number(perfectScore.quality_score).toFixed(3)} | winner=none (trials=${requestedTrials})`;
  return report;
}
