---
name: picsou-grill-auto
description: >-
  Auto-complete Picsou workflow grill: LLM answers all wave questions from
  chat context and defaults, then emits a Workflow brief. Use when the user
  says /picsou-grill-auto, wants no human Q&A, or asks the LLM to fill the
  grill itself. Prefer over /picsou-grill when the user refuses interview.
---

# /picsou-grill-auto

Same contract as `/picsou-grill`, but **the LLM answers every wave question**.
No human interview. One confirmation at the end only.

## Rules

- Do **not** ask Wave 1–4 questions to the user.
- Read `scenarios/manifest.json` + existing `scenarios/*` first; avoid duplicate ids.
- Infer from: this chat, open files, prior `/Picsou` runs, and Picsou defaults.
- Prefer defaults when ambiguous; mark true unknowns `TBD` (max 2 TBDs).
- Do **not** invent live web harvest into the evidence contract — freeze only.
- Do **not** scaffold files until the user confirms the brief.
- Show a compact **Q&A log** (agent answers) then the **Workflow brief**.

## Defaults (use unless chat overrides)

| Field | Default |
| --- | --- |
| decision | `priority ∈ high\|medium\|skip` |
| cadence | one-shot brief |
| candidate_unit | paper / OpenAIRE-style record |
| freeze | yes |
| hardness | nightmare |
| models | gemma-4-e2b-it + baselines (+ reference_ceiling grok-4.5) |
| mode | fixture |
| success | quality≥0.75 eligible; Alien lift reported; confidence honest |

## Steps

1. Load existing scenarios; pick a **new** kebab `id` if chat implies a new job.
2. Answer waves 1–4 silently; write the **Q&A log** (15 lines, agent as answerer).
3. Restate job: `For <actor>, Picsou triages <candidates> so they <decision> without <error>.`
4. Emit the Workflow brief (template below; fill every field).
5. Ask only: `Confirm to scaffold under scenarios/<id>/?` — stop until yes.
6. If yes → scaffold vertical folder (`prompt.md`, `cases.json`, `cases.alien.json`,
   `ground-truth.json`, `perfect-output.json`, `fixture-behavior.json`) + manifest entry.
   Then user can `/Picsou` once fixtures exist.
7. To explain the eval methodology for this workflow in depth, use
   `/picsou-eval-review`.

## Q&A log format

```text
Q1 actor → <answer>
Q2 decision → <answer>
…
Q15 live_vs_fixture → <answer>
```

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
