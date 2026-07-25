# Jury demo (offline, no GPU, no login)

**This is the Track 3 judge path.** Reproduce the Picsou nightmare matrix in
under two minutes from the default branch.

No API keys. No GPU. No Cursor required for the CLI path.

## Steps

```bash
git clone https://github.com/ardjo-s/Picsou.git
cd Picsou
npm test
npm run evaluate:matrix
```

Expected:

- All tests pass (unit tests + repository contract validator)
- JSON report on stdout; artifact at `results/latest-matrix.json` (gitignored)
- Calibration on stderr:

```text
Calibration: oracle=1.000 | reference=grok-4.5 0.890–1.000 | winner=gemma-4-e2b-it 1.000–1.000 (confidence=demo-low, trials=1)
```

- **3 nightmare scenarios × 4 models × Alien on/off = 24 cells**
- Winner: **gemma-4-e2b-it** with Alien **on** (quality **1.000**)
- Without Alien, Gemma often lands ~0.44–0.47 on these packs → Alien lift is the story

## What to inspect

| Field | Meaning |
| --- | --- |
| `scenarios[].calibration.oracle` | Theoretical ceiling (= 1.0 on perfect output) |
| `scenarios[].recommendation` | Winner model + Alien on/off + valence |
| `scenarios[].alien_delta` / `valence.alien_lift` | Same model, Alien off → on quality delta |
| Committed sample | [matrix-fixture-summary.json](./matrix-fixture-summary.json) |

Models under test: Gemma 4 E2B (SLM), Ministral 3B, DeepSeek R1-Distill 1.5B,
Grok 4.5 (`reference_ceiling`). Alien packets are **frozen mirrors**, not live MCP.

Confidence stays **`demo-low`** for this offline fixture (honest label).

## Optional

| Extra | Command / link |
| --- | --- |
| Kid-readable walkthrough + canvas UX | [README.md](./README.md) · [HOW-IT-WORKS.md](./HOW-IT-WORKS.md) |
| Canvas graphs (Cursor) | `npm run evaluate:matrix -- --canvas` |
| Repeated trials | `npm run evaluate:matrix -- --trials 3` |
| Live Gemma on your GPU endpoint | [LIVE.md](./LIVE.md) — **not** required for judges |

## One-liner for attachments

```text
Clone https://github.com/ardjo-s/Picsou → npm test && npm run evaluate:matrix
No GPU / no API key. Guide: docs/demo/JURY-DEMO.md
```
