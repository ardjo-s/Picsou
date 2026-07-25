# Picsou

<p align="center">
  <img src="docs/assets/piscou-banner.jpg" alt="Piscou — small but sturdy" width="1024" />
</p>

Thrifty attention routing for small language models.

**Attention, not chat.** Picsou optimizes who/what deserves attention — structured
triage (fit, priority, signals, evidence), not open-ended conversation.

Pack decision-bearing context → run the same triage on SLM vs baselines × Alien
on/off → score exact-quote JSON → recommend the cheapest model that still hits
quality.

## Why Picsou

### The problem

Knowledge workers do not fail because they lack documents. They fail because they
**spend attention on the wrong ones**.

- A policy aide skims 40 papers and misses the only EU-scoped mortality study.
- A clinician sees conflicting ICU protocols and escalates the outdated fork.
- A founder scores “hot” leads that are academic noise with zero buying intent.

Frontier models can triage this well — at **latency and token cost** that do not
scale to every inbox, every briefing, every night batch. Raw small models are
cheap but fragile: they chase title bait, wrong geography, and stale years.

Extra context (RAG, Alien enrichment, longer packs) is sold as free quality.
Often it is not free: more tokens, more noise, unclear lift.

### Who it is for

| User | Job to be done |
| --- | --- |
| Policy / research aide | Keep high-signal papers, skip traps, brief leadership fast |
| Clinician / medical analyst | Separate protocol that changes care from adjacent noise |
| B2B founder / RevOps | Rank leads by real commercial fit, not keyword glitter |
| AI product / ops lead | Know which SLM is *enough* for a workflow before paying frontier rates |

### User value

Picsou is not another chatbot. It is a **thrift router for attention**:

1. **Protect attention** — structured triage with exact-quote evidence, so “read this”
   is grounded in source text, not vibes.
2. **Spend less for the same decision quality** — measure when Gemma 4 E2B + packed
   context matches a frontier reference ceiling at a fraction of the cost.
3. **Know if richer context pays** — Alien on/off on the same task answers
   “does this enrichment buy quality worth the tokens?” before you ship it.
4. **Decide with a contract, not a demo vibe** — offline, reproducible matrix:
   quality × cost × latency × tokens → one recommendation per use case.

**Bottom line:** keep expensive models for the hard cases; run thrifty SLMs on
packed context for the rest — and prove the tradeoff with numbers.

## Workflow fit

**Good fit:** triage / ranking / keep-skim-skip over candidates with citable text
evidence (papers, leads, protocols, tickets).

**Poor fit:** creative writing, multi-step tool agents, UI chat, tasks without
freezable ground truth or exact-quote evidence.

A workflow plugs in when it declares frozen packet(s) (baseline + optional Alien
mirror), a structured JSON judgment schema, ground truth + perfect oracle output,
and quality scoring (field matchers + weights in the contract).

Built-in contracts live under `workflows/`:

| Contract | Use case |
| --- | --- |
| `triage-v1` (default) | Science attention triage — keep / skim / skip |
| `decision-v1` | Binary approve/reject with grounded evidence |

Clone `workflows/_template/` and `scenarios/_template/` for a new domain. Point
`workflow_id` on a manifest entry at your contract. Design new workflows with
[`/picsou-grill`](.cursor/skills/picsou-grill/SKILL.md) (Cursor skill).

### What Picsou is not

- Not a general agent loop / tool-calling benchmark
- Not LMSYS / “best model overall”
- Not a guarantee that enrichment always helps
- Not unlimited workflow shape — see fit above

## How it works

```text
frozen cases (+ optional Alien mirror packet)
        │
        ▼
 context pack (select → structure → compress → distract → ground)
        │
        ├─► Gemma 4 E2B (SLM under test)
        ├─► Ministral 3B / DeepSeek 1.5B (baselines)
        └─► Grok 4.5 (reference ceiling in reports)
                │
                ▼
        deterministic scorer (exact evidence quotes)
                │
                ▼
   recommend: quality × cost × latency × tokens
```

1. **Select** — keep fields that change the decision; drop noise.
2. **Structure** — addressable cases/sources (`source_id`).
3. **Compress** — normalize claims into short decision-bearing text.
4. **Distract** — inject traps (wrong geography, stale years, title bait).
5. **Ground** — every `evidence_quote` must be an exact substring of frozen source
   text (invented citations fail).
