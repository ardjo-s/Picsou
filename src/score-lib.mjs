export function estimateCost(usage, price) {
  if (!usage || !price) return null;
  const cached = usage.input_tokens_details?.cached_tokens || 0;
  const uncached = Math.max(0, (usage.input_tokens || 0) - cached);
  return Number(
    (
      (uncached * price.input +
        cached * price.cached_input +
        (usage.output_tokens || 0) * price.output) /
      1e6
    ).toFixed(8),
  );
}

export function rankResults(results, workflow) {
  const successful = results.filter((item) => item.status === "completed");
  const costs = successful
    .map((item) => item.estimated_cost_usd)
    .filter(Number.isFinite);
  const latencies = successful
    .map((item) => item.latency_ms)
    .filter(Number.isFinite);
  const bestCost = Math.min(...costs);
  const bestLatency = Math.min(...latencies);
  const minQuality = workflow.benchmark.scoring.minimum_quality_to_recommend;
  const weights = workflow.benchmark.scoring.recommendation_components;

  for (const item of successful) {
    item.eligible =
      item.score.schema_valid &&
      item.score.quality_score >= minQuality &&
      Number.isFinite(item.estimated_cost_usd) &&
      Number.isFinite(item.latency_ms) &&
      item.usage != null;
    item.ineligible_reasons = [
      !item.score.schema_valid && "invalid structured output",
      item.score.quality_score < minQuality && `quality below ${minQuality}`,
      !Number.isFinite(item.estimated_cost_usd) && "missing pricing",
      !item.usage && "missing usage",
    ].filter(Boolean);
    item.composite_score = item.eligible
      ? Number(
          (
            weights.quality * item.score.quality_score +
            weights.cost_efficiency * (bestCost / item.estimated_cost_usd) +
            weights.latency_efficiency * (bestLatency / item.latency_ms)
          ).toFixed(12),
        )
      : null;
  }

  successful.sort(
    (a, b) =>
      (b.composite_score ?? -1) - (a.composite_score ?? -1) ||
      b.score.quality_score - a.score.quality_score ||
      (a.estimated_cost_usd ?? Infinity) - (b.estimated_cost_usd ?? Infinity) ||
      a.latency_ms - b.latency_ms,
  );
  return successful;
}
