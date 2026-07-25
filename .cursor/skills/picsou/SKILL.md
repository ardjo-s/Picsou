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

1. From the Picsou repo root, run the matrix with canvas enabled for demo:

```bash
npm run evaluate:matrix -- --canvas
```

   - Jury / offline: `--fixture` is default in `evaluate:matrix`.
   - Live: `npm run evaluate:matrix:live -- --canvas` when Brev/SGLang endpoints are ready.
   - Raw jury npm scripts stay canvas-opt-in; only the `/Picsou` skill path defaults `--canvas`.

2. CLI writes:
   - `results/latest-matrix.json`
   - `results/evals.jsonl` (append-only, gitignored)
   - Canvas files under `$PICSOU_CANVAS_DIR` or
     `~/.cursor/projects/<path-slug>/canvases/`

3. Open canvases in the Cursor side panel (use `open_resource` on each file):
   - Index: `picsou-report.canvas.tsx`
   - Per use case: `picsou-<scenario-id>.canvas.tsx`

4. Chat summary — one line per use case, format:

```text
<scenario-id>: <model> alien=<on|off> quality=<score> alien_lift=<delta> tokens=<n> confidence=<label>
```

Do not dump the full JSON table.

## Grill (optional, short)

If the user did not specify a workflow, ask at most:

1. Scenario (default: all three nightmare scenarios in `scenarios/manifest.json`)
2. Alien axis: both / on / off (default: both)
3. Live vs fixture (default: fixture)

Then run with defaults. Prefer defaults under time pressure.

## Rules

- Gemma 4 E2B stays core. Baselines are Ministral + DeepSeek on Brev; Grok is reference_ceiling.
- Jury path must work with fixture only (no login, no paid API).
- Never claim live Alien MCP unless a live harvest actually ran in this session.
- Canvas is default-on for `/Picsou`; jury `npm run evaluate:matrix` stays canvas-opt-in.
