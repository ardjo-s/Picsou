# Picsou pitch kit (90 seconds)

**Track:** Context Engineering for SLMs (Alien Intelligence)  
**Pitch line (repeat):** *Which SLM is enough — and does Alien context pay for itself per token?*

Numbers locked from `docs/demo/matrix-fixture-summary.json`  
(`generated_at`: 2026-07-25T14:38:10Z, confidence=`demo-low`, trials=1).

## Locked matrix (say these)

| Scenario | Gemma Alien OFF → ON | Winner | Cost (winner) |
| --- | --- | --- | --- |
| heat-lineage | 0.47 → **1.00** | Gemma E2B + Alien | ~$0.00023 |
| icu-fork | 0.44 → **1.00** | Gemma E2B + Alien | ~$0.00022 |
| track3-adversarial | 0.44 → **1.00** | Gemma E2B + Alien | ~$0.00022 |

Calibration one-liner:  
`oracle=1.000 | reference=grok-4.5 0.890–1.000 | winner=gemma-4-e2b-it 1.000 (demo-low)`

## 90-second script

| t | Beat | Words |
| --- | --- | --- |
| 0–15s | **Problem** | Analysts drown in papers and leads. The costly mistake is spending attention on the wrong item. Frontier models triage well but are slow and expensive; raw SLMs fall for geography and year traps. |
| 15–35s | **Contract** | Picsou packs decision-bearing fields, injects distractors, and scores exact-quote JSON. Gemma 4 E2B is the SLM under test — not a chat UI. |
| 35–60s | **Proof** | Offline matrix: 3 nightmares × 4 models × Alien on/off = 24 cells. Gemma without Alien ~0.44–0.47; with Alien **1.00**, matching Grok ceiling at thrift cost. |
| 60–75s | **Track fit** | We measure whether Alien context is worth the tokens for a given workflow — the Track 3 question. |
| 75–90s | **Honesty + CTA** | Fixture Alien packets are frozen mirrors, not live MCP. Confidence is `demo-low` until live trials. Clone the repo: `npm test && npm run evaluate:matrix`. |

## Q&A cheat sheet

### Primavera / Alien Intelligence
**Q:** Live Alien MCP or frozen packets?  
**A:** Jury path uses frozen `cases.alien.json` mirrors for fair A/B. Live MCP/OpenAIRE harvest is out of band. We score whether enriched context pays in quality per token — we do not claim a live agent loop in the demo.

### Amir (HF) / Sonny (PyTorch)
**Q:** Aren’t fixture scores scripted?  
**A:** Yes — `fixture-behavior.json` simulates SLM trap failures so judges can run without a GPU. Labels stay `demo-low`. Live path is optional Brev/SGLang when endpoints are up. Exact-quote scoring still rejects invented citations.

### Alba / product / venture
**Q:** Who is the buyer?  
**A:** Policy aide, clinician, or B2B lead triage — a thrifty **router** that recommends model × Alien on/off. Not another chatbot.

### Score skeptics
**Q:** Is 1.0 “AGI”?  
**A:** No. 1.0 = oracle on this frozen triage contract (see `docs/SCORE-GUIDE.md`). Grok is `reference_ceiling` (market frontier on triage + cost), not “best model ever.”

## Demo paths

1. **Jury / no login / no GPU:** `docs/demo/JURY-DEMO.md` → `npm test` → `npm run evaluate:matrix`
2. **Optional Cursor pitch:** `/Picsou` opens canvas graphs (Cursor only). CLI remains the official login-free path.
3. **Do not claim:** NVIDIA GPU challenge win, live Brev smoke, or live Alien MCP — unless a smoke ran in-session.

## Links

- Repo: https://github.com/ardjo-s/Picsou  
- Writeup draft: `docs/WRITEUP.md`  
- Score semantics: `docs/SCORE-GUIDE.md`  
- Grok ceiling framing: `docs/DEMO-REFERENCE-GROK.md`
