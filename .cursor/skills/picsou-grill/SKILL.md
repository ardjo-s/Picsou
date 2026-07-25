---
name: picsou-grill
description: >-
  Wave-based interview to define a Picsou workflow (scenario) worth testing:
  actor, decision, evidence, traps, Alien axis, success metric. Use when the
  user says /picsou-grill, /piscou-grill, or asks to design a new triage
  workflow / use case for Picsou. For no human interview, use /picsou-grill-auto.
---

# /picsou-grill

Help the user define a **Picsou-testable workflow**: frozen evidence → packed
context → structured triage → quality × cost × Alien lift.

## Rules

- Ask **one question at a time**. Wait for the answer before the next.
- Prefer defaults when the user is rushed; state the default and move on if they
  say “default” / “ok” / skip.
- Look up existing `scenarios/` and `scenarios/manifest.json` before asking
  what already exists.
- Do **not** invent live web search into the contract. Evidence must be freezable.
- Do **not** implement the scenario until the user confirms the grill summary.
- End with a paste-ready **Workflow brief** (template below).

## Wave 1 — Job to be done (must resolve first)

Ask in order:

1. **Actor** — Who is drowning in candidates? (aide, clinician, founder, analyst…)
2. **Decision** — What binary/ranked call do they make? (keep / skim / skip, or
   priority high/medium/low)
3. **Cost of error** — What happens if they attend to the wrong item?
4. **Cadence** — One-shot brief, daily batch, or interactive?

After Wave 1, restate in one sentence:  
`For <actor>, Picsou triages <candidates> so they <decision> without <error>.`

## Wave 2 — Evidence contract

5. **Candidate unit** — paper, lead, protocol, ticket, repo, other?
6. **Must-keep fields** — title, year, geography, claim, method, firmographics…?
7. **Source family** — OpenAIRE-style science, CRM export, clinical notes, mixed?
8. **Freeze plan** — Can we ship a frozen packet for offline parity? (required: yes)

## Wave 3 — Traps & Alien

9. **Distractors** — Which traps should the SLM fail without packing?
   (wrong geo, stale year, title bait, keyword glitter, superseded DOI…)
10. **Alien / enrichment** — What extra context might help (lineage, related
    works, firmographics)? Measure on/off — do not assume it helps.
11. **Hardness** — nightmare (jury traps) vs normal vs poison-hard?

## Wave 4 — Success & eval shape

12. **Ground truth** — How do we label fit / priority for each case?
13. **Oracle** — What does perfect JSON look like (attention_fit, priority,
    signals, exact quotes)?
14. **Models** — Default Gemma 4 E2B under test + light baselines + optional
    reference ceiling. Change only if user insists.
15. **Live vs fixture** — Default fixture for design; live only if endpoints exist.

## Close

1. Output the **Workflow brief** (fill every field; mark unknowns as `TBD`).
2. Ask: “Confirm to scaffold under `scenarios/<id>/`?” — stop until yes.
3. If confirmed, hand off to implementation (or `/Picsou` once fixtures exist).
   Prefer one vertical scenario folder: `cases.json`, `cases.alien.json` (if
   Alien axis), `ground-truth.json`, `perfect-output.json`, `prompt.md`,
   `fixture-behavior.json` when hardness needs scripted offline fails.
4. To explain the eval methodology for this workflow in depth, use
   `/picsou-eval-review`.

## Workflow brief template

```text
id: <kebab-id>
actor: 
decision: 
error_cost: 
cadence: 
candidate_unit: 
fields: 
source_family: 
freeze: yes
distractors: 
alien_enrichment: 
hardness: nightmare|normal|hard
models: gemma-4-e2b-it + baselines (+ reference_ceiling)
mode: fixture|live
success: quality≥0.75 eligible; Alien lift reported; confidence label honest
```
