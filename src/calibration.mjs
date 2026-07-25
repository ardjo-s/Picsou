import { scoreDocument } from "../scripts/score.mjs";
import {
  contractForScenario,
  contractForScenarioId,
  oracleMeaning,
} from "./contract.mjs";

export function scoreMetricsFromResult(score, contract) {
  if (!score) return null;
  const keys = contract?.calibration?.metric_keys || [
    "priority_accuracy",
    "attention_fit_accuracy",
    "signal_f1",
    "evidence_exactness",
  ];
  const metrics = {};
  for (const key of keys) {
    if (score[key] != null) metrics[key] = score[key];
  }
  return metrics;
}

export function qualityFormulaFromBenchmark(benchmark, contract) {
  const scoring = benchmark?.scoring || {};
  const evidenceTerm =
    contract?.scorer_id === "decision-v1"
      ? "evidence_exactness"
      : "evidence_exactness * signal_f1";
  return {
    weights: scoring.quality_components || {},
    minimum_to_recommend: scoring.minimum_quality_to_recommend ?? 0.75,
    evidence_term: evidenceTerm,
    recommendation_components: scoring.recommendation_components || {},
  };
}

export function pickReferenceModelId(modelsConfig) {
  const candidates = modelsConfig?.demo_candidates || [];
  const tagged = candidates.find((item) => item.role === "reference_ceiling");
  if (tagged) return tagged.id;
  const baseline = candidates.find((item) => item.role === "larger_baseline");
  if (baseline) return baseline.id;
  const nonSlm = candidates.find((item) => item.role !== "slm_under_test");
  return nonSlm?.id || null;
}

export function bestCompletedCell(cells, modelId) {
  const pool = (cells || []).filter(
    (cell) => cell.status === "completed" && cell.model === modelId,
  );
  if (!pool.length) return null;
  return pool.reduce((best, cell) =>
    (cell.score?.quality_score ?? -1) > (best.score?.quality_score ?? -1)
      ? cell
      : best,
  );
}

/**
 * Build per-scenario calibration: oracle ceiling + reference model best cell.
 */
export async function buildScenarioCalibration({
  scenarioId,
  cells,
  benchmark,
  modelsConfig,
  scorePerfect,
  contract,
}) {
  const oracleScore = scorePerfect;
  const referenceModelId = pickReferenceModelId(modelsConfig);
  const refCell = referenceModelId
    ? bestCompletedCell(cells, referenceModelId)
    : null;

  const typicalFailure = (cells || [])
    .filter((cell) => cell.status === "completed")
    .map((cell) => ({
      quality_score: cell.score?.quality_score,
      model: cell.model,
      alien: cell.alien,
    }))
    .filter((item) => Number.isFinite(item.quality_score))
    .sort((a, b) => a.quality_score - b.quality_score)[0];

  return {
    scenario_id: scenarioId,
    workflow_id: contract?.id || null,
    oracle: {
      source: "perfect-output",
      quality_score: oracleScore.quality_score,
      schema_valid: oracleScore.schema_valid,
      metrics: scoreMetricsFromResult(oracleScore, contract),
      meaning: oracleMeaning(contract),
    },
    reference_model: refCell
      ? {
          model_id: referenceModelId,
          role: "reference_ceiling",
          best_cell: {
            alien: refCell.alien,
            quality_score: refCell.score.quality_score,
            composite_score: refCell.composite_score ?? null,
            metrics: scoreMetricsFromResult(refCell.score, contract),
            tokens: refCell.tokens ?? null,
          },
          meaning:
            "Best empirical cell for the designated reference model on this scenario.",
        }
      : {
          model_id: referenceModelId,
          role: "reference_ceiling",
          best_cell: null,
          meaning: "Reference model configured but no completed cell in this scenario.",
        },
    quality_formula: qualityFormulaFromBenchmark(benchmark, contract),
    worked_examples: [
      { label: "oracle", quality_score: 1.0, note: "perfect-output.json" },
      typicalFailure
        ? {
            label: "lowest_completed_cell",
            quality_score: typicalFailure.quality_score,
            model: typicalFailure.model,
            alien: typicalFailure.alien,
            note: "Lowest quality among completed cells in this run.",
          }
        : {
            label: "typical_failure",
            quality_score: 0.47,
            note: "Illustrative: good citations, wrong priorities.",
          },
    ],
  };
}

export async function scorePerfectForScenario(scenarioId, readJson) {
  const contract = await contractForScenarioId(scenarioId, readJson);
  const base = `scenarios/${scenarioId}`;
  const perfect = await readJson(`${base}/perfect-output.json`);
  return scoreDocument(perfect, {
    casesPath: `${base}/cases.json`,
    truthPath: `${base}/ground-truth.json`,
    contract,
  });
}

export function deriveConfidence({
  fixture,
  trialsRequested,
  winnerQualityStdev,
  allCellsCompleted,
}) {
  if (fixture || trialsRequested < 2) return "demo-low";
  if (
    trialsRequested >= 10 &&
    allCellsCompleted &&
    Number.isFinite(winnerQualityStdev) &&
    winnerQualityStdev <= 0.02
  ) {
    return "high";
  }
  if (
    trialsRequested >= 5 &&
    allCellsCompleted &&
    Number.isFinite(winnerQualityStdev) &&
    winnerQualityStdev <= 0.03
  ) {
    return "medium";
  }
  if (Number.isFinite(winnerQualityStdev) && winnerQualityStdev <= 0.05) {
    return "low";
  }
  return "demo-low";
}

export function formatCalibrationSummary(report) {
  const trials = report.trials?.requested ?? 1;

  if (Array.isArray(report.scenarios) && report.scenarios.length) {
    const winners = report.scenarios
      .map((scenario) => scenario.recommendation)
      .filter(Boolean);
    const refModel =
      report.scenarios[0]?.calibration?.reference_model?.model_id ?? "n/a";
    const refScores = report.scenarios
      .flatMap((scenario) =>
        (scenario.cells || [])
          .filter(
            (cell) =>
              cell.status === "completed" &&
              cell.model === refModel &&
              Number.isFinite(cell.score?.quality_score),
          )
          .map((cell) => cell.score.quality_score),
      );
    const winScores = winners
      .map((winner) => winner.quality_score)
      .filter(Number.isFinite);
    const refText = refScores.length
      ? `${refModel} ${Math.min(...refScores).toFixed(3)}–${Math.max(...refScores).toFixed(3)}`
      : "n/a";
    const winText = winScores.length
      ? `${winners[0]?.model ?? "mixed"} ${Math.min(...winScores).toFixed(3)}–${Math.max(...winScores).toFixed(3)} (${report.scenarios.length} use cases)`
      : "none";
    const conf = winners[0]?.confidence ?? "demo-low";
    return `Calibration: oracle=1.000 | reference=${refText} | winner=${winText} (confidence=${conf}, trials=${trials})`;
  }

  const cal = report.calibration;
  const winner = report.recommendation;
  const oracle = cal?.oracle?.quality_score ?? 1;
  const ref = cal?.reference_model?.best_cell;
  const refText = ref
    ? `${cal.reference_model.model_id} ${Number(ref.quality_score).toFixed(3)}`
    : "n/a";
  const winText = winner
    ? `${winner.model} ${Number(winner.quality_score).toFixed(3)}`
    : "none";
  const conf = winner?.confidence ?? "demo-low";
  return `Calibration: oracle=${Number(oracle).toFixed(3)} | reference=${refText} | winner=${winText} (confidence=${conf}, trials=${trials})`;
}
