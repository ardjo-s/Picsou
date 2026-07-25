# Optional live Gemma smoke (Brev / SGLang)

**Jury default remains offline:** [README.md](./README.md) (`npm run evaluate:matrix`).
This page is for maintainers who already have OpenAI-compatible Gemma serving.

## What “live” means here

| Axis | Live? | Notes |
| --- | --- | --- |
| Gemma / SLM inference | Yes | Calls `PICSOU_ENDPOINT_*` (SGLang on NVIDIA Brev) |
| Alien enrichment | No | Still frozen `cases.json` vs `cases.alien.json` mirrors |
| Login / API key for judges | Not required | Live path is optional; never the attachment demo |

Alien packets stay frozen so Alien on/off stays a fair A/B. Do not claim live Alien MCP during scoring.

## Prerequisites

1. Node.js 20+
2. A reachable OpenAI-compatible endpoint serving Gemma 4 E2B
3. Port-forward (example with Brev):

```bash
brev port-forward picsou-gemma -p 30000:30000
# optional baselines on the same VM:
brev port-forward picsou-gemma -p 30001:30001
brev port-forward picsou-gemma -p 30002:30002
```

Sanity check:

```bash
curl -sS http://127.0.0.1:30000/v1/models
```

Expect a model id matching `google/gemma-4-E2B-it` (or override with `PICSOU_GEMMA_E2B_MODEL`).

## Run

```bash
export PICSOU_ENDPOINT_GEMMA=http://127.0.0.1:30000/v1
export OPENAI_API_KEY=EMPTY
# optional:
export PICSOU_ENDPOINT_MISTRAL=http://127.0.0.1:30001/v1
export PICSOU_ENDPOINT_DEEPSEEK=http://127.0.0.1:30002/v1

# narrow smoke (recommended first):
npm run evaluate:matrix:live -- --scenario nightmare-track3-adversarial

# full matrix when endpoints are warm:
npm run evaluate:matrix:live
```

Models missing from an endpoint are **skipped**, not invented. Grok needs `XAI_API_KEY` (or Cursor Grok auth) and is optional.

## Captured smoke (2026-07-25)

Committed summary: [matrix-live-smoke-summary.json](./matrix-live-smoke-summary.json)

| Result | Value |
| --- | --- |
| Mode | `live` |
| Scenario | `nightmare-track3-adversarial` |
| Runnable | `gemma-4-e2b-it`, `deepseek-r1-distill-qwen-1.5b` |
| Skipped | Ministral (no :30001), Grok (no xAI) |
| Gemma quality | **1.000** (Alien on and off) |
| DeepSeek quality | **0.14** (weak external control) |
| Winner | `gemma-4-e2b-it` + Alien=true |
| Serving | SGLang on NVIDIA Brev, port-forward `:30000` / `:30002` |

Writeup one-liner: *Live Gemma 4 E2B smoke tested via SGLang on NVIDIA Brev; Alien packets remain frozen mirrors.*

## Expected honesty in reports

Live reports set `mode: "live"` and still list:

- Alien packets = frozen mirrors (not live MCP)
- Confidence stays `demo-low` until you repeat with `--trials N`

Committed fixture numbers for the writeup remain in [matrix-fixture-summary.json](./matrix-fixture-summary.json).
