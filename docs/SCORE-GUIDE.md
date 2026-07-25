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

## Market anchors for “100%” (July 2026)

Oracle `1.0` is the **task contract** ceiling (perfect JSON triage on frozen sources). For jury talk, map each Picsou component to who currently owns that capability on the open market — then use **Grok 4.5** as the demo `reference_ceiling` because it is frontier-class on the axes that matter most for this thrift story:

| Picsou criterion | Market “100%” reference (Jul 2026) | Why Grok 4.5 for the demo |
| --- | --- | --- |
| `priority_accuracy` / `attention_fit` | **Grok 4.5** — Snorkel GDPval+ mean pass 29% vs GPT-5.5 22% / Opus 4.8 21%; AA GDPval-AA Elo 1543 | Best independent professional-triage signal among published frontier runs |
| `evidence_exactness` / grounded quotes | **Claude Fable 5 / Opus 4.8** — careful writing; Grok AA Omniscience hallucination **54%** (up from 25% on 4.3) | Grok is **not** the hallucination leader; Picsou still forces exact substrings so fixture Grok can hit oracle on this contract |
| `signal_f1` (structured extraction) | **Fable 5** (peak coding/agentic) / Opus on neutral SWE harnesses | Grok trades blows (Terminal-Bench 83.3%, SWE-Bench Pro 64.7% behind Opus 69.2% / Fable 80.3%) |
| Cost / token efficiency | **Grok 4.5** — AA Pareto; ~14k out tokens/task vs Opus ~4× more; API $2/$6 vs Opus $5/$25 | Demo pricing uses docs.x.ai rates |
| Overall intelligence index | **Fable 5** > Opus 4.8 (56) > GPT-5.5 (55) > **Grok 4.5 (54, #4)** | Grok is frontier, not absolute #1 — honest label is `reference_ceiling`, not “best model ever” |

Sources: [Artificial Analysis Grok 4.5](https://artificialanalysis.ai/articles/grok-4-5-brings-spacexai-to-the-the-intelligence-frontier), [Snorkel GDPval+](https://snorkel.ai/blog/grok-4-5-testing-results-how-spacexais-new-model-performs-on-real-professional-work/), [docs.x.ai pricing](https://docs.x.ai/developers/grok-4-5).

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
| **Reference model** | Best cell for configured `reference_ceiling` (demo: **Grok 4.5**, market frontier on triage + cost) |
| **Winner** | Best eligible cell on quality × cost × latency × tokens |

Fixture demo intent: Grok sits **near oracle** on packed packets; Gemma 4 E2B + Alien **matches that quality** at far lower cost → thrift win. DeepSeek stays the weak `external_control`.

See [DEMO-REFERENCE-GROK.md](DEMO-REFERENCE-GROK.md) for hackathon framing, bias analysis, and the Cursor live path.

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
- General LMSYS / AA Intelligence Index scores (those only anchor the reference model choice)

Verify the oracle locally:

```bash
npm run score -- examples/perfect-output.json
npm run evaluate:matrix -- --trials 3
```
