import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scoreDocument } from "../scripts/score.mjs";
import { annotatePackStats, packContext } from "./context.mjs";
import { createLiveProviderRouter } from "./providers.mjs";
import {
  aggregateTokens,
  aggregateTrialRuns,
  estimateCost,
  rankResults,
  summarizeTokens,
} from "./score-lib.mjs";
import {
  buildScenarioCalibration,
  deriveConfidence,
  formatCalibrationSummary,
  scorePerfectForScenario,
} from "./calibration.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(ROOT, relativePath), "utf8"));
}

function scenarioDir(scenarioId) {
  return path.join("scenarios", scenarioId);
}

function alignOutputUrls(output, casesDocument) {
  const urlBySource = new Map();
  for (const item of casesDocument.cases) {
    for (const source of item.sources) {
      urlBySource.set(source.source_id, source.url);
    }
  }
  const aligned = structuredClone(output);
  for (const result of aligned.results) {
    for (const signal of result.signals || []) {
      if (urlBySource.has(signal.source_id)) {
        signal.source_url = urlBySource.get(signal.source_id);
      }
    }
  }
  return aligned;
}

/** Apply fixture mutation ops like set_high:case_id onto a perfect output. */
function applyFixtureMutations(perfect, mutations = []) {
  const output = structuredClone(perfect);
  for (const op of mutations) {
    const [action, caseId] = String(op).split(":");
    const row = output.results.find((item) => item.case_id === caseId);
    if (!row) continue;
    if (action === "set_high") {
      row.attention_fit = true;
      row.priority = "high";
    } else if (action === "set_medium") {
      row.attention_fit = true;
      row.priority = "medium";
    } else if (action === "set_skip") {
      row.attention_fit = false;
      row.priority = "skip";
      row.signals = [];
    }
  }
  return output;
}

/** Map model.role to fixture-behavior.json mutation keys. */
function fixtureBehaviorRoleKey(role) {
  if (role === "reference_ceiling") return "external_control";
  return role || "slm_under_test";
}

