import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scoreFile } from "./score.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredFiles = [
  "README.md",
  "LICENSE",
  "docs/WRITEUP.md",
  "docs/ARCHITECTURE.md",
  "workflow/prompt.md",
  "workflow/context-pack.md",
  "workflow/cases.json",
  "workflow/ground-truth.json",
  "workflow/output.schema.json",
  "workflow/benchmark.json",
  "workflow/source-ledger.json",
  "config/models.json",
  "config/model-pricing.json",
  "examples/perfect-output.json",
  "src/cli.mjs",
];

for (const relativePath of requiredFiles) {
  await fs.access(path.join(ROOT, relativePath));
}

const cases = JSON.parse(
  await fs.readFile(path.join(ROOT, "workflow/cases.json"), "utf8"),
);
const truth = JSON.parse(
  await fs.readFile(path.join(ROOT, "workflow/ground-truth.json"), "utf8"),
);
const models = JSON.parse(
  await fs.readFile(path.join(ROOT, "config/models.json"), "utf8"),
);
const pricing = JSON.parse(
  await fs.readFile(path.join(ROOT, "config/model-pricing.json"), "utf8"),
);
const ledger = JSON.parse(
  await fs.readFile(path.join(ROOT, "workflow/source-ledger.json"), "utf8"),
);
const writeup = await fs.readFile(path.join(ROOT, "docs/WRITEUP.md"), "utf8");
const words = writeup.trim().split(/\s+/).filter(Boolean).length;

assert.equal(cases.cases.length, 5);
assert.equal(cases.evidence_mode, "frozen_openaire_style");
assert.equal(cases.workflow_version, ledger.workflow_version);
assert.deepEqual(
  truth.cases.map((item) => item.case_id),
  cases.cases.map((item) => item.case_id),
);
assert.ok(words <= 1500, `WRITEUP.md is ${words} words; must stay under 1500.`);

const ledgerUrls = new Set(ledger.sources.map((source) => source.url));
let fitCount = 0;
let skipCount = 0;
for (const truthCase of truth.cases) {
  if (truthCase.attention_fit) fitCount += 1;
  else skipCount += 1;
}
assert.equal(fitCount, 3);
assert.equal(skipCount, 2);

for (const benchmarkCase of cases.cases) {
  for (const source of benchmarkCase.sources) {
    assert.equal(source.evidence_kind, "normalized_public_fact");
    assert.equal(source.captured_at, cases.captured_at);
    assert.ok(ledgerUrls.has(source.url), `Missing ledger URL for ${source.source_id}`);
    assert.ok(!/@/.test(source.text), `Contact data found in ${source.source_id}`);
  }
}

const modelIds = models.demo_candidates.map((item) => item.id);
assert.ok(modelIds.includes("gemma-4-e4b-it"), "Gemma 4 E4B must be a demo candidate.");
for (const candidate of models.demo_candidates) {
  assert.ok(pricing.models[candidate.id], `Missing pricing for ${candidate.id}`);
}

process.chdir(ROOT);
const perfect = await scoreFile("examples/perfect-output.json");
assert.equal(perfect.schema_valid, true, perfect.errors.join("\n"));
assert.ok(Math.abs(perfect.quality_score - 1) < 1e-9, `Expected quality 1, got ${perfect.quality_score}`);

console.log(
  `Repository contract valid. Perfect fixture score: ${perfect.quality_score.toFixed(4)}. Writeup words: ${words}.`,
);
