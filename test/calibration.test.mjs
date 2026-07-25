import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateNumericStats,
  aggregateTrialRuns,
} from "../src/score-lib.mjs";
import {
  deriveConfidence,
  pickReferenceModelId,
  scoreMetricsFromResult,
} from "../src/calibration.mjs";
import { runEvalMatrix } from "../src/matrix.mjs";

test("aggregateNumericStats computes mean and stdev", () => {
  const stats = aggregateNumericStats([0.8, 0.9, 1.0]);
  assert.equal(stats.mean, 0.9);
  assert.equal(stats.min, 0.8);
  assert.equal(stats.max, 1);
  assert.ok(stats.stdev > 0);
});

test("aggregateTrialRuns summarizes completed trial quality", () => {
  const stats = aggregateTrialRuns(
    [
      { status: "completed", score: { quality_score: 0.9 }, latency_ms: 100, tokens: { total_tokens: 1000, input_tokens: 800, output_tokens: 200 } },
      { status: "completed", score: { quality_score: 0.95 }, latency_ms: 110, tokens: { total_tokens: 1100, input_tokens: 850, output_tokens: 250 } },
    ],
    { requested: 2 },
  );
  assert.equal(stats.requested, 2);
  assert.equal(stats.completed, 2);
  assert.equal(stats.quality_score.mean, 0.925);
});

test("deriveConfidence stays demo-low for fixture", () => {
  assert.equal(
    deriveConfidence({
      fixture: true,
      trialsRequested: 5,
      winnerQualityStdev: 0.01,
      allCellsCompleted: true,
    }),
    "demo-low",
  );
});

test("pickReferenceModelId prefers reference_ceiling role", () => {
  assert.equal(
    pickReferenceModelId({
      demo_candidates: [
        { id: "gemma", role: "slm_under_test" },
        { id: "grok", role: "reference_ceiling" },
      ],
    }),
    "grok",
  );
});

test("fixture matrix with trials aggregates cell trial stats", async () => {
  const report = await runEvalMatrix({
    fixture: true,
    scenarioId: "nightmare-track3-adversarial",
    trials: 3,
  });
  assert.equal(report.trials.requested, 3);
  assert.ok(report.calibration_summary.includes("Calibration:"));
  const scenario = report.scenarios[0];
  assert.ok(scenario.calibration?.oracle?.quality_score >= 0.75);
  assert.equal(scenario.calibration.reference_model.role, "reference_ceiling");
  const completed = scenario.cells.filter((cell) => cell.status === "completed");
  for (const cell of completed) {
    assert.equal(cell.trials?.requested, 3);
    assert.equal(cell.trials?.completed, 3);
    assert.ok(Number.isFinite(cell.trials?.quality_score?.mean));
  }
});

test("scoreMetricsFromResult exposes per-metric breakdown", () => {
  const metrics = scoreMetricsFromResult({
    priority_accuracy: 1,
    attention_fit_accuracy: 0.8,
    signal_f1: 0.9,
    evidence_exactness: 1,
  });
  assert.deepEqual(metrics, {
    priority_accuracy: 1,
    attention_fit_accuracy: 0.8,
    signal_f1: 0.9,
    evidence_exactness: 1,
  });
});
