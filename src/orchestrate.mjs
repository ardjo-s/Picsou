import { runEvalMatrix } from "./matrix.mjs";

/**
 * Gemma orchestrates Picsou: pick demo scenarios and run the eval matrix.
 * MVP fixture path does not call a live Gemma tool-router yet — it is the
 * named orchestration entrypoint judges/agents invoke.
 */
export async function orchestratePicsouDemo({
  fixture = true,
  scenarioId = null,
} = {}) {
  const report = await runEvalMatrix({ fixture, scenarioId });
  return {
    ...report,
    orchestrator: "gemma",
    action: "run_picsou_eval_matrix",
  };
}
