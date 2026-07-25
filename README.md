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

## Rubric coverage (Paris Gemma 4 Hackathon)

| Criterion (pts) | Artifact judges open in &lt;2 min |
| --- | --- |
| Gemma Integration (30) | `config/models.json` (Gemma 4 E2B SLM), `docs/WRITEUP.md` § How Gemma 4 is used, optional Brev live path in README |
| Innovation & Impact (30) | Nightmare scenarios in `scenarios/manifest.json`, Alien on/off matrix, per-use-case valence recos in `results/latest-matrix.json` |
| Functionality (20) | `npm test` + `npm run evaluate:matrix` (offline, no GPU), [docs/demo/JURY-DEMO.md](docs/demo/JURY-DEMO.md) |
| Presentation & Writeup (20) | [docs/WRITEUP.md](docs/WRITEUP.md), [docs/SCORE-GUIDE.md](docs/SCORE-GUIDE.md), [docs/PITCH-KIT.md](docs/PITCH-KIT.md), optional `/Picsou` canvas reports |

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
npm run evaluate:matrix -- --trials 3
```

Expected perfect fixture quality score: `1.0`. See [docs/SCORE-GUIDE.md](docs/SCORE-GUIDE.md)
for what the score means (oracle = 1.0, reference model, repeated trials).
Matrix fixture runs 3 nightmare scenarios × 4 models × Alien on/off (24 cells).

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

1. Public GitHub repo: https://github.com/ardjo-s/Picsou — no login wall
2. Kaggle Writeup from `docs/WRITEUP.md` (submit before deadline) — see `docs/KAGGLE-SUBMIT.md`
3. Demo attachment: [docs/demo/JURY-DEMO.md](docs/demo/JURY-DEMO.md) + `npm run evaluate:matrix` output
4. State the track: **Context Engineering for SLMs**

Writeup URL to create:  
https://www.kaggle.com/competitions/paris-gemma-4-hackathon/writeups

## Accuracy boundary

Frozen demo corpus. Alien packets are frozen mirrors in fixture mode, not live
MCP. Recommendation confidence is always `demo-low` until trials repeat.

## License

MIT
