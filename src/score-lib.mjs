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

/** Normalize usage into evaluation token metrics. */
export function summarizeTokens(usage) {
  if (!usage) {
    return {
      input_tokens: null,
      output_tokens: null,
      cached_tokens: null,
      total_tokens: null,
    };
  }
  const input_tokens = Number(usage.input_tokens) || 0;
  const output_tokens = Number(usage.output_tokens) || 0;
  const cached_tokens = Number(usage.input_tokens_details?.cached_tokens) || 0;
  return {
    input_tokens,
    output_tokens,
    cached_tokens,
    total_tokens: input_tokens + output_tokens,
  };
}

/** Mean/min/max/stdev for a numeric series. */
export function aggregateNumericStats(values) {
  const nums = (values || []).filter(Number.isFinite);
  if (!nums.length) return null;
  const mean = nums.reduce((sum, value) => sum + value, 0) / nums.length;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const variance =
    nums.length > 1
      ? nums.reduce((sum, value) => sum + (value - mean) ** 2, 0) / nums.length
      : 0;
  return {
    mean: Number(mean.toFixed(6)),
    min: Number(min.toFixed(6)),
    max: Number(max.toFixed(6)),
    stdev: Number(Math.sqrt(variance).toFixed(6)),
  };
}

/** Aggregate trial runs for one matrix cell. */
export function aggregateTrialRuns(runs, { requested } = {}) {
  const completed = (runs || []).filter((run) => run.status === "completed");
  const composites = completed
    .map((run) => run.composite_score)
    .filter(Number.isFinite);
  return {
    requested: requested ?? runs?.length ?? 0,
    completed: completed.length,
    quality_score: aggregateNumericStats(
      completed.map((run) => run.score?.quality_score),
    ),
    composite_score: aggregateNumericStats(composites),
    latency_ms: aggregateNumericStats(completed.map((run) => run.latency_ms)),
    tokens: {
      total_tokens: aggregateNumericStats(
        completed.map((run) => run.tokens?.total_tokens),
      ),
      input_tokens: aggregateNumericStats(
        completed.map((run) => run.tokens?.input_tokens),
      ),
      output_tokens: aggregateNumericStats(
        completed.map((run) => run.tokens?.output_tokens),
      ),
    },
  };
}

/** Sum token metrics across completed cells (one workflow / scenario). */
export function aggregateTokens(cells) {
  const completed = (cells || []).filter(
    (cell) => cell.status === "completed" && cell.tokens,
  );
  const sum = {
    input_tokens: 0,
    output_tokens: 0,
    cached_tokens: 0,
    total_tokens: 0,
    cell_count: completed.length,
  };
  for (const cell of completed) {
    sum.input_tokens += cell.tokens.input_tokens || 0;
    sum.output_tokens += cell.tokens.output_tokens || 0;
    sum.cached_tokens += cell.tokens.cached_tokens || 0;
    sum.total_tokens += cell.tokens.total_tokens || 0;
  }
  return sum;
}

export function rankResults(results, workflow) {
  const successful = results.filter((item) => item.status === "completed");
  const costs = successful
    .map((item) => item.estimated_cost_usd)
    .filter(Number.isFinite);
  const latencies = successful
    .map((item) => item.latency_ms)
    .filter(Number.isFinite);
  const totals = successful
    .map((item) => item.tokens?.total_tokens)
    .filter((n) => Number.isFinite(n) && n > 0);
  const bestCost = Math.min(...costs);
  const bestLatency = Math.min(...latencies);
  const bestTokens = totals.length ? Math.min(...totals) : null;
  const minQuality = workflow.benchmark.scoring.minimum_quality_to_recommend;
  const weights = workflow.benchmark.scoring.recommendation_components;
  const tokenWeight = Number(weights.token_efficiency) || 0;
  const baseWeight =
    (Number(weights.quality) || 0) +
    (Number(weights.cost_efficiency) || 0) +
    (Number(weights.latency_efficiency) || 0) +
    tokenWeight;

  for (const item of successful) {
    if (!item.tokens) item.tokens = summarizeTokens(item.usage);
    item.eligible =
      item.score.schema_valid &&
      item.score.quality_score >= minQuality &&
      Number.isFinite(item.estimated_cost_usd) &&
      Number.isFinite(item.latency_ms) &&
      item.usage != null &&
      Number.isFinite(item.tokens.total_tokens);
    item.ineligible_reasons = [
      !item.score.schema_valid && "invalid structured output",
      item.score.quality_score < minQuality && `quality below ${minQuality}`,
      !Number.isFinite(item.estimated_cost_usd) && "missing pricing",
      !item.usage && "missing usage",
      !Number.isFinite(item.tokens?.total_tokens) && "missing tokens",
    ].filter(Boolean);

    if (!item.eligible || !baseWeight) {
      item.composite_score = null;
      continue;
    }

    const tokenTerm =
      tokenWeight > 0 && bestTokens
        ? tokenWeight * (bestTokens / item.tokens.total_tokens)
        : 0;
    item.composite_score = Number(
      (
        (weights.quality || 0) * item.score.quality_score +
        (weights.cost_efficiency || 0) *
          (bestCost / item.estimated_cost_usd) +
        (weights.latency_efficiency || 0) *
          (bestLatency / item.latency_ms) +
        tokenTerm
      ).toFixed(12),
    );
  }

  successful.sort(
    (a, b) =>
      (b.composite_score ?? -1) - (a.composite_score ?? -1) ||
      b.score.quality_score - a.score.quality_score ||
      (a.trials?.quality_score?.stdev ?? Infinity) -
        (b.trials?.quality_score?.stdev ?? Infinity) ||
      (a.tokens?.total_tokens ?? Infinity) - (b.tokens?.total_tokens ?? Infinity) ||
      (a.estimated_cost_usd ?? Infinity) - (b.estimated_cost_usd ?? Infinity) ||
      a.latency_ms - b.latency_ms,
  );
  return successful;
}
