/**
 * Map logical candidate ids → provider-facing model ids.
 * SGLang serves Hugging Face paths like google/gemma-4-E4B-it.
 */
export function candidateApiId(model) {
  if (model?.role === "slm_under_test") {
    if (process.env.PICSOU_GEMMA_E2B_MODEL && String(model.id || "").includes("e2b")) {
      return process.env.PICSOU_GEMMA_E2B_MODEL;
    }
    if (process.env.PICSOU_GEMMA_E4B_MODEL) {
      return process.env.PICSOU_GEMMA_E4B_MODEL;
    }
  }
  if (
    model?.role === "larger_baseline" &&
    process.env.PICSOU_GEMMA_BASELINE_MODEL
  ) {
    return process.env.PICSOU_GEMMA_BASELINE_MODEL;
  }
  if (
    (model?.role === "external_control" || model?.id?.includes("grok")) &&
    process.env.PICSOU_GROK_MODEL
  ) {
    return process.env.PICSOU_GROK_MODEL;
  }
  if (typeof model?.api_id === "string" && model.api_id.trim()) {
    return model.api_id.trim();
  }
  return model.id;
}

export function matchAccessibleId(apiId, accessible) {
  if (!(accessible instanceof Set) || !apiId) return null;
  if (accessible.has(apiId)) return apiId;

  const normalize = (value) =>
    String(value)
      .toLowerCase()
      .replace(/^google\//, "")
      .replace(/[^a-z0-9]+/g, "");

  const needle = normalize(apiId);
  for (const id of accessible) {
    const hay = normalize(id);
    if (hay === needle || hay.endsWith(needle) || needle.endsWith(hay)) {
      return id;
    }
  }
  return null;
}