6. **Compare** — Alien off vs on: does extra context pay per token?

Offline demos freeze evidence packets; Alien-enriched packets are **mirrors**
(`cases.json` vs `cases.alien.json`), not live MCP during scoring. Quality mixes
priority accuracy, evidence exactness × signal F1, and attention-fit accuracy.
`1.0` = **oracle** on that frozen ground truth — not general intelligence. Cells
below the recommend floor (typically **0.75**) cannot win. Fixture confidence
stays `demo-low` until live repeats raise it to `low` / `medium` / `high`.

## How to use

Requires Node.js 20+. No API key for the offline demo.

```bash
git clone https://github.com/ardjo-s/Picsou.git
cd Picsou
npm test
npm run evaluate:matrix
```

Useful commands:

```bash
npm run score -- examples/perfect-output.json   # oracle path → quality 1.0
npm run evaluate:fixture                        # legacy single workflow
npm run evaluate:matrix                         # 3 nightmare scenarios × 4 models × Alien on/off
npm run evaluate:matrix -- --scenario demo-inbox-review   # decision-v1 demo only
npm run evaluate:matrix -- --trials 3           # repeat cells for variance
```

Optional live OpenAI-compatible endpoints (SGLang / Brev):

```bash
export PICSOU_ENDPOINT_GEMMA=http://127.0.0.1:30000/v1
export PICSOU_ENDPOINT_MISTRAL=http://127.0.0.1:30001/v1
export PICSOU_ENDPOINT_DEEPSEEK=http://127.0.0.1:30002/v1
export OPENAI_API_KEY=EMPTY
npm run evaluate:matrix:live
```

Step-by-step live notes + captured Brev smoke: [docs/demo/LIVE.md](docs/demo/LIVE.md).
Alien packets stay frozen mirrors in live mode (not live MCP).

Models in `config/models.json`: `gemma-4-e2b-it`, `ministral-3b-instruct`,
`deepseek-r1-distill-qwen-1.5b`, `grok-4.5`.

## Demo examples

**Jury path (login-free):** [docs/demo/JURY-DEMO.md](docs/demo/JURY-DEMO.md)

Kid-readable walkthrough: [docs/demo/README.md](docs/demo/README.md) · [docs/demo/HOW-IT-WORKS.md](docs/demo/HOW-IT-WORKS.md)

Example fixture summary (committed): [docs/demo/matrix-fixture-summary.json](docs/demo/matrix-fixture-summary.json)

Expected calibration line after `npm run evaluate:matrix`:

```text
Calibration: oracle=1.000 | reference=grok-4.5 0.890–1.000 | winner=gemma-4-e2b-it 1.000–1.000 (3 use cases) (confidence=demo-low, trials=1)
```

On the three nightmare scenarios, Gemma without Alien often lands ~0.44–0.47;
with Alien it reaches **1.00** — matching the Grok reference ceiling at much
lower estimated cost.

Nightmare packs live under `scenarios/nightmare-*` (heat lineage, ICU protocol
fork, Track 3 adversarial traps).

## Cursor skills

Agent skills live under [`.cursor/skills/`](.cursor/skills/). Full map:
[docs/skills.md](docs/skills.md).

| Invoke | Job |
| --- | --- |
| `/Picsou` | Run thrift matrix + open canvas report |
| `/picsou-grill` | Wave interview → new workflow brief |
| `/picsou-grill-auto` | Same brief; agent answers all waves |
| `/picsou-readme` | Refresh README from method pillars |
| `/picsou-eval-review` | Deep-dive eval methodology for a scenario |

Typical path: grill → scaffold `scenarios/<id>/` → `/Picsou` → optional
`/picsou-eval-review` / `/picsou-readme`.

## Layout

```text
config/           model candidates + pricing estimates
workflows/        workflow contracts (triage-v1, decision-v1, _template)
scenarios/        matrix use cases (manifest.json)
src/              packer, matrix eval, scoring helpers
scripts/          score + repo contract checks
examples/         perfect fixture output
docs/demo/        jury demo (JURY-DEMO.md) + kid guide + sample report
docs/skills.md    Cursor skill map + usage flow
.cursor/skills/   Cursor agent skills (SKILL.md per command)
workflow/         legacy single-benchmark contract
test/             node:test coverage
```

## License

MIT
