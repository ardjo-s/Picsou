import assert from "node:assert/strict";
import test from "node:test";
import { runEvalMatrix } from "../src/matrix.mjs";
import { orchestratePicsouDemo } from "../src/orchestrate.mjs";

test("fixture matrix runs manifest scenarios × models × alien on/off", async () => {
  const report = await runEvalMatrix({ fixture: true });
  const modelCount = report.models.length;
  const scenarioCount = report.summary.scenario_count;
  const cellsPerScenario = modelCount * report.alien_axis.length;

  assert.equal(report.mode, "fixture");
  assert.equal(scenarioCount, 3);
  assert.equal(report.summary.cells_completed, scenarioCount * cellsPerScenario);
  assert.ok(report.models.includes("gemma-4-e2b-it"));
  assert.deepEqual(report.alien_axis, [false, true]);

  assert.ok(report.summary.tokens_total?.total_tokens > 0);
  assert.ok(report.summary.tokens_by_workflow);

  for (const scenario of report.scenarios) {
    assert.equal(scenario.cell_count, cellsPerScenario);
    assert.ok(scenario.recommendation, scenario.scenario_id);
    assert.equal(typeof scenario.recommendation.alien, "boolean");
    assert.ok(scenario.tokens?.total_tokens > 0, scenario.scenario_id);
    assert.ok(scenario.recommendation.tokens?.total_tokens > 0);
    const completed = scenario.cells.filter((cell) => cell.status === "completed");
    assert.equal(completed.length, cellsPerScenario);
    for (const cell of completed) {
      assert.ok(cell.tokens?.total_tokens > 0, cell.model);
    }

    const slmWithout = scenario.cells.find(
      (cell) => cell.model === "gemma-4-e2b-it" && cell.alien === false,
    );
    const slmWith = scenario.cells.find(
      (cell) => cell.model === "gemma-4-e2b-it" && cell.alien === true,
    );
    assert.ok(slmWithout.score.quality_score < slmWith.score.quality_score);
    assert.ok(
      slmWith.tokens.total_tokens > slmWithout.tokens.total_tokens,
      "Alien on should use more tokens than Alien off in fixture",
    );
    const gemmaDelta = scenario.alien_delta.find(
      (row) => row.model === "gemma-4-e2b-it",
    );
    assert.ok(gemmaDelta?.delta_quality > 0);
    assert.ok(gemmaDelta?.delta_total_tokens > 0);
    assert.ok(gemmaDelta?.tokens_with_alien?.total_tokens > 0);
    assert.ok(gemmaDelta?.tokens_without_alien?.total_tokens > 0);

    const grokWithout = scenario.cells.find(
      (cell) => cell.model === "grok-4.5" && cell.alien === false,
    );
    const grokWith = scenario.cells.find(
      (cell) => cell.model === "grok-4.5" && cell.alien === true,
    );
    assert.ok(grokWithout, scenario.scenario_id);
    assert.ok(grokWith, scenario.scenario_id);
    assert.ok(
      grokWith.score.quality_score >= 0.95,
      "reference_ceiling + Alien should sit near oracle",
    );
    assert.ok(
      grokWithout.score.quality_score >= 0.85,
      "reference_ceiling without Alien should stay near market ceiling",
    );
    assert.ok(
      grokWith.score.quality_score >= grokWithout.score.quality_score,
      "Alien should not hurt reference_ceiling quality",
    );
    assert.ok(
      grokWithout.score.quality_score > slmWithout.score.quality_score,
      "Grok ceiling must beat Gemma without Alien",
    );
  }
});

test("gemma orchestrator entrypoint returns matrix report", async () => {
  const report = await orchestratePicsouDemo({
    fixture: true,
    scenarioId: "nightmare-track3-adversarial",
  });
  assert.equal(report.orchestrator, "gemma");
  assert.equal(report.action, "run_picsou_eval_matrix");
  assert.equal(report.summary.scenario_count, 1);
  assert.equal(report.scenarios[0].scenario_id, "nightmare-track3-adversarial");
});