function hashString(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic extra fixture mutations so repeated trials vary. */
function fixtureTrialExtraMutations(scenarioId, model, alien, trialIndex, casesDocument) {
  if (trialIndex === 0) return [];
  const caseIds = casesDocument.cases.map((item) => item.case_id);
  if (!caseIds.length) return [];
  const key = `${scenarioId}:${model.id}:${alien}:${trialIndex}`;
  const h = hashString(key);
  const target = caseIds[h % caseIds.length];
  const mod = trialIndex % 3;
  if (mod === 0) return [`set_skip:${target}`];
  if (mod === 1) return [`set_medium:${target}`];
  return [`set_high:${target}`];
}

function finalizeCellFromTrials(trialRuns, keepTrials) {
  const template = trialRuns[0];
  const stats = aggregateTrialRuns(trialRuns, { requested: trialRuns.length });
  const completed = trialRuns.filter((run) => run.status === "completed");
  if (!completed.length) {
    return { ...template, trials: stats };
  }
  const representative = { ...completed[completed.length - 1] };
  if (stats.quality_score?.mean != null) {
    representative.score = {
      ...representative.score,
      quality_score: stats.quality_score.mean,
    };
  }
  if (stats.latency_ms?.mean != null) {
    representative.latency_ms = Math.round(stats.latency_ms.mean);
  }
  if (stats.tokens?.total_tokens?.mean != null) {
    representative.tokens = {
      ...representative.tokens,
      input_tokens:
        stats.tokens.input_tokens?.mean != null
          ? Math.round(stats.tokens.input_tokens.mean)
          : representative.tokens?.input_tokens,
      output_tokens:
        stats.tokens.output_tokens?.mean != null
          ? Math.round(stats.tokens.output_tokens.mean)
          : representative.tokens?.output_tokens,
      cached_tokens: representative.tokens?.cached_tokens ?? 0,
      total_tokens: Math.round(stats.tokens.total_tokens.mean),
    };
  }
  representative.trials = stats;
  if (keepTrials) representative.trial_runs = trialRuns;
  return representative;
}

async function loadFixtureBehavior(scenarioId) {
  try {
    return await readJson(`${scenarioDir(scenarioId)}/fixture-behavior.json`);
  } catch {
    return null;
  }
}

function fixtureLatency(model, alien) {
  const base = model.id.includes("e2b") || model.id.includes("e4b")
    ? 900
    : model.id.includes("deepseek")
      ? 1100
      : 1400;
  return base + (alien ? 80 : 0);
}

/** Fixture tokens scale with packed workflow size so scenarios differ. */
function fixtureUsage(model, packStats, alien) {
  const approxChars = packStats?.approx_chars || 4000;
  const baseInput = Math.max(800, Math.round(approxChars / 3.5));
  const alienBonus = alien ? Math.round(baseInput * 0.04) : 0;
  let output_tokens = 900;
  let cached_ratio = 0.08;
  if (model.id.includes("e2b") || model.id.includes("e4b")) {
    output_tokens = 820;
    cached_ratio = 0.1;
  } else if (model.id.includes("deepseek") || model.id.includes("grok")) {
    output_tokens = 780;
    cached_ratio = 0.06;
  } else {
    output_tokens = 880;
    cached_ratio = 0.05;
  }
  const input_tokens = baseInput + alienBonus;
  return {
    input_tokens,
    output_tokens,
    input_tokens_details: {
      cached_tokens: Math.round(input_tokens * cached_ratio),
    },
  };
}

async function loadScenario(scenarioId, alien) {
  const base = scenarioDir(scenarioId);
  const casesPath = alien ? `${base}/cases.alien.json` : `${base}/cases.json`;
  const [cases, perfect, prompt] = await Promise.all([
    readJson(casesPath),
    readJson(`${base}/perfect-output.json`),
    fs.readFile(path.join(ROOT, base, "prompt.md"), "utf8"),
  ]);
  return {
    casesPath,
    truthPath: `${base}/ground-truth.json`,
    cases,
    perfect,
    prompt,
  };
}

async function runCell({
  scenarioId,
  model,
  alien,
  fixture,
  router,
  trialIndex = 0,
}) {
  const loaded = await loadScenario(scenarioId, alien);
  const pack = annotatePackStats(packContext(loaded.cases, loaded.prompt));
  const started = Date.now();

  try {
    let output;
    let usage;
    let latency_ms;
    let provider_name = "fixture";

    if (fixture) {
      const baseOutput = alignOutputUrls(loaded.perfect, loaded.cases);
      const behavior = await loadFixtureBehavior(scenarioId);
      const axis = alien ? "true" : "false";
      const roleKey = fixtureBehaviorRoleKey(model.role);
      const mutations =
        behavior?.mutations?.[axis]?.[roleKey] ||
        (roleKey === "slm_under_test" && !alien
          ? ["set_high:__noop__"]
          : []);
      const trialMutations = fixture
        ? fixtureTrialExtraMutations(
            scenarioId,
            model,
            alien,
            trialIndex,
            loaded.cases,
          )
        : [];
      output = applyFixtureMutations(baseOutput, [
        ...mutations,
        ...trialMutations,
      ]);
      usage = fixtureUsage(model, pack.stats, alien);
      if (trialIndex > 0) {
        usage = {
          ...usage,
          input_tokens: usage.input_tokens + trialIndex * 4,
          output_tokens: usage.output_tokens + trialIndex * 2,
          input_tokens_details: {
            cached_tokens:
              (usage.input_tokens_details?.cached_tokens || 0) + trialIndex,
          },
        };
      }
      latency_ms = fixtureLatency(model, alien) + trialIndex * 7;
    } else {
      const response = await router.run(model, pack);
      output = response.output;
      usage = response.usage;
      latency_ms = response.latency_ms ?? Math.max(1, Date.now() - started);
      provider_name = model.provider_name || "live";
    }

    const score = await scoreDocument(output, {
      casesPath: loaded.casesPath,
      truthPath: loaded.truthPath,
    });
    const pricing = await readJson("config/model-pricing.json");
    const price = pricing.models[model.id];
    const tokens = summarizeTokens(usage);

    return {
      scenario_id: scenarioId,
      model: model.id,
      resolved_id: model.resolved_id || model.id,
      role: model.role,
      alien,
      provider: provider_name,
      evidence_mode: loaded.cases.evidence_mode,
      status: "completed",
      latency_ms,
      usage,
      tokens,
      estimated_cost_usd: estimateCost(usage, price),
      pricing_verified_at: price ? pricing.verified_at : null,
      score,
      context_pack_stats: pack.stats,
      wall_ms: Math.max(1, Date.now() - started),
    };
  } catch (error) {
    return {
      scenario_id: scenarioId,
      model: model.id,
      resolved_id: model.resolved_id || model.id,
      role: model.role,
      alien,
      status: "failed",
      latency_ms: Math.max(1, Date.now() - started),
      error: String(error.message || error),
    };
  }
}

function finiteDelta(withValue, withoutValue) {
  if (!Number.isFinite(withValue) || !Number.isFinite(withoutValue)) return null;
  return Number((withValue - withoutValue).toFixed(6));
}

function tokenSnapshot(tokens) {
  if (!tokens || !Number.isFinite(tokens.total_tokens)) return null;
  return {
    input_tokens: tokens.input_tokens,
    output_tokens: tokens.output_tokens,
    cached_tokens: tokens.cached_tokens,
    total_tokens: tokens.total_tokens,
  };
}

/** Per-model Alien on vs off: quality + tokens for one scenario (one test). */
function alienDeltas(cells) {
  const byModel = new Map();
  for (const cell of cells) {
    if (cell.status !== "completed") continue;
    const entry = byModel.get(cell.model) || {};
    entry[cell.alien ? "with" : "without"] = cell;
    byModel.set(cell.model, entry);
  }
  return [...byModel.entries()].map(([model, pair]) => {
    const withCell = pair.with;
    const withoutCell = pair.without;
    const qWith = withCell?.score?.quality_score;
    const qWithout = withoutCell?.score?.quality_score;
    const tWith = tokenSnapshot(withCell?.tokens);
    const tWithout = tokenSnapshot(withoutCell?.tokens);
    return {
      model,
      quality_with_alien: qWith ?? null,
      quality_without_alien: qWithout ?? null,
      delta_quality: finiteDelta(qWith, qWithout),
      tokens_with_alien: tWith,
      tokens_without_alien: tWithout,
      delta_input_tokens: finiteDelta(
        tWith?.input_tokens,
        tWithout?.input_tokens,
      ),
      delta_output_tokens: finiteDelta(
        tWith?.output_tokens,
        tWithout?.output_tokens,
      ),
      delta_total_tokens: finiteDelta(
        tWith?.total_tokens,
        tWithout?.total_tokens,
      ),
    };
  });
}

function summarizeCasesPacket(casesDocument) {
  return {
    evidence_mode: casesDocument.evidence_mode || null,
    workflow_version: casesDocument.workflow_version || null,
    researcher_profile: casesDocument.researcher_profile || null,
    case_count: casesDocument.cases?.length || 0,
    cases: (casesDocument.cases || []).map((item) => ({
      case_id: item.case_id,
      title: item.record?.title || null,
      year: item.record?.year ?? null,
      topics: item.record?.topics || [],
      doi: item.record?.doi || null,
      source_count: item.sources?.length || 0,
      source_ids: (item.sources || []).map((s) => s.source_id),
    })),
  };
}

async function evaluateScenario(
  scenarioMeta,
  { fixture, router, runnable, skipped, trials = 1, keepTrials = false, modelsConfig },
) {
  const benchmark = await readJson("workflow/benchmark.json");
  const workflow = { benchmark };
  const base = scenarioDir(scenarioMeta.id);
  const [prompt, casesPlain, casesAlien] = await Promise.all([
    fs.readFile(path.join(ROOT, base, "prompt.md"), "utf8"),
    readJson(`${base}/cases.json`),
    readJson(`${base}/cases.alien.json`),
  ]);
  const packOff = annotatePackStats(packContext(casesPlain, prompt));
  const packOn = annotatePackStats(packContext(casesAlien, prompt));
  const workflow_evaluated = {
    scenario_id: scenarioMeta.id,
    title: scenarioMeta.title,
    actor: scenarioMeta.actor || null,
    hard: Boolean(scenarioMeta.hard),
    nightmare: Boolean(scenarioMeta.nightmare),
    prompt_path: `${base}/prompt.md`,
    // Exact messages scored — expand in canvas to read in full.
    prompt_system: prompt,
    user_message_without_alien: packOff.user,
    user_message_with_alien: packOn.user,
    pack_user_preamble: [
      `Triage every case in this packed ${casesPlain.evidence_mode || "evidence"} packet.`,
      `workflow_version must be exactly ${casesPlain.workflow_version}.`,
      "Return only the required structured JSON.",
    ].join("\n"),
    pack_stats_without_alien: packOff.stats,
    pack_stats_with_alien: packOn.stats,
    cases_without_alien: summarizeCasesPacket(casesPlain),
    cases_with_alien: summarizeCasesPacket(casesAlien),
    alien_axis: [false, true],
    models_evaluated: runnable.map((m) => ({
      id: m.id,
      role: m.role,
      api_id: m.api_id || m.id,
    })),
    scoring_contract: {
      benchmark_id: benchmark.benchmark_id,
      minimum_quality_to_recommend:
        benchmark.scoring?.minimum_quality_to_recommend ?? null,
      recommendation_components: benchmark.scoring?.recommendation_components || null,
      quality_components: benchmark.scoring?.quality_components || null,
    },
  };
  const cells = [];

  for (const model of runnable) {
    for (const alien of [false, true]) {
      const trialRuns = [];
      for (let trialIndex = 0; trialIndex < trials; trialIndex += 1) {
        trialRuns.push(
          await runCell({
            scenarioId: scenarioMeta.id,
            model,
            alien,
            fixture,
            router,
            trialIndex,
          }),
        );
      }
      cells.push(finalizeCellFromTrials(trialRuns, keepTrials));
    }
  }

  // Skipped models still appear once per alien axis for report completeness.
  for (const item of skipped) {
    for (const alien of [false, true]) {
      cells.push({
        scenario_id: scenarioMeta.id,
        model: item.model,
        resolved_id: item.api_id,
        alien,
        status: "skipped",
        reason: item.reason,
        accessible: item.accessible,
      });
    }
  }

  const completed = cells.filter((cell) => cell.status === "completed");
  const ranking = rankResults(completed, workflow).map((item) => ({
    model: item.model,
    alien: item.alien,
    role: item.role,
    eligible: item.eligible,
    ineligible_reasons: item.ineligible_reasons,
    composite_score: item.composite_score,
    quality_score: item.score.quality_score,
    estimated_cost_usd: item.estimated_cost_usd,
    latency_ms: item.latency_ms,
    tokens: item.tokens,
  }));
  const winner = ranking.find((item) => item.eligible) || null;
  const runnerUp = ranking.filter((item) => item.eligible)[1] || null;
  const failed = cells.filter((cell) => cell.status === "failed");
  const tokens = aggregateTokens(completed);
  const deltas = alienDeltas(cells);
  const winnerDelta = winner
    ? deltas.find((item) => item.model === winner.model)
    : null;
  const alienLift = winnerDelta?.delta_quality ?? null;
  const winnerCell = winner
    ? completed.find(
        (cell) => cell.model === winner.model && cell.alien === winner.alien,
      )
    : null;
  const confidence = deriveConfidence({
    fixture,
    trialsRequested: trials,
    winnerQualityStdev: winnerCell?.trials?.quality_score?.stdev,
    allCellsCompleted: failed.length === 0 && skipped.length === 0,
  });
  const oracleScore = await scorePerfectForScenario(scenarioMeta.id, readJson);
  const calibration = await buildScenarioCalibration({
    scenarioId: scenarioMeta.id,
    cells,
    benchmark,
    modelsConfig,
    scorePerfect: oracleScore,
  });
  const valence = winner
    ? {
        quality: winner.quality_score,
        alien_lift: alienLift,
        cost_usd: winner.estimated_cost_usd,
        latency_ms: winner.latency_ms,
        tokens_total: winner.tokens?.total_tokens ?? null,
        composite: winner.composite_score,
        vs_runner_up: runnerUp
          ? {
              model: runnerUp.model,
              alien: runnerUp.alien,
              composite: runnerUp.composite_score,
              composite_gap: Number(
                (
                  (winner.composite_score ?? 0) - (runnerUp.composite_score ?? 0)
                ).toFixed(6),
              ),
              quality: runnerUp.quality_score,
              cost_usd: runnerUp.estimated_cost_usd,
            }
          : null,
      }
    : null;
  const why = winner
    ? [
        `${winner.model} + Alien=${winner.alien} wins on composite ${Number(winner.composite_score).toFixed(3)}.`,
        `Quality ${winner.quality_score.toFixed(3)}${
          alienLift == null
            ? ""
            : ` (Alien lift ${alienLift >= 0 ? "+" : ""}${Number(alienLift).toFixed(3)})`
        }.`,
        `Cost $${Number(winner.estimated_cost_usd).toFixed(6)}, latency ${winner.latency_ms} ms, tokens ${winner.tokens?.total_tokens ?? "n/a"}.`,
        runnerUp
          ? `Beats ${runnerUp.model} (Alien=${runnerUp.alien}) by composite gap ${valence.vs_runner_up.composite_gap}.`
          : "No other eligible cell.",
      ].join(" ")
    : "No eligible cell met the quality/cost/latency gate for this use case.";

  return {
    scenario_id: scenarioMeta.id,
    title: scenarioMeta.title,
    actor: scenarioMeta.actor,
    hard: Boolean(scenarioMeta.hard),
    nightmare: Boolean(scenarioMeta.nightmare),
    workflow_evaluated,
    cell_count: cells.length,
    cells,
    ranking,
    tokens,
    alien_delta: deltas,
    skipped_models: skipped,
    failed_models: failed,
    calibration,
    recommendation: winner
      ? {
          model: winner.model,
          alien: winner.alien,
          confidence,
          quality_score: winner.quality_score,
          estimated_cost_usd: winner.estimated_cost_usd,
          latency_ms: winner.latency_ms,
          tokens: winner.tokens,
          trials: winnerCell?.trials ?? null,
          valence,
          why,
        }
      : null,
    recommendation_text: winner
      ? `USE CASE ${scenarioMeta.id}: recommend ${winner.model} with alien=${winner.alien}. ${why}`
      : `USE CASE ${scenarioMeta.id}: ${why}`,
  };
}

/**
 * Single seam: run the demo matrix (scenarios × models × alien on/off).
 */
export async function runEvalMatrix({
  fixture = true,
  scenarioId = null,
  fetchImpl = fetch,
  trials = 1,
  keepTrials = false,
} = {}) {
  const requestedTrials = Math.max(1, Number(trials) || 1);
  const manifest = await readJson("scenarios/manifest.json");
  const modelsConfig = await readJson("config/models.json");
  const selected = scenarioId
    ? manifest.scenarios.filter((item) => item.id === scenarioId)
    : manifest.scenarios;

  if (!selected.length) {
    throw new Error(`Unknown scenario: ${scenarioId}`);
  }

  let router = null;
  let runnable = modelsConfig.demo_candidates.map((model) => ({ ...model }));
  let skipped = [];
  let providers = { brev: null, xai: null };

  if (fixture) {
    runnable = runnable.map((model) => ({
      ...model,
      resolved_id: model.api_id || model.id,
      provider_name: "fixture",
    }));
  } else {
    router = await createLiveProviderRouter({ fetchImpl });
    ({ runnable, skipped } = await router.resolveRunnable(
      modelsConfig.demo_candidates,
    ));
    providers = {
      endpoints: Object.fromEntries(
        runnable.map((m) => [m.id, m.endpoint || null]),
      ),
      skipped: skipped.map((s) => ({ model: s.model, reason: s.reason })),
    };
  }

  const scenarios = [];
  for (const scenario of selected) {
    scenarios.push(
      await evaluateScenario(scenario, {
        fixture,
        router,
        runnable,
        skipped,
        trials: requestedTrials,
        keepTrials,
        modelsConfig,
      }),
    );
  }

  const completedCells = scenarios.reduce(
    (n, s) => n + s.cells.filter((c) => c.status === "completed").length,
    0,
  );
  const tokens_by_workflow = Object.fromEntries(
    scenarios.map((s) => [s.scenario_id, s.tokens]),
  );
  const tokens_total = scenarios.reduce(
    (acc, s) => ({
      input_tokens: acc.input_tokens + (s.tokens?.input_tokens || 0),
      output_tokens: acc.output_tokens + (s.tokens?.output_tokens || 0),
      cached_tokens: acc.cached_tokens + (s.tokens?.cached_tokens || 0),
      total_tokens: acc.total_tokens + (s.tokens?.total_tokens || 0),
      cell_count: acc.cell_count + (s.tokens?.cell_count || 0),
    }),
    {
      input_tokens: 0,
      output_tokens: 0,
      cached_tokens: 0,
      total_tokens: 0,
      cell_count: 0,
    },
  );

  const report = {
    report_version: "1.1.0",
    generated_at: new Date().toISOString(),
    mode: fixture ? "fixture" : "live",
    track: "Context Engineering for SLMs",
    orchestrator: "gemma-picsou-mvp",
    matrix_version: manifest.matrix_version,
    models: modelsConfig.demo_candidates.map((m) => m.id),
    alien_axis: manifest.alien_axis,
    trials: {
      requested: requestedTrials,
      keep_trial_runs: keepTrials,
    },
    providers,
    summary: {
      scenario_count: scenarios.length,
      cells_attempted: scenarios.reduce((n, s) => n + s.cell_count, 0),
      cells_completed: completedCells,
      runnable_models: runnable.map((m) => m.id),
      skipped_models: skipped.map((m) => m.model),
      tokens_total,
      tokens_by_workflow,
    },
    scenarios,
    limitations: fixture
      ? [
          "MVP fixture matrix: Alien packets are frozen Alien-URL mirrors, not live MCP calls.",
          "Live model serving (Brev/SGLang + Grok API) not required for --fixture.",
          requestedTrials < 2
            ? "Confidence remains demo-low until --trials repeats the matrix."
            : "Fixture trials use deterministic mutation noise; confidence stays demo-low until live repeats.",
        ]
      : [
          "Live matrix: Gemma via PICSOU_ENDPOINT_* / OPENAI_BASE_URL (Brev/SGLang); Grok via XAI_API_KEY or ~/.grok/auth.json when x.ai is used.",
          "Models missing from an endpoint are skipped, not invented.",
          "Alien packets remain frozen mirrors in this MVP (not live MCP).",
          requestedTrials < 2
            ? "Confidence remains demo-low until --trials repeats the matrix."
            : "Live trials at temperature 0; residual variance is timing/usage unless the provider is non-deterministic.",
        ],
  };
  report.calibration_summary = formatCalibrationSummary(report);
  return report;
}
