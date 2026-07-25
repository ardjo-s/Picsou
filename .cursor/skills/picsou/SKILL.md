---
name: picsou
description: >-
  Run Picsou thrift eval (Gemma vs baselines × Alien on/off), then open the
  Cursor canvas report with graphs. Use when the user says /Picsou, /picsou,
  or asks for a Picsou report/demo.
---

# /Picsou

Thrifty model router for science / lead / literature attention workflows.

## Steps (always)

1. From the Picsou repo root, run:

```bash
npm run evaluate:matrix
```

   - Jury / offline: `--fixture` is default in `evaluate:matrix`.
   - Live: `npm run evaluate:matrix:live` when Brev/SGLang endpoints are ready.
   - Cursor canvas graphs: add `--canvas` (off by default).

2. CLI writes:
   - `results/latest-matrix.json`
   - Optional canvas under `$PICSOU_CANVAS_DIR` or
     `~/.cursor/projects/<path-slug>/canvases/`

3. When `--canvas` was used, open the canvas beside chat and link it:
   - Index: `picsou-report.canvas.tsx`
   - Per use case: `picsou-<scenario-id>.canvas.tsx`

4. Chat summary: one reco line per use case (model, Alien on/off, quality,
   alien lift). Do not dump the full JSON table.

## Grill (optional, short)

If the user did not specify a workflow, ask at most:

1. Scenario (default: all three in `scenarios/manifest.json`)
2. Alien axis: both / on / off (default: both)
3. Live vs fixture (default: fixture)

Then run. Prefer defaults under time pressure.

## Rules

- Gemma 4 E2B stays core. Baselines are Ministral + DeepSeek on Brev.
- Jury path must work with fixture only (no login, no paid API).
- Never claim live Alien MCP unless truly connected.
- Canvas is opt-in; jury scripts never require Cursor.
