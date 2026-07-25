# Architecture

```text
frozen OpenAIRE-style cases (+ optional Alien mirror packets)
        │
        ▼
 context pack (select → structure → compress → ground)
        │
        ├──────────────► Gemma 4 E2B (SLM under test)
        ├──────────────► Ministral 3B (light baseline)
        ├──────────────► DeepSeek 1.5B distill (external control)
        └──────────────► Grok 4.5 (reference_ceiling in reports)
                │
                ▼
        deterministic scorer (exact-evidence JSON)
                │
                ▼
   recommend: quality × cost × latency × tokens (per use case)
```

## Components

| Path | Role |
| --- | --- |
| `workflow/` | Legacy single-demo benchmark contract |
| `workflow/context-pack.md` | Track 3 rationale |
| `scenarios/` | Matrix nightmare use cases (`manifest.json`) |
| `src/context.mjs` | Builds the packed prompt |
| `src/matrix.mjs` | Matrix orchestration (model × Alien) |
| `src/calibration.mjs` | Oracle / reference / winner calibration block |
| `src/evaluate.mjs` | Fixture or live OpenAI-compatible runs |
| `scripts/score.mjs` | Exact-evidence deterministic scoring |
| `scripts/render-canvas-report.mjs` | Optional Cursor canvas graphs |
| `.cursor/skills/picsou/` | `/Picsou` demo skill (canvas pitch path) |

## Demo paths

1. **Offline (judges, no GPU):** `npm run evaluate:matrix`
2. **Live Gemma:** serve Gemma 4 E2B via SGLang on Brev, set `PICSOU_ENDPOINT_GEMMA`, run `npm run evaluate:matrix:live`
3. **Pitch (Cursor):** `/Picsou` → matrix with `--canvas` → per-use-case canvases

## Alien axis

Fixture mode uses frozen `cases.json` vs `cases.alien.json` mirrors for fair A/B. Live Alien MCP harvest is optional and out of band; the jury path never requires MCP at runtime.
