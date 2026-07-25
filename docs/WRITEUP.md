# Picsou Router: thrifty attention routing with Gemma 4 E2B

**Track:** Context Engineering for SLMs  
**Hackathon:** [Paris Gemma 4 Hackathon](https://www.kaggle.com/competitions/paris-gemma-4-hackathon)

## Problem

Analysts drown in open research and noisy lead feeds. The costly mistake is not
missing a paper—it is spending attention on the wrong one. Large models triage
well but are slow and expensive. Small models fail when context is messy.

## Solution

Picsou is a **context contract** plus eval harness: select, structure,
compress, add distractors, and force exact-evidence citations. Gemma 4 E2B
(`gemma-4-e2b-it`) is the SLM under test. Light baselines (Ministral 3B,
DeepSeek 1.5B distill) run on the same packed packet. An Alien axis compares
frozen baseline packets against Alien-enriched mirrors.

The product is not another chat UI. It answers: *which small model is enough,
and does Alien context pay for itself in quality per token?*

## How Gemma 4 is used

Gemma 4 E2B receives identical packed packets through OpenAI-compatible
endpoints (SGLang on NVIDIA Brev in our live setup). Outputs must match a
strict JSON schema. Quotes must be exact substrings of source text. Invented
citations fail scoring.

Matrix mode runs three nightmare use cases (heat lineage, ICU fork, Track 3
adversarial): 4 models × Alien on/off = 24 fixture cells judges can reproduce
without a GPU.

## Architecture and process

1. Freeze cases per scenario with fit labels and distractor snippets.
2. Pack only decision-bearing fields into the model message.
3. Run Gemma E2B and baselines on the same packet (fixture or live).
4. Score priority accuracy, attention-fit accuracy, signal F1, evidence
   exactness, plus token/cost/latency efficiency.
5. Recommend with a composite score per use case.

Judges reproduce offline:

```bash
npm test
npm run evaluate:fixture
npm run evaluate:matrix
```

Live matrix (optional):

```bash
export PICSOU_ENDPOINT_GEMMA=http://127.0.0.1:30000/v1
export PICSOU_ENDPOINT_MISTRAL=http://127.0.0.1:30001/v1
export PICSOU_ENDPOINT_DEEPSEEK=http://127.0.0.1:30002/v1
npm run evaluate:matrix:live
```

## Challenges and choices

- **Fair comparison:** live web search would destroy parity; we freeze evidence.
- **Hallucination control:** exact-quote scoring over free-form summaries.
- **Track fit:** innovation is packing and eval, not fine-tuning in a sprint.
- **Honest confidence:** recommendations are labeled `demo-low`.

## Impact

A policy analyst, consultant, or jury member gets a thrifty router: keep
high-signal items, skim adjacent work, skip traps. Context engineering turns
Gemma 4 E2B into a practical filter instead of a fragile chatbot.

## Links

- Public repo: attach GitHub URL in the Kaggle Writeup attachments
- Demo: `npm run evaluate:matrix` (fixture) or live Brev endpoints
- Competition: https://www.kaggle.com/competitions/paris-gemma-4-hackathon
