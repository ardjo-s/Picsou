# Picsou Router: thrifty science attention with Gemma 4 E4B

**Track:** Context Engineering for SLMs  
**Hackathon:** [Paris Gemma 4 Hackathon](https://www.kaggle.com/competitions/paris-gemma-4-hackathon)

## Problem

Policy analysts drown in open research. The costly mistake is not “missing a
transformer paper”—it is spending attention on the wrong paper. Large models
can triage, but they are slow and expensive to run for every alert. Small
models fail when the context is messy.

## Solution

Picsou packs frozen OpenAIRE-style evidence, asks Gemma 4 E4B to triage the
same cases as a larger Gemma baseline, then scores both deterministically.
The product is not another chat UI. It is a **context contract** that makes
the small model enough: select, structure, compress, and force exact-evidence
citations.

## How Gemma 4 is used

Gemma 4 is load-bearing. `gemma-4-e4b-it` is the SLM under test. A larger
Gemma 4 MoE candidate (`gemma-4-26b-a4b-it`) is the baseline. Both receive the
identical packed packet through an OpenAI-compatible endpoint (SGLang, vLLM,
or Ollama). Outputs must match a strict JSON schema. Quotes must be exact
substrings of frozen source text. Invented citations fail.

## Architecture and process

1. Freeze five research cases with fit and distractor snippets.
2. Pack only decision-bearing fields into the model message.
3. Run Gemma 4 E4B and the baseline on the same packet.
4. Score priority accuracy, attention-fit accuracy, signal F1, and evidence
   exactness.
5. Recommend with a composite of quality, estimated cost, and latency.

Judges can reproduce the offline path with no GPU:

```bash
npm test
npm run evaluate:fixture
```

Live path:

```bash
export OPENAI_BASE_URL=http://127.0.0.1:30000/v1
export OPENAI_API_KEY=EMPTY
npm run evaluate
```

## Challenges and choices

- **Fair comparison:** live web search would destroy parity. We froze evidence.
- **Hallucination control:** exact-quote scoring over free-form summaries.
- **Track fit:** the innovation is packing, not fine-tuning weights in an
  eight-hour sprint.
- **Honest confidence:** recommendations are labeled `demo-low` (five cases,
  one trial).

## Impact

A climate/air-quality analyst gets a thrifty router: keep high-signal European
heat and pollution papers, skim adjacent grid-PV work, skip pure LLM benchmarks
and crypto-mining profitability studies. Context engineering turns Gemma 4 E4B
into a practical filter instead of a fragile chatbot.

## Links

- Public repo: attach GitHub URL in the Kaggle Writeup attachments
- Demo: `npm run evaluate:fixture` or a live SGLang Gemma endpoint
- Competition: https://www.kaggle.com/competitions/paris-gemma-4-hackathon
