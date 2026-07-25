# Picsou Router

**Paris Gemma 4 Hackathon · Track 3 — Context Engineering for SLMs**

Picsou packs frozen evidence packets, runs triage on **Gemma 4 E2B** plus light
baselines (Ministral, DeepSeek), scores outputs deterministically, and
recommends the cheapest model that still hits quality — with or without Alien
context.

> Empty or undocumented repos are ineligible. This repository is the public
> code + clonable offline demo judges can run without a GPU.

## One-liner

Pack context → matrix eval (model × Alien) → one evidence-backed recommendation
per use case.

## Why this can win

| Rubric (100) | How Picsou hits it |
| --- | --- |
| Gemma Integration (30) | Gemma 4 E2B is the SLM under test on every scenario |
| Innovation & Impact (30) | Attention thrift across science, B2B, clinical, jury traps |
| Functionality (20) | `npm test` + `npm run evaluate:fixture` works offline |
| Presentation (20) | `docs/WRITEUP.md` (<1500 words) + optional Cursor canvas |

## Quick start (judges)

Requires Node.js 20+. No API key for the offline demo.

```bash
npm test
npm run score -- examples/perfect-output.json
npm run evaluate:fixture
npm run evaluate:matrix
```

Expected perfect fixture quality score: `1.0`. Matrix fixture runs 3 nightmare
scenarios × 4 models × Alien on/off (24 cells).

## Live eval (optional)

**Classic** (single frozen workflow, one endpoint):

```bash
export OPENAI_BASE_URL=http://127.0.0.1:30000/v1
export OPENAI_API_KEY=EMPTY
npm run evaluate
```

**Matrix** (Brev trio on separate ports):

```bash
export PICSOU_ENDPOINT_GEMMA=http://127.0.0.1:30000/v1
export PICSOU_ENDPOINT_MISTRAL=http://127.0.0.1:30001/v1
export PICSOU_ENDPOINT_DEEPSEEK=http://127.0.0.1:30002/v1
export OPENAI_API_KEY=EMPTY
npm run evaluate:matrix:live
```

Configured candidates in `config/models.json`:

- `gemma-4-e2b-it` — SLM under test (Gemma 4)
- `ministral-3b-instruct` — light baseline
- `deepseek-r1-distill-qwen-1.5b` — external control on Brev
- `grok-4.5` — frontier control (optional live via xAI)

Optional Cursor canvas graphs: add `--canvas` to any CLI run (off by default).

## Layout

```text
workflow/     legacy single-demo benchmark (jury quick path)
scenarios/    matrix v2 use cases (manifest.json)
config/       model candidates + dated pricing estimates
src/          packer, evaluator, matrix orchestration
scripts/      score, validate, canvas render
examples/     perfect fixture for legacy workflow
docs/         Kaggle writeup draft + architecture
test/         node:test coverage
```

## Submission checklist

1. Public GitHub repo (this one) — no login wall
2. Kaggle Writeup from `docs/WRITEUP.md` (submit before deadline)
3. Demo attachment: fixture CLI output and/or live endpoint recording
4. State the track: **Context Engineering for SLMs**

Writeup URL to create:  
https://www.kaggle.com/competitions/paris-gemma-4-hackathon/writeups

## Accuracy boundary

Frozen demo corpus. Alien packets are frozen mirrors in fixture mode, not live
MCP. Recommendation confidence is always `demo-low` until trials repeat.

## License

MIT
