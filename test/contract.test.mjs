import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { runEvalMatrix } from "../src/matrix.mjs";
import { scoreDocument } from "../scripts/score.mjs";
import { loadWorkflowContract } from "../src/contract.mjs";

test("decision-v1 contract scores approve/reject perfect output", async () => {
  const contract = await loadWorkflowContract("decision-v1");
  const perfect = JSON.parse(
    await fs.readFile("scenarios/demo-inbox-review/perfect-output.json", "utf8"),
  );
  const scored = await scoreDocument(perfect, {
    casesPath: "scenarios/demo-inbox-review/cases.json",
    truthPath: "scenarios/demo-inbox-review/ground-truth.json",
    contract,
  });
  assert.equal(scored.schema_valid, true, scored.errors?.join("; "));
  assert.ok(Math.abs(scored.quality_score - 1) < 1e-9);
  assert.equal(scored.decision_accuracy, 1);
});

test("demo-inbox-review runs via --scenario without default matrix", async () => {
  const report = await runEvalMatrix({
    fixture: true,
    scenarioId: "demo-inbox-review",
  });
  assert.equal(report.summary.scenario_count, 1);
  assert.equal(report.scenarios[0].workflow_id, "decision-v1");
  assert.ok(report.scenarios[0].recommendation);
  const gemma = report.scenarios[0].cells.find(
    (cell) => cell.model === "gemma-4-e2b-it" && cell.alien === false,
  );
  const gemmaAlien = report.scenarios[0].cells.find(
    (cell) => cell.model === "gemma-4-e2b-it" && cell.alien === true,
  );
  assert.ok(gemma.score.quality_score < gemmaAlien.score.quality_score);
});
