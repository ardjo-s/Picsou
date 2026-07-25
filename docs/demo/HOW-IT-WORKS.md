# How Picsou evaluation works

Written so a curious 10-year-old (or a tired judge) can follow along.

## Characters

| Character | Role |
| --- | --- |
| **Homework** | A pile of papers / leads / protocols with traps |
| **Student** | An AI model (Gemma, Ministral, DeepSeek, Grok…) |
| **Alien sticky notes** | Extra open-science hints on some packets |
| **Answer key** | Frozen truth Picsou already knows |
| **Picsou** | The teacher + thrift coach |

## Step 1 — Pack the homework

Picsou does not dump the whole internet into the model.

It:

1. **Selects** useful bits
2. **Structures** them as a clear JSON task
3. **Compresses** noise
4. **Adds traps** on purpose (wrong country, old year, shiny title)
5. **Requires exact quotes** from the notes (copy-paste proof)

Two packs per job:

- **Alien off** — plain packet
- **Alien on** — same job + sticky notes

Fair rule: packs are frozen files. Scoring does **not** call live Alien MCP.

## Step 2 — Every student takes the same test

For each job × each model × Alien on/off, Picsou asks for structured answers:

- keep / medium / skip
- short evidence quotes that must appear in the notes

## Step 3 — Grade with a machine

Quality mixes:

- Did priorities match the answer key? (biggest weight)
- Were quotes exact?
- Did “fits / doesn’t fit” match?

**1.0 (100%)** means perfect on *this* frozen homework — not “smart at everything.”

If quality is under the bar (usually **0.75 / 75%**), that cell cannot win.

## Step 4 — Recommend thriftily

Among eligible cells, Picsou picks a winner using quality + cost + speed + tokens.

Question answered:

> Which small model is enough — and did Alien notes pay for their extra tokens?

## What the report shows

### Index canvas (`picsou-report`)

- One row per homework job
- Winner, quality, Alien lift, tokens
- Info bubbles (**i**) explain every column
- Charts compare jobs side by side

### Use-case canvas (`picsou-<id>`)

- Exact prompts that were scored (collapsible)
- Recommendation + why
- Calibration: oracle vs reference vs winner
- Charts: composite, quality (%), Alien lift, cost, latency
- Full ranking table

## Reproduce offline

```bash
npm test
npm run evaluate:matrix -- --canvas
```

See also: [README.md](./README.md) · [LIVE.md](./LIVE.md) · sample [matrix-fixture-summary.json](./matrix-fixture-summary.json)
