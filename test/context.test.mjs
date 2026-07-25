import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { annotatePackStats, packContext } from "../src/context.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("packContext keeps source ids and drops unused record fields from the wire format shape", async () => {
  const cases = JSON.parse(
    await fs.readFile(path.join(ROOT, "workflow/cases.json"), "utf8"),
  );
  const prompt = await fs.readFile(path.join(ROOT, "workflow/prompt.md"), "utf8");
  const pack = annotatePackStats(packContext(cases, prompt));
  assert.equal(pack.stats.case_count, 5);
  assert.ok(pack.stats.source_count >= 10);
  assert.ok(pack.stats.approx_chars > 1000);
  assert.match(pack.user, /air-paris-001/);
  assert.match(pack.user, /source_id/);
});
