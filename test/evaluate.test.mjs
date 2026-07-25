import assert from "node:assert/strict";
import test from "node:test";
import { evaluate } from "../src/evaluate.mjs";

test("fixture evaluation recommends an eligible model with Gemma in ranking", async () => {
  const report = await evaluate({ fixture: true });
  assert.equal(report.mode, "fixture");
  assert.equal(report.track, "Context Engineering for SLMs");
  assert.ok(report.recommendation);
  assert.ok(report.ranking.some((item) => item.model.includes("gemma-4")));
  assert.ok(report.recommendation_text.includes("Recommend"));
});
