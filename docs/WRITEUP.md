# Picsou Router: thrifty attention routing with Gemma 4 E2B

**Track:** Context Engineering for SLMs  
**Hackathon:** [Paris Gemma 4 Hackathon](https://www.kaggle.com/competitions/paris-gemma-4-hackathon)  
**Repo:** https://github.com/ardjo-s/Picsou

## Problem

Analysts drown in open research and noisy lead feeds. The costly mistake is not
missing a paper—it is spending attention on the wrong one. Large models triage
well but are slow and expensive. Small models fail when context is messy.

## Solution

Picsou is a **context contract** plus eval harness. We **select** decision-bearing
fields, **structure** them into a strict JSON task, **compress** noise, inject
**distractors** (title traps, wrong geography, stale years), and require **exact
citations** as substrings of frozen source text.

Gemma 4 E2B (`gemma-4-e2b-it`) is the SLM under test. Light baselines (Ministral 3B,
DeepSeek 1.5B distill) and Grok 4.5 (market `reference_ceiling`: AA Intelligence
Index #4 / 54, Jul 2026; strong on Snorkel GDPval+ triage and cost/token Pareto;
not the hallucination leader) run on the same packed packet. An **Alien axis**
compares frozen baseline packets against Alien-enriched mirrors so judges see
whether extra context pays for itself in quality per token.

The product is not another chat UI. It answers: *which small model is enough,
and does Alien context justify its token cost?*

## How Gemma 4 is used

Gemma 4 E2B receives identical packed packets through OpenAI-compatible
endpoints (SGLang on NVIDIA Brev when live). Outputs must match a strict JSON
schema. Quotes must be exact substrings of source text. Invented citations fail
scoring. Gemma is essential: the entire benchmark scores structured triage on
packets engineered for SLM attention thrift.

Matrix mode runs three nightmare use cases (EU heat lineage, ICU protocol fork,
Track 3 jury adversarial): 4 models × Alien on/off = 24 fixture cells judges
reproduce without a GPU.

## Architecture and process

1. Freeze cases per scenario with fit labels and distractor snippets.
2. Pack only decision-bearing fields into the model message.
3. Run Gemma E2B and baselines on the same packet (fixture or live).
4. Score priority accuracy, attention-fit accuracy, signal F1, evidence
   exactness, plus token/cost/latency efficiency.
5. Emit calibration (oracle = 1.0, reference model, winner) and a valence reco
   per use case. See `docs/SCORE-GUIDE.md`.

Judges reproduce offline:

```bash
npm test
npm run evaluate:matrix
```

Live matrix (optional):

```bash
export PICSOU_ENDPOINT_GEMMA=http://127.0.0.1:30000/v1
export PICSOU_ENDPOINT_MISTRAL=http://127.0.0.1:30001/v1
export PICSOU_ENDPOINT_DEEPSEEK=http://127.0.0.1:30002/v1
npm run evaluate:matrix:live
```

## Demo (no login, no GPU)

Clone https://github.com/ardjo-s/Picsou and run `npm run evaluate:matrix`.
Full instructions: `docs/demo/JURY-DEMO.md`. Optional Cursor pitch: `/Picsou`
opens per-use-case canvas reports with prompts, tokens, and calibration graphs
(Cursor only; CLI stays the jury path).

## Challenges and choices

- **Fair comparison:** live web search would destroy parity; we freeze evidence.
  Alien packets are frozen mirrors in fixture mode, not live MCP during scoring.
- **Hallucination control:** exact-quote scoring over free-form summaries.
- **Track fit:** innovation is packing and eval, not fine-tuning in a sprint.
- **Honest confidence:** recommendations are labeled `demo-low` until live trials repeat.
- **Out of scope:** tool-call loops and reasoning-token efficiency are not scored
  (one-shot JSON triage only). See `docs/SCORE-GUIDE.md`.

## Impact

A policy analyst, consultant, or jury member gets a thrifty router: keep
high-signal items, skim adjacent work, skip traps. Context engineering turns
Gemma 4 E2B into a practical filter instead of a fragile chatbot. Alien
Intelligence enriches context; Picsou measures whether that enrichment is worth
the tokens for a given workflow and model.

## Links

- Public repo: https://github.com/ardjo-s/Picsou
- Demo: `docs/demo/JURY-DEMO.md` and `npm run evaluate:matrix`
- Score guide: `docs/SCORE-GUIDE.md`
- Competition: https://www.kaggle.com/competitions/paris-gemma-4-hackathon
