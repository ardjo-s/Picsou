# Jury demo (offline, no GPU, no login)

Reproduce the Picsou matrix eval in under two minutes.

## Requirements

- Node.js 20+
- No API keys, no GPU, no Cursor required

## Steps

```bash
git clone https://github.com/ardjo-s/Picsou.git
cd Picsou
npm test
npm run evaluate:matrix
```

Expected:

- All tests pass (`19` unit tests + repository contract validator)
- JSON report on stdout; artifact at `results/latest-matrix.json`
- Calibration summary on stderr, e.g. `Calibration: oracle=1.000 | reference=...`
- Three nightmare scenarios × 4 models × Alien on/off = **24 cells**

## What to inspect

| Field | Meaning |
| --- | --- |
| `scenarios[].calibration.oracle` | Theoretical ceiling (= 1.0 on perfect output) |
| `scenarios[].recommendation` | Winner model + Alien on/off + valence |
| `scenarios[].workflow_evaluated` | Exact prompts evaluated (expand in canvas) |
| `summary.tokens_total` | Aggregate tokens across the matrix |

See [docs/SCORE-GUIDE.md](../SCORE-GUIDE.md) for score interpretation.

## Optional

- Repeated trials: `npm run evaluate:matrix -- --trials 3`
- Cursor canvas graphs: `npm run evaluate:matrix -- --canvas` (requires Cursor)
- Live Gemma on Brev: see README § Live eval

## Fixture summary

A redacted fixture summary is committed at `docs/demo/matrix-fixture-summary.json`
for quick inspection without running the CLI.
