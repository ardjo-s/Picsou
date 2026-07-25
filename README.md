# Picsou Router

**Paris Gemma 4 Hackathon · Track 3 — Context Engineering for SLMs**

Picsou packs frozen OpenAIRE-style evidence, runs the same triage cases on
**Gemma 4 E4B** (via an OpenAI-compatible API) plus one larger Gemma baseline,
scores outputs deterministically, and recommends whether the small model is
enough.

> Empty or undocumented repos are ineligible. This repository is the public
> code + clonable offline demo judges can run without a GPU.

## One-liner

Sourced science attention triage: pack context → evaluate Gemma vs baseline →
one evidence-backed recommendation.

## Why this can win

| Rubric (100) | How Picsou hits it |
| --- | --- |
| Gemma Integration (30) | Gemma 4 E4B is the SLM under test; larger Gemma is baseline |
| Innovation & Impact (30) | Attention thrift for climate/air/energy analysts |
| Functionality (20) | `npm test` + `npm run evaluate:fixture` works offline |
| Presentation (20) | `docs/WRITEUP.md` (<1500 words) + architecture diagram |

## Quick start (judges)

Requires Node.js 20+. No API key for the offline demo.

```bash
npm test
npm run score -- examples/perfect-output.json
npm run evaluate:fixture
```

Expected perfect fixture quality score: `1.0`.

## Live Gemma 4

Serve Gemma 4 with SGLang, vLLM, or Ollama’s OpenAI API, then:

```bash
export OPENAI_BASE_URL=http://127.0.0.1:30000/v1
export OPENAI_API_KEY=EMPTY
npm run evaluate
```

Configured candidates live in `config/models.json`:

- `gemma-4-e4b-it` — SLM under test
- `gemma-4-26b-a4b-it` — larger baseline

## Layout

```text
workflow/     immutable benchmark + context-pack notes
config/       model candidates + dated pricing estimates
src/          context packer + evaluator CLI
scripts/      score + validate
examples/     perfect fixture
docs/         Kaggle writeup draft + architecture
test/         node:test coverage for pack + fixture eval
```

## Submission checklist

1. Public GitHub repo (this one) — no login wall
2. Kaggle Writeup from `docs/WRITEUP.md` (submit before deadline)
3. Demo attachment: fixture CLI output and/or live endpoint recording
4. State the track: **Context Engineering for SLMs**

Writeup URL to create:  
https://www.kaggle.com/competitions/paris-gemma-4-hackathon/writeups

## Accuracy boundary

Frozen demo corpus. Not live OpenAIRE discovery. Recommendation confidence is
always `demo-low` until the case set grows and trials repeat.

## License

MIT
