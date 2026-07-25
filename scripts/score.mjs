import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(ROOT, relativePath), "utf8"));
}

function ratio(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function signalKey(signal) {
  return `${signal.source_id}::${signal.signal_type}`;
}

export async function scoreDocument(
  output,
  {
    casesPath = "workflow/cases.json",
    truthPath = "workflow/ground-truth.json",
    benchmarkPath = "workflow/benchmark.json",
  } = {},
) {
  const casesDocument = await readJson(casesPath);
  const truthDocument = await readJson(truthPath);
  const benchmark = await readJson(benchmarkPath);
  const cases = new Map(casesDocument.cases.map((item) => [item.case_id, item]));
  const truth = new Map(truthDocument.cases.map((item) => [item.case_id, item]));
  const errors = [];

  if (output?.workflow_version !== casesDocument.workflow_version) {
    errors.push("workflow_version does not match the benchmark.");
  }
  if (!Array.isArray(output?.results)) {
    errors.push("results must be an array.");
  }

  const results = Array.isArray(output?.results) ? output.results : [];
  const resultMap = new Map();
  for (const result of results) {
    if (!result || typeof result.case_id !== "string") {
      errors.push("Every result requires a string case_id.");
      continue;
    }
    if (resultMap.has(result.case_id)) {
      errors.push(`Duplicate result for ${result.case_id}.`);
    }
    resultMap.set(result.case_id, result);
  }

  let fitCorrect = 0;
  let priorityCorrect = 0;
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let evidenceExact = 0;
  let returnedSignals = 0;

  for (const [caseId, benchmarkCase] of cases) {
    const expected = truth.get(caseId);
    const result = resultMap.get(caseId);
    if (!expected) {
      errors.push(`Missing ground truth for ${caseId}.`);
      continue;
    }
    if (!result) {
      errors.push(`Missing result for ${caseId}.`);
      falseNegative += expected.expected_signals.length;
      continue;
    }
    if (result.title !== benchmarkCase.record.title) {
      errors.push(`title mismatch for ${caseId}.`);
    }
    if (typeof result.attention_fit !== "boolean") {
      errors.push(`attention_fit must be boolean for ${caseId}.`);
    } else if (result.attention_fit === expected.attention_fit) {
      fitCorrect += 1;
    }
    if (!["high", "medium", "skip"].includes(result.priority)) {
      errors.push(`priority invalid for ${caseId}.`);
    } else if (result.priority === expected.priority) {
      priorityCorrect += 1;
    }
    if (result.attention_fit === false && result.priority !== "skip") {
      errors.push(`non-fit case ${caseId} must use priority skip.`);
    }
    if (result.attention_fit === false && Array.isArray(result.signals) && result.signals.length) {
      errors.push(`non-fit case ${caseId} must return empty signals.`);
    }
    if (!Array.isArray(result.signals)) {
      errors.push(`signals must be an array for ${caseId}.`);
      falseNegative += expected.expected_signals.length;
      continue;
    }

    const sourceMap = new Map(
      benchmarkCase.sources.map((source) => [source.source_id, source]),
    );
    const expectedKeys = new Set(expected.expected_signals.map(signalKey));
    const actualKeys = new Set();

    for (const signal of result.signals) {
      returnedSignals += 1;
      if (!signal || typeof signal.source_id !== "string") {
        errors.push(`A signal in ${caseId} is missing source_id.`);
        falsePositive += 1;
        continue;
      }
      const key = signalKey(signal);
      if (actualKeys.has(key)) {
        errors.push(`Duplicate signal ${key} in ${caseId}.`);
      }
      actualKeys.add(key);

      const source = sourceMap.get(signal.source_id);
      if (!source) {
        errors.push(`Unknown source_id ${signal.source_id} in ${caseId}.`);
      } else {
        if (signal.source_url !== source.url) {
          errors.push(`source_url mismatch for ${signal.source_id}.`);
        }
        if (
          typeof signal.evidence_quote === "string" &&
          signal.evidence_quote.length >= 10 &&
          source.text.includes(signal.evidence_quote)
        ) {
          evidenceExact += 1;
        } else {
          errors.push(`evidence_quote is not exact for ${signal.source_id}.`);
        }
      }
      if (
        typeof signal.confidence !== "number" ||
        signal.confidence < 0 ||
        signal.confidence > 1
      ) {
        errors.push(`confidence is invalid for ${signal.source_id}.`);
      }
    }

    for (const key of actualKeys) {
      if (expectedKeys.has(key)) truePositive += 1;
      else falsePositive += 1;
    }
    for (const key of expectedKeys) {
      if (!actualKeys.has(key)) falseNegative += 1;
    }
  }

  for (const caseId of resultMap.keys()) {
    if (!cases.has(caseId)) errors.push(`Unknown case_id ${caseId}.`);
  }
  if (results.length !== cases.size) {
    errors.push(`Expected ${cases.size} results, received ${results.length}.`);
  }

  const precision = ratio(truePositive, truePositive + falsePositive);
  const recall = ratio(truePositive, truePositive + falseNegative);
  const signalF1 =
    precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const evidenceExactness = ratio(evidenceExact, Math.max(returnedSignals, 1));
  const attentionFitAccuracy = ratio(fitCorrect, cases.size);
  const priorityAccuracy = ratio(priorityCorrect, cases.size);
  const weights = benchmark.scoring.quality_components;
  // Blend signal F1 into evidence/priority story via evidence component already;
  // priority_accuracy is the main decision metric.
  const qualityScore =
    weights.priority_accuracy * priorityAccuracy +
    weights.evidence_exactness * evidenceExactness * signalF1 +
    weights.attention_fit_accuracy * attentionFitAccuracy;

  return {
    schema_valid: errors.length === 0,
    priority_accuracy: priorityAccuracy,
    attention_fit_accuracy: attentionFitAccuracy,
    signal_precision: precision,
    signal_recall: recall,
    signal_f1: signalF1,
    evidence_exactness: evidenceExactness,
    quality_score: Number(qualityScore.toFixed(12)),
    expected_signals: truePositive + falseNegative,
    returned_signals: returnedSignals,
    errors,
  };
}

export async function scoreFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  return scoreDocument(JSON.parse(await fs.readFile(absolutePath, "utf8")));
}

const invokedAsScript =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invokedAsScript) {
  const filePath = process.argv[2] ?? "examples/perfect-output.json";
  const report = await scoreFile(filePath);
  console.log(JSON.stringify(report, null, 2));
  if (!report.schema_valid) process.exitCode = 1;
}
