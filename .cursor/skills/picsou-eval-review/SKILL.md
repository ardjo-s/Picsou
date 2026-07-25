---
name: picsou-eval-review
description: >-
  Explain in depth the custom eval methodology for a Picsou workflow defined
  via /picsou-grill, /picsou-grill-auto, or run via /Picsou: packing, frozen
  parity, exact-quote scoring, thrift matrix, Alien lift, calibration. Use when
  the user says /picsou-eval-review, /piscou-eval-review, asks how the eval was
  built, or wants a deep method review of a scenario.
---

# /picsou-eval-review

Deep-dive the **custom eval build** for a Picsou workflow. Prefer short sections
with exact repo vocabulary and file paths. Do not claim live Alien MCP or live
GPU runs unless this session actually ran them.

## When invoked

1. Identify the workflow under review:
   - Explicit scenario id, or
   - Latest grill / grill-auto brief in chat, or
   - Default: all entries in `scenarios/manifest.json` (+ legacy `workflow/` if asked)
2. Read the vertical folder before explaining:
   - `scenarios/<id>/prompt.md`
   - `cases.json` / `cases.alien.json`
   - `ground-truth.json`
   - `perfect-output.json`
   - `fixture-behavior.json` (if present)
   - Shared contract: `workflow/benchmark.json`, `workflow/output.schema.json`
   - Code: `src/context.mjs`, `scripts/score.mjs`, `src/score-lib.mjs`,
     `src/matrix.mjs`, `src/calibration.mjs`
3. Explain **this** workflow’s eval end-to-end (sections below). Tie every claim
   to a file or formula. Mark unknowns `TBD`.
4. End with a compact **Eval review card** (template at bottom) + one next action
   (`/Picsou`, scaffold, or fix a trap).

Related skills:
- Design: `/picsou-grill` or `/picsou-grill-auto`
- Run matrix: `/Picsou`
- Public README messaging: `/picsou-readme`

---

## 0. What this eval measures (and does not)

Picsou scores **structured attention triage** on a **frozen evidence packet**.

It answers:

> Which SLM is enough for this workflow — and does Alien (or any) extra context
> pay for itself per token?

It does **not** measure: open chat quality, live tool-calling agents, LMSYS /
AA Intelligence Index, human production usefulness beyond the frozen contract,
or live OpenAIRE / Alien MCP harvests during scoring.

`1.0` = **oracle** on this scenario’s ground truth (perfect JSON triage + exact
quotes), not general intelligence.

---

## 1. From grill brief → eval artifact

Whether the workflow came from `/picsou-grill`, `/picsou-grill-auto`, or an
existing `/Picsou` scenario, the eval is the same shape:

| Grill field | Becomes |
| --- | --- |
| `actor` / `decision` / `error_cost` | `researcher_profile` + triage labels in `prompt.md` |
| `candidate_unit` / `fields` / `source_family` | case + source schema in `cases.json` |
| `freeze: yes` | offline packet only; no live web in the score path |
| `distractors` | trap cases + (optional) `fixture-behavior.json` mutations |
| `alien_enrichment` | mirror packet `cases.alien.json` (same case_ids, richer sources) |
| `hardness` | nightmare / normal / hard; drives trap density |
| `models` / `mode` | matrix candidates × fixture|live |

**Required vertical files** under `scenarios/<id>/`:

```text
prompt.md
cases.json
cases.alien.json          # if Alien axis is on
ground-truth.json
perfect-output.json
fixture-behavior.json     # fixture scripted fails (nightmare)
```

Register the id in `scenarios/manifest.json`. Legacy single-workflow path still
lives under `workflow/` (same scoring contract).

---

## 2. Context contract (packing) — Track 3 lever

Before any model runs, `src/context.mjs` `packContext()` builds the exact user
message:

1. **Select** — keep decision-bearing fields (`title`, `year`, `topics`,
   `access`, `openaire_id`, sources); drop noise.
2. **Structure** — addressable `case_id` + `source_id` / `url` / `text`.
3. **Compress** — JSON packet + short system prompt from `prompt.md`.
4. **Distract** — traps live in frozen source text (wrong geo, stale year, title
   bait, superseded DOI, keyword glitter).
5. **Ground** — every later `evidence_quote` must be an **exact substring** of
   some `source.text` (`scripts/score.mjs`).

Same packed user message is what SLM, baselines, and reference ceiling see
(Alien on vs off only changes which cases file was packed).

---

## 3. Frozen parity & Alien axis

- **Alien off:** `cases.json`
- **Alien on:** `cases.alien.json` — mirror cases with enrichment (lineage,
  related works, extra sources). Not a live MCP call at score time.
- Matrix axis comes from `scenarios/manifest.json` → `alien_axis: [false, true]`.
- Fair A/B: same `case_id`s, same ground truth, same scorer; only the packed
  evidence differs.

Never claim “live Alien” unless a harvest actually ran in-session and wrote a
new frozen packet.

---

## 4. Model output contract

Models must return structured JSON (see `workflow/output.schema.json`):

- `workflow_version` must match the cases document
- Per case: `case_id`, `title`, `attention_fit` (bool), `priority`
  (`high` | `medium` | `skip`), `signals[]`
