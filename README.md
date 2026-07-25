# Picsou Router

Thrifty attention routing for small language models.

Picsou packs a frozen evidence packet, runs the same triage task on **Gemma 4 E2B**
and light baselines (with or without Alien-enriched context), scores exact-quote
JSON outputs, and recommends the cheapest model that still hits quality.

## How it works

```text
frozen cases (+ optional Alien mirror packet)
        │
        ▼
 context pack (select → structure → compress → ground)
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

1. **Select** decision-bearing fields; drop noise.
2. **Structure** a strict JSON triage task.
3. **Distract** with traps (wrong geography, stale years, title bait).
4. **Ground** every `evidence_quote` as an exact substring of source text.
5. **Compare** Alien off vs on so you see whether extra context pays per token.

Offline demos use frozen Alien mirrors (not live MCP). Scores are for this
contract: `1.0` = perfect triage on the frozen ground truth (oracle), not general
intelligence. Fixture recommendations are labeled `demo-low` until live trials repeat.

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
npm run evaluate:matrix                         # 3 scenarios × 4 models × Alien on/off
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

Models in `config/models.json`: `gemma-4-e2b-it`, `ministral-3b-instruct`,
`deepseek-r1-distill-qwen-1.5b`, `grok-4.5`.

## Demo examples

Step-by-step offline demo: [docs/demo/README.md](docs/demo/README.md)

Example fixture summary (committed): [docs/demo/matrix-fixture-summary.json](docs/demo/matrix-fixture-summary.json)

Expected calibration line after `npm run evaluate:matrix`:

```text
Calibration: oracle=1.000 | reference=grok-4.5 0.890–1.000 | winner=gemma-4-e2b-it 1.000–1.000 (confidence=demo-low, trials=1)
```

On the three nightmare scenarios, Gemma without Alien often lands ~0.44–0.47;
with Alien it reaches **1.00** — matching the Grok reference ceiling at much
lower estimated cost.

Nightmare packs live under `scenarios/nightmare-*` (heat lineage, ICU protocol
fork, Track 3 adversarial traps).

## Layout

```text
config/      model candidates + pricing estimates
scenarios/  matrix use cases (manifest.json)
src/        packer, matrix eval, scoring helpers
scripts/    score + repo contract checks
examples/   perfect fixture output
docs/demo/  how to run the offline demo + sample report
workflow/   legacy single-benchmark contract
test/       node:test coverage
```

## License

MIT
