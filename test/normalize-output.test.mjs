import assert from "node:assert/strict";
import test from "node:test";
import { normalizeOutput } from "../src/providers.mjs";

test("normalizeOutput lifts flat evidence into signals[]", () => {
  const out = normalizeOutput({
    workflow_version: "1.0.0",
    results: [
      {
        case_id: "air-paris-001",
        title: "t",
        attention_fit: true,
        priority: "high",
        source_id: "air-paris-abstract",
        source_url: "https://example.com",
        evidence_quote: "short-term NO2 spikes are associated",
        confidence: 0.9,
      },
      {
        case_id: "llm-bench-003",
        title: "t2",
        attention_fit: false,
        priority: "skip",
        source_id: "llm-bench-abstract",
        evidence_quote: "multilingual instruction-tuning benchmark",
      },
    ],
  });
  assert.equal(out.results[0].signals.length, 1);
  assert.equal(out.results[0].signals[0].signal_type, "relevance_hook");
  assert.deepEqual(out.results[1].signals, []);
});

test("normalizeOutput maps low priority to skip for non-fit cases", () => {
  const out = normalizeOutput({
    workflow_version: "1.0.0",
    results: [
      {
        case_id: "crypto-005",
        title: "t",
        attention_fit: false,
        priority: "low",
        signals: [{ source_id: "x", signal_type: "relevance_hook" }],
      },
    ],
  });
  assert.equal(out.results[0].priority, "skip");
  assert.deepEqual(out.results[0].signals, []);
});
