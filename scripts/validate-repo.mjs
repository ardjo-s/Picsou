import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scoreDocument, scoreFile } from "./score.mjs";
import { contractForScenario } from "../src/contract.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredFiles = [
  "README.md",
  "LICENSE",
  "docs/demo/README.md",
  "docs/demo/matrix-fixture-summary.json",
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
  "scenarios/manifest.json",
  "src/matrix.mjs",
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
const readme = await fs.readFile(path.join(ROOT, "README.md"), "utf8");
const demo = await fs.readFile(path.join(ROOT, "docs/demo/README.md"), "utf8");

assert.ok(
  readme.includes("npm run evaluate:matrix"),
  "README must document offline matrix quick start.",
);
assert.ok(
  /How it works/i.test(readme) && /How to use/i.test(readme),
  "README must explain how Picsou works and how to use it.",
);
assert.ok(
  demo.includes("npm run evaluate:matrix"),
  "Demo doc must document the offline matrix path.",
);

assert.equal(cases.cases.length, 5);
assert.equal(cases.evidence_mode, "frozen_openaire_style");
assert.equal(cases.workflow_version, ledger.workflow_version);
assert.deepEqual(
  truth.cases.map((item) => item.case_id),
  cases.cases.map((item) => item.case_id),
);

const manifest = JSON.parse(
  await fs.readFile(path.join(ROOT, "scenarios/manifest.json"), "utf8"),
);

const referenceTagged = models.demo_candidates.some(
  (item) => item.role === "reference_ceiling",
);
assert.ok(referenceTagged, "One demo candidate must use role reference_ceiling.");

assert.ok(
  manifest.scenarios.some((scenario) => scenario.nightmare),
  "Matrix manifest must include nightmare scenarios.",
);

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
assert.ok(
  modelIds.some((id) => id.includes("gemma-4")),
  "A Gemma 4 candidate must be configured.",
);
for (const candidate of models.demo_candidates) {
  assert.ok(pricing.models[candidate.id], `Missing pricing for ${candidate.id}`);
}

const scenarioRequired = [
  "cases.json",
  "ground-truth.json",
  "perfect-output.json",
  "prompt.md",
];
for (const scenario of manifest.scenarios) {
  const base = path.join(ROOT, "scenarios", scenario.id);
  for (const file of scenarioRequired) {
    await fs.access(path.join(base, file));
  }
  if (scenario.hard) {
    await fs.access(path.join(base, "fixture-behavior.json"));
  }
  const perfectPath = path.join(base, "perfect-output.json");
  const contract = await contractForScenario(scenario, async (relativePath) =>
    JSON.parse(await fs.readFile(path.join(ROOT, relativePath), "utf8")),
  );
  const scored = await scoreDocument(
    JSON.parse(await fs.readFile(perfectPath, "utf8")),
    {
      casesPath: path.join("scenarios", scenario.id, "cases.json"),
      truthPath: path.join("scenarios", scenario.id, "ground-truth.json"),
      contract,
    },
  );
  assert.equal(
    scored.schema_valid,
    true,
    `${scenario.id} perfect output invalid: ${scored.errors.join("; ")}`,
  );
  assert.ok(
    scored.quality_score >= 0.75,
    `${scenario.id} perfect quality ${scored.quality_score} below 0.75`,
  );
}

process.chdir(ROOT);
const perfect = await scoreFile("examples/perfect-output.json");
assert.equal(perfect.schema_valid, true, perfect.errors.join("\n"));
assert.ok(Math.abs(perfect.quality_score - 1) < 1e-9, `Expected quality 1, got ${perfect.quality_score}`);

console.log(
  `Repository contract valid. Perfect fixture score: ${perfect.quality_score.toFixed(4)}.`,
);
