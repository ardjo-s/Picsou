# How to read Picsou scores

Picsou scores **structured triage** on a **frozen evidence packet**, not general intelligence.

## Quality score (0 to 1)

**1.0 = oracle.** The scenario’s `perfect-output.json` scores 1.0 when checked against `ground-truth.json`. That is the theoretical ceiling: every case gets the correct `attention_fit`, `priority`, expected signals, and every `evidence_quote` is an exact substring of the frozen source text.

**Below 1.0** means partial correctness on this benchmark only. Example: 0.47 often means citations are fine but priorities are wrong.

Formula (weights from `workflow/benchmark.json`):

```
quality = 0.55 × priority_accuracy
        + 0.30 × evidence_exactness × signal_f1
        + 0.15 × attention_fit_accuracy
```

**0.75** is the minimum `quality_score` required before a cell can be recommended.

## Composite score (relative)

Composite ranks eligible cells by mixing:

- quality (55%)
- cost efficiency (20%)
- latency efficiency (15%)
- token efficiency (10%)

Composite is **relative within a scenario run**, not an absolute “out of 1” grade.

## Calibration block

Each matrix scenario report includes:

| Reference | Meaning |
| --- | --- |
| **Oracle** | Perfect output on frozen ground truth (= 1.0 ceiling) |
| **Reference model** | Best cell for the configured `reference_ceiling` model (empirical strong baseline) |
| **Winner** | Best eligible cell on quality × cost × latency × tokens |

## Tokens

Reports record input, output, cached, and total tokens per cell. The canvas shows totals in the ranking table and Alien on/off token deltas.

## Repeated trials

Use `--trials N` on the matrix CLI. Each cell runs N times; the report aggregates mean, min, max, and standard deviation for quality, latency, and tokens.

Confidence labels:

| Label | When |
| --- | --- |
| `demo-low` | Fixture mode, or fewer than 2 trials, or frozen corpus only |
| `low` | Live, ≥2 trials, quality stdev ≤ 0.05 |
| `medium` | Live, ≥5 trials, quality stdev ≤ 0.03, all cells completed |

Fixture trials use deterministic mutation noise so offline demos still show variance.

## What Picsou does not measure

- Live OpenAIRE / Alien MCP tool calls
- Reasoning-chain efficiency
- Human judgment or production usefulness beyond this frozen contract

Verify the oracle locally:

```bash
npm run score -- examples/perfect-output.json
npm run evaluate:matrix -- --trials 3
```
