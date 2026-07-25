import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateTokens,
  summarizeTokens,
  rankResults,
} from "../src/score-lib.mjs";

test("summarizeTokens totals input + output", () => {
  assert.deepEqual(
    summarizeTokens({
      input_tokens: 1000,
      output_tokens: 200,
      input_tokens_details: { cached_tokens: 50 },
    }),
    {
      input_tokens: 1000,
      output_tokens: 200,
      cached_tokens: 50,
      total_tokens: 1200,
    },
  );
});

test("aggregateTokens sums completed cells for a workflow", () => {
  const sum = aggregateTokens([
    {
      status: "completed",
      tokens: {
        input_tokens: 100,
        output_tokens: 20,
        cached_tokens: 5,
        total_tokens: 120,
      },
    },
    {
      status: "completed",
      tokens: {
        input_tokens: 80,
        output_tokens: 10,
        cached_tokens: 0,
        total_tokens: 90,
      },
    },
    { status: "skipped" },
  ]);
  assert.equal(sum.cell_count, 2);
  assert.equal(sum.total_tokens, 210);
  assert.equal(sum.input_tokens, 180);
});

test("rankResults prefers fewer tokens when quality ties", () => {
  const workflow = {
    benchmark: {
      scoring: {
        minimum_quality_to_recommend: 0.5,
        recommendation_components: {
          quality: 0.55,
          cost_efficiency: 0.2,
          latency_efficiency: 0.15,
          token_efficiency: 0.1,
        },
      },
    },
  };
  const ranked = rankResults(
    [
      {
        status: "completed",
        model: "heavy",
        score: { schema_valid: true, quality_score: 1 },
        estimated_cost_usd: 0.001,
        latency_ms: 1000,
        usage: { input_tokens: 5000, output_tokens: 1000 },
      },
      {
        status: "completed",
        model: "light",
        score: { schema_valid: true, quality_score: 1 },
        estimated_cost_usd: 0.001,
        latency_ms: 1000,
        usage: { input_tokens: 1000, output_tokens: 200 },
      },
    ],
    workflow,
  );
  assert.equal(ranked[0].model, "light");
  assert.ok(ranked[0].tokens.total_tokens < ranked[1].tokens.total_tokens);
});
