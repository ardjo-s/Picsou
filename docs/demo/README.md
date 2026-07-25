# Picsou demo — easy guide

**Judges:** start at **[JURY-DEMO.md](./JURY-DEMO.md)** (canonical offline path).
This page is the kid-readable walkthrough of the same demo.

**Goal:** run Picsou on your computer, then read a clear report.

No GPU. No login. No API key for the default demo.

## The story in one minute

Imagine a teacher gives the **same hard homework** to several students
(small AI models).

1. The teacher packs only the useful notes (and sometimes adds special
   “Alien” sticky notes).
2. Every student answers the same way: keep / maybe / skip, with a quote
   copied from the notes.
3. Picsou grades the answers against an answer key.
4. Picsou recommends the **cheapest student who still gets a good grade**.

That is the whole product.

## Run it (about 2 minutes)

```bash
git clone https://github.com/ardjo-s/Picsou.git
cd Picsou
npm test
npm run evaluate:matrix -- --canvas
```

What you get:

| Output | Meaning |
| --- | --- |
| Tests pass | The grading machine works |
| `results/latest-matrix.json` | Full numbers (gitignored) |
| Cursor canvases | Pretty report with charts + info bubbles |

Open the index canvas beside chat:

- `picsou-report.canvas.tsx` — map of every homework job
- `picsou-<scenario-id>.canvas.tsx` — one job in detail

More detail: [HOW-IT-WORKS.md](./HOW-IT-WORKS.md)

## What the numbers mean (kid version)

| Word | Plain meaning |
| --- | --- |
| **Quality** | How correct the answers were (100% = perfect on this homework) |
| **Alien on/off** | Same homework, with or without extra sticky notes |
| **Alien lift** | How much better the *same* model got after Alien notes |
| **Tokens** | How much text the model read + wrote (bigger ≈ heavier meal) |
| **Cost** | Rough money for one run |
| **Latency** | How long the answer took |
| **Eligible** | Good enough to be recommended (usually quality ≥ 75%) |
| **Oracle** | The perfect answer key score (should be ~100% if grading is fair) |
| **demo-low** | Honest label: this offline demo is not a giant live proof yet |

Live confidence ladder (when you repeat with `--trials`): `low` (≥2), `medium` (≥5 + stable), `high` (≥10 + stable) — see [LIVE.md](./LIVE.md).

Committed sample report: [matrix-fixture-summary.json](./matrix-fixture-summary.json)

Expected calibration line (stderr):

```text
Calibration: oracle=1.000 | reference=grok-4.5 0.890–1.000 | winner=gemma-4-e2b-it 1.000–1.000 (confidence=demo-low, trials=1)
```

Default matrix: **3 homework jobs × 4 models × Alien on/off = 24 cells**.

## How to read the canvas report

1. Click or hover any **i** — a legend appears (Cursor has no system tooltips).
2. Start at the top story: what was tested (4 steps).
3. Look at the green recommendation — who won for *this* job only.
4. Read the charts: quality in %, Alien with/without sticky notes, cost, speed.
5. Open the ranking table for every cell.

## Optional extras

```bash
npm run evaluate:matrix -- --trials 3
npm run score -- examples/perfect-output.json
```

Live Gemma on your own GPU endpoint (not required for judges): [LIVE.md](./LIVE.md).
