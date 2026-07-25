# Picsou demo (offline, no GPU, no login)

Reproduce the matrix eval in under two minutes.

## Requirements

- Node.js 20+
- No API keys, no GPU required

## Steps

```bash
git clone https://github.com/ardjo-s/Picsou.git
cd Picsou
npm test
npm run evaluate:matrix
```

Expected:

- All tests pass
- JSON report on stdout; artifact at `results/latest-matrix.json` (gitignored)
- Calibration summary on stderr, for example:

```text
Calibration: oracle=1.000 | reference=grok-4.5 0.890–1.000 | winner=gemma-4-e2b-it 1.000–1.000 (confidence=demo-low, trials=1)
```

- Three scenarios × 4 models × Alien on/off = **24 cells**

## What to inspect

| Field | Meaning |
| --- | --- |
| `scenarios[].calibration.oracle` | Theoretical ceiling (= 1.0 on perfect output) |
| `scenarios[].recommendation` | Winner model + Alien on/off |
| `summary.tokens_total` | Aggregate tokens across the matrix |

Committed sample: [matrix-fixture-summary.json](./matrix-fixture-summary.json)

## Reading the score

- **1.0** = oracle on the frozen ground truth for this triage contract
- **Below 1.0** = partial correctness on this benchmark only
- Recommendations need quality ≥ 0.75 before they can win
- Fixture confidence stays `demo-low` (single trial / frozen corpus)
- Live ladder: `low` (≥2 trials), `medium` (≥5 + stable), `high` (≥10 + stable) — see [LIVE.md](./LIVE.md)

## Optional

```bash
npm run evaluate:matrix -- --trials 3
npm run score -- examples/perfect-output.json
```

## Optional live Gemma (not required for jury)

If you already serve Gemma 4 E2B on an OpenAI-compatible endpoint (e.g. SGLang on
NVIDIA Brev), see [LIVE.md](./LIVE.md). Alien packets stay frozen mirrors even in
live mode. Captured smoke summary: [matrix-live-smoke-summary.json](./matrix-live-smoke-summary.json).
