import assert from "node:assert/strict";
import test from "node:test";
import { candidateApiId, matchAccessibleId } from "../src/model-ids.mjs";

test("candidateApiId prefers api_id then env override for SLM", () => {
  assert.equal(
    candidateApiId({ id: "gemma-4-e4b-it", api_id: "google/gemma-4-E4B-it" }),
    "google/gemma-4-E4B-it",
  );
  const prev = process.env.PICSOU_GEMMA_E4B_MODEL;
  process.env.PICSOU_GEMMA_E4B_MODEL = "google/gemma-4-E4B-it";
  try {
    assert.equal(
      candidateApiId({
        id: "gemma-4-e4b-it",
        role: "slm_under_test",
        api_id: "other",
      }),
      "google/gemma-4-E4B-it",
    );
  } finally {
    if (prev === undefined) delete process.env.PICSOU_GEMMA_E4B_MODEL;
    else process.env.PICSOU_GEMMA_E4B_MODEL = prev;
  }
});

test("PICSOU_GROK_MODEL does not override DeepSeek external_control", () => {
  const prev = process.env.PICSOU_GROK_MODEL;
  process.env.PICSOU_GROK_MODEL = "cursor-grok-4.5-high";
  try {
    assert.equal(
      candidateApiId({
        id: "deepseek-r1-distill-qwen-1.5b",
        role: "external_control",
        api_id: "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
      }),
      "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
    );
    assert.equal(
      candidateApiId({
        id: "grok-4.5",
        role: "reference_ceiling",
        api_id: "grok-4.5",
      }),
      "cursor-grok-4.5-high",
    );
  } finally {
    if (prev === undefined) delete process.env.PICSOU_GROK_MODEL;
    else process.env.PICSOU_GROK_MODEL = prev;
  }
});

test("matchAccessibleId maps logical gemma id to SGLang HF path", () => {
  const accessible = new Set(["google/gemma-4-E4B-it"]);
  assert.equal(
    matchAccessibleId("google/gemma-4-E4B-it", accessible),
    "google/gemma-4-E4B-it",
  );
  assert.equal(
    matchAccessibleId("gemma-4-e4b-it", accessible),
    "google/gemma-4-E4B-it",
  );
  assert.equal(matchAccessibleId("grok-4", accessible), null);
});
