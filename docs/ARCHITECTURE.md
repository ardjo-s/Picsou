# Architecture

```text
frozen OpenAIRE-style cases
        │
        ▼
 context pack (select → structure → compress → ground)
        │
        ├──────────────► Gemma 4 E4B (SLM under test)
        │
        └──────────────► Gemma 4 26B MoE (baseline)
                │
                ▼
        deterministic scorer
                │
                ▼
   recommend: quality × cost × latency
```

## Components

| Path | Role |
| --- | --- |
| `workflow/` | Immutable benchmark contract |
| `workflow/context-pack.md` | Track 3 rationale |
| `src/context.mjs` | Builds the packed prompt |
| `src/evaluate.mjs` | Fixture or live OpenAI-compatible runs |
| `scripts/score.mjs` | Exact-evidence deterministic scoring |

## Demo paths

1. **Offline (judges, no GPU):** `npm run evaluate:fixture`
2. **Live Gemma:** serve Gemma 4 via SGLang/vLLM/Ollama OpenAI API, set
   `OPENAI_BASE_URL`, run `npm run evaluate`
