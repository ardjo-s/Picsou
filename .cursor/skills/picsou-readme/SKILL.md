---
name: picsou-readme
description: >-
  Write or refresh the public Picsou README from the method pillars: packing,
  exact-evidence scoring, Alien on/off thrift matrix, oracle vs reference
  ceiling, honest fit boundaries. Use when the user says /picsou-readme,
  /piscou-readme, or asks to update README messaging.
---

# /picsou-readme

Author or refresh **`README.md`** (public product surface) using the Picsou
method. Prefer short sections. Use repo vocabulary.

Do not claim live Alien MCP or live GPU runs unless this session actually ran them.

## When invoked

1. Read current `README.md` (+ `docs/demo/README.md` if touching demo steps).
2. Align messaging with the **method pillars** below (do not invent a new product story).
3. Edit only what drifted; keep install/run commands truthful to `package.json`.
4. Chat summary: list sections changed in one short bullet list — no essay.

Default target: repo-root `README.md`. Touch `docs/demo/README.md` only if the
user asks or demo steps are wrong.

## One-liner (must survive in README)

Pack decision-bearing context → run the same triage on SLM vs baselines × Alien
on/off → score exact-quote JSON → recommend the cheapest model that still hits
quality.

## Method pillars (README source of truth)

### 1. Attention, not chat

Picsou optimizes **who/what deserves attention**, not open-ended conversation.
The model outputs a structured triage object (fit, priority, signals, evidence),
not a free-form essay.

### 2. Context contract (packing)

Before the model runs:

1. **Select** — keep fields that change the decision; drop noise.
2. **Structure** — addressable cases/sources (`source_id`).
3. **Compress** — normalize claims into short decision-bearing text.
4. **Distract deliberately** — inject traps (wrong geography, stale years,
   title bait) so packing skill is visible.
5. **Ground** — every `evidence_quote` must be an **exact substring** of frozen
   source text. Invented citations fail.

Track 3-shaped work: **context engineering for SLMs**, not fine-tuning in a weekend.

### 3. Frozen parity

Jury / offline path freezes evidence packets. Alien-enriched packets are
**mirrors** for A/B (`cases.json` vs `cases.alien.json`), not live tool calls
during scoring. That keeps model × Alien comparisons fair.

### 4. Deterministic scoring

Quality mixes (weights in the benchmark contract):

- priority accuracy (largest weight)
- evidence exactness × signal F1
- attention-fit accuracy

`1.0` = **oracle** on that frozen ground truth — perfect structured triage —
not “general intelligence.” Cells below the recommend floor (typically 0.75)
cannot win.

### 5. Thrift matrix

For each use case, run candidates (Gemma 4 E2B under test, light baselines,
optional frontier `reference_ceiling`) × Alien off/on. Rank eligible cells by:

- quality
- cost efficiency
- latency efficiency
- token efficiency

Emit calibration: **oracle** | **reference model** | **winner**, plus Alien lift
when enrichment helps. Confidence stays `demo-low` for fixture / single-trial
runs until live repeats.

### 6. Product question the method answers

> Which SLM is enough — and does Alien (or any) extra context pay for itself
> per token?

## What the README must not claim

- Not a general agent loop / tool-calling benchmark
- Not LMSYS / “best model overall”
- Not a guarantee that enrichment always helps
- Not unlimited workflow shape — see fit below

## Workflow fit (honest boundary)

**Good fit:** triage / ranking / keep-skim-skip over a bag of candidates with
citable text evidence (papers, leads, protocols, tickets).

**Poor fit:** creative writing, multi-step tool agents, UI chat, tasks without
freezable ground truth or exact-quote evidence.

Related skills: `/picsou-grill` or `/picsou-grill-auto` to design a workflow;
`/Picsou` to run the matrix demo; `/picsou-eval-review` for deep eval methodology.

## Pitch-ready paragraph (optional README / spoken)

> Analysts drown in candidates. Frontier models triage well but do not scale on
> cost. Small models fail on messy context. Picsou packs the decision fields,
> forces exact evidence, and measures whether Gemma 4 E2B — with or without
> richer Alien context — matches a frontier ceiling at thrift cost. The output
> is a recommendation, not another chat UI.

## README section checklist

When rewriting, keep these blocks (order flexible):

1. What Picsou is (one-liner + attention not chat)
2. Why / who / user value
3. How it works (packing → matrix → score → recommend)
4. How to use (fixture first; live optional)
5. Demo / calibration honesty (`demo-low` until live repeats)
6. Layout + license
