import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_WORKFLOW_ID = "triage-v1";

export async function readJson(relativePath, root = ROOT) {
  return JSON.parse(await fs.readFile(path.join(root, relativePath), "utf8"));
}

export function resolveWorkflowId(scenarioMeta) {
  return scenarioMeta?.workflow_id || DEFAULT_WORKFLOW_ID;
}

export async function loadWorkflowContract(
  workflowId = DEFAULT_WORKFLOW_ID,
  readJsonFn = readJson,
) {
  return readJsonFn(`workflows/${workflowId}/contract.json`);
}

export async function contractForScenario(scenarioMeta, readJsonFn = readJson) {
  return loadWorkflowContract(resolveWorkflowId(scenarioMeta), readJsonFn);
}

export async function contractForScenarioId(scenarioId, readJsonFn = readJson) {
  const manifest = await readJsonFn("scenarios/manifest.json");
  const meta = manifest.scenarios.find((item) => item.id === scenarioId);
  if (!meta) {
    throw new Error(`Unknown scenario: ${scenarioId}`);
  }
  return contractForScenario(meta, readJsonFn);
}

export function benchmarkFromContract(contract) {
  return contract.benchmark;
}

export function qualityComponents(contract) {
  return contract.benchmark?.scoring?.quality_components || {};
}

export function metricKeysFromContract(contract) {
  return Object.keys(qualityComponents(contract));
}

export function oracleMeaning(contract) {
  return (
    contract.calibration?.oracle_meaning ||
    "Theoretical ceiling: perfect judgment on frozen ground truth for this workflow."
  );
}
