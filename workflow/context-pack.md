# Context pack (Track 3 — Context Engineering for SLMs)

Picsou does not ask Gemma to browse the open web. It feeds a **packed**
evidence packet so a small model (Gemma 4 E4B) can triage research attention
reliably.

## Packing steps

1. **Select** — keep only title, year, topics, access, and decision-bearing snippets.
2. **Structure** — one case object per record; sources are addressable by `source_id`.
3. **Compress** — normalize abstracts into claim / method / scope sentences.
4. **Distract deliberately** — include low-value snippets (plotting package lists)
   so the model must ignore noise.
5. **Ground** — require exact `evidence_quote` substrings; invented citations fail scoring.

## Why this is the product

Without packing, an SLM either hallucinates relevance or misses policy hooks.
With packing + deterministic scoring, judges can see whether Gemma 4 E4B is
*enough* versus a larger baseline on quality, latency, and estimated cost.
