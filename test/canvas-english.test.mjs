import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RENDERER = path.join(ROOT, "scripts/render-canvas-report.mjs");

/** UI chrome / HELP copy must stay English for jury + GitHub surfaces. */
const FRENCH_MARKERS = [
  /[àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ]/,
  /\bInfobulles\b/,
  /\bLégende\b/,
  /\bdevoir\b/i,
  /\bélèves?\b/i,
  /\bgagnant\b/i,
  /\béconome\b/i,
  /\bcorrigé\b/i,
  /\bRecommandation\b/,
  /\bQualité\b/,
  /\bSans Alien\b/,
  /\bAvec Alien\b/,
  /\bComment ça marche\b/,
  /\bComment lire\b/,
  /\bLimites honnêtes\b/,
  /\bcarte des devoirs\b/i,
  /\bRègles du prof\b/,
  /\bPas de gagnant\b/,
  /\bBarre de passage\b/,
];

test("canvas report renderer UI chrome is English-only", async () => {
  const source = await fs.readFile(RENDERER, "utf8");
  const helpStart = source.indexOf("const HELP = {");
  const sharedStart = source.indexOf("const SHARED_UI = `");
  assert.ok(helpStart >= 0, "HELP block missing");
  assert.ok(sharedStart >= 0, "SHARED_UI block missing");

  // Scan the embedded canvas template (HELP + JSX chrome), not Node scaffolding.
  const template = source.slice(sharedStart);
  const hits = [];
  for (const marker of FRENCH_MARKERS) {
    const match = template.match(marker);
    if (match) hits.push(`${marker}: ${match[0]}`);
  }
  assert.deepEqual(
    hits,
    [],
    `Canvas report UI must be English-only. Found: ${hits.join("; ")}`,
  );
});
