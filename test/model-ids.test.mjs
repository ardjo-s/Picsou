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
