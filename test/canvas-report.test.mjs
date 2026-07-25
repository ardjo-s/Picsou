import assert from "node:assert/strict";
import test from "node:test";
import { buildUseCase, matrixRows } from "../scripts/render-canvas-report.mjs";

test("matrixRows includes token and trial stdev fields", () => {
  const scenario = {
    ranking: [
      {
        model: "gemma-4-e2b-it",
        alien: true,
        quality_score: 0.91,
        composite_score: 0.8,
        estimated_cost_usd: 0.0001,
        latency_ms: 900,
        tokens: { total_tokens: 2700, input_tokens: 1900, output_tokens: 800 },
        eligible: true,
        role: "slm_under_test",
      },
    ],
    cells: [
      {
        model: "gemma-4-e2b-it",
        alien: true,
        trials: { quality_score: { stdev: 0.02 } },
      },
    ],
  };
  const rows = matrixRows(scenario);
  assert.equal(rows[0].tokens_total, 2700);
  assert.equal(rows[0].quality_stdev, 0.02);
});

test("buildUseCase carries calibration and trials metadata", () => {
  const useCase = buildUseCase(
    {
      scenario_id: "demo",
      title: "Demo",
      calibration: {
        oracle: { quality_score: 1 },
        reference_model: { model_id: "grok-4.5" },
      },
      ranking: [],
      cells: [],
      alien_delta: [],
    },
    {
      trials_requested: 3,
      mode: "fixture",
      track: "t",
      generated_at: "now",
      limitations: [],
    },
  );
  assert.equal(useCase.calibration.oracle.quality_score, 1);
  assert.equal(useCase.trials_requested, 3);
});
