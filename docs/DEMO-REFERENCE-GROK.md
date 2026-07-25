# Hackathon demo: Grok 4.5 as reference ceiling

**Audience:** jury / mentor  
**Track:** Paris Gemma 4 Hackathon — Context Engineering for SLMs  
**Repo:** https://github.com/ardjo-s/Picsou

## Demo policy

For the hackathon demo, **Grok 4.5 is the designated “best” / `reference_ceiling` model**.

That means:

1. Calibration reports compare winners against **Grok 4.5**, not against Fable 5 / Opus 4.8.
2. The product story is: *Gemma 4 E2B + packed context (+ Alien) matches frontier Grok quality at thrift cost.*
3. Live Grok calls use the **Cursor Agent API/CLI** (`cursor-agent`, model `cursor-grok-4.5-high`) by default — same Grok 4.5 that ships in Cursor’s first-party model pool.

Override:

```bash
export PICSOU_GROK_PROVIDER=cursor   # default
export PICSOU_GROK_MODEL=cursor-grok-4.5-high
# optional direct xAI (needs billing credits on console.x.ai):
export PICSOU_GROK_PROVIDER=xai
export XAI_API_KEY=xai-...
```

Smoke:

```bash
npm run smoke:grok
```

## Does calling Grok “the best” bias the eval?

**Short answer:** it biases *narrative framing*, not the deterministic scorer — if we stay honest about ceilings.

| Layer | Biased? | Detail |
| --- | --- | --- |
| Oracle `1.0` | No | Perfect JSON vs frozen `ground-truth.json` — model-agnostic |
| Quality formula | No | Same weights for every cell |
| Choosing Grok as `reference_ceiling` | **Framing yes** | AA Intelligence Index ranks Fable 5 > Opus 4.8 (56) > GPT-5.5 (55) > **Grok 4.5 (54, #4)**. Grok is frontier, not absolute #1 |
| Fixture mutations | **Was biased, fixed** | Old bug mapped Grok → DeepSeek `external_control` failures (~0.58). Now Grok sits **0.89–1.00** near oracle |
| Evidence / hallucination | **Yes if overclaimed** | AA Omniscience: Grok hallucination **54%**. Claude Fable/Opus remain better grounded-quote anchors. Picsou still requires exact substrings |
| Live Cursor tokens | **Yes for cost/tokens** | `cursor-agent` injects ~15–25k system/tool tokens even on empty cwd. **Do not** compare raw Grok Cursor tokens to Brev one-shot SLM tokens. Jury fairness = `--fixture` |
| Composite ranking | Mild | Grok’s higher unit price makes thrift wins easier once quality ties — intentional for the product claim |

### Honest jury line

> “100% is the oracle on our frozen contract. Grok 4.5 is our **demo market ceiling** (Cursor first-party + AA #4), chosen because it leads independent professional-triage signals (Snorkel GDPval+) and cost/token Pareto — not because it beats Fable on every benchmark.”

## Live API status (verified 2026-07-25)

| Path | Status |
| --- | --- |
| `cursor-agent --model grok-4.5` / `cursor-grok-4.5-*` | **Works** (logged-in Cursor session). JSON + usage returned |
| `https://api.x.ai/v1` with Hermes `XAI_API_KEY` | Auth OK, **403 credits exhausted** on this team |
| OpenRouter `x-ai/grok-4.5` | Works as backup, **not** the hackathon demo path |

## What judges should run

```bash
npm test
npm run evaluate:matrix          # fair offline matrix (Grok near ceiling)
npm run smoke:grok               # proves Cursor↔Grok live plumbing
```

Full live matrix still needs Brev endpoints for Gemma/Ministral/DeepSeek; Grok alone no longer depends on xAI credits.