- Each signal: `source_id`, `source_url`, `signal_type`, `evidence_quote`,
  `confidence`
- Hard rules enforced by scorer:
  - `attention_fit === false` → `priority` must be `skip` and `signals` empty
  - `evidence_quote` length ≥ 10 and exact substring of frozen `source.text`
  - `source_url` must match the packed source

`perfect-output.json` is the hand-authored oracle payload for this scenario.

---

## 5. Deterministic quality scoring

`scripts/score.mjs` `scoreDocument()` compares model output to
`ground-truth.json` + cases.

Per-case checks → aggregates:

| Metric | Meaning |
| --- | --- |
| `priority_accuracy` | share of cases with correct `priority` |
| `attention_fit_accuracy` | share with correct `attention_fit` |
| `signal_f1` | F1 on `source_id::signal_type` keys vs expected signals |
| `evidence_exactness` | share of returned signals whose quote is exact |

Weights from `workflow/benchmark.json` → `scoring.quality_components`:

```text
quality = 0.55 × priority_accuracy
        + 0.30 × evidence_exactness × signal_f1
        + 0.15 × attention_fit_accuracy
```

- `schema_valid` = zero hard errors (mismatches, invented quotes, bad enums…)
- Floor: `minimum_quality_to_recommend` = **0.75** (ineligible below)

Explain a low score in workflow terms: e.g. ~0.45 often = quotes OK, priorities
wrong on traps.

---

## 6. Thrift matrix (model × Alien)

`src/matrix.mjs` runs each scenario × each candidate in `config/models.json`:

| Role | Demo id |
| --- | --- |
| `slm_under_test` | `gemma-4-e2b-it` |
| `larger_baseline` | `ministral-3b-instruct` |
| `external_control` | `deepseek-r1-distill-qwen-1.5b` |
| `reference_ceiling` | `grok-4.5` |

× Alien off/on → cells with quality, tokens, latency, estimated cost.

**Fixture mode** (`npm run evaluate:matrix`, default `--fixture`): no GPU/login.
Uses `perfect-output.json` + `fixture-behavior.json` mutations to script role ×
Alien failures (deterministic offline story). Optional `--trials N` adds
deterministic mutation noise for variance.

**Live mode** (`evaluate:matrix:live`): OpenAI-compatible endpoints
(`PICSOU_ENDPOINT_*`). Only claim live if endpoints were hit this session.

**Alien lift** (per model):  
`delta_quality = quality_with_alien − quality_without_alien`  
(+ token deltas). Enrichment is measured, never assumed helpful.

---

## 7. Recommendation & calibration

`src/score-lib.mjs` `rankResults()`:

Eligible only if: `schema_valid` ∧ `quality ≥ 0.75` ∧ finite cost/latency/tokens.

Composite (relative within the scenario run), weights from
`recommendation_components`:

```text
composite = 0.55×quality
          + 0.20×(bestCost / cost)
          + 0.15×(bestLatency / latency)
          + 0.10×(bestTokens / tokens)
```

Tie-break: quality → lower quality stdev (trials) → fewer tokens → lower cost →
lower latency.

`src/calibration.mjs` emits per scenario:

| Anchor | Meaning |
| --- | --- |
| **Oracle** | `perfect-output.json` scored → theoretical ceiling (~1.0) |
| **Reference model** | best cell for `reference_ceiling` (demo: Grok 4.5) |
| **Winner** | best eligible thrift cell (often Gemma ± Alien) |

Confidence labels:

| Label | When |
| --- | --- |
| `demo-low` | fixture, or &lt;2 trials, or frozen corpus only |
| `low` | live, ≥2 trials, quality stdev ≤ 0.05 |
| `medium` | live, ≥5 trials, quality stdev ≤ 0.03, all cells completed |
| `high` | live, ≥10 trials, quality stdev ≤ 0.02, all cells completed |

---

## 8. How to narrate a workflow-specific review

Walk this order for the chosen scenario:

1. **Job** — actor, decision, cost of error (from prompt / grill brief)
2. **Packet** — what was selected/compressed; which distractors were planted
3. **Alien mirror** — what enrichment was added; expected lift hypothesis
4. **Oracle** — what perfect JSON asserts (`ground-truth` + `perfect-output`)
5. **Fixture script** — which roles fail which traps off vs on (`fixture-behavior`)
6. **Matrix reading** — winner, Alien lift, tokens/cost vs reference ceiling
7. **Honesty** — confidence label; what this eval does **not** prove

If no matrix run exists yet, stop after step 5 and propose `/Picsou`.

---

## Eval review card (always emit)

```text
scenario_id: 
origin: grill | grill-auto | existing-picsou
actor / decision: 
hardness: nightmare|normal|hard
packet: cases.json (+ cases.alien.json: yes|no)
distractors: 
alien_hypothesis: 
scoring: quality = 0.55·priority + 0.30·(exact×F1) + 0.15·fit; floor 0.75
matrix: gemma + baselines + reference_ceiling × alien off/on
mode_last_run: fixture|live|none
oracle_quality: 
reference_best: 
winner: 
alien_lift (gemma): 
confidence: 
does_not_prove: 
next: /Picsou | scaffold | edit traps
```
