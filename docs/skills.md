# Cursor skills

Picsou ships Cursor agent skills under [`.cursor/skills/`](../.cursor/skills/).
Open the repo in Cursor and invoke them with `/skill-name` (or the aliases below).

## Skill map

| Skill | Invoke | Job |
| --- | --- | --- |
| [`picsou`](../.cursor/skills/picsou/SKILL.md) | `/Picsou`, `/picsou` | Run the thrift matrix (Gemma vs baselines × Alien on/off) and open the canvas report |
| [`picsou-grill`](../.cursor/skills/picsou-grill/SKILL.md) | `/picsou-grill` | Wave interview to design a new Picsou-testable workflow (scenario brief) |
| [`picsou-grill-auto`](../.cursor/skills/picsou-grill-auto/SKILL.md) | `/picsou-grill-auto` | Same brief as grill, but the agent answers all waves from chat context |
| [`picsou-readme`](../.cursor/skills/picsou-readme/SKILL.md) | `/picsou-readme` | Refresh public README messaging from the method pillars |
| [`picsou-eval-review`](../.cursor/skills/picsou-eval-review/SKILL.md) | `/picsou-eval-review` | Deep-dive packing, scoring, Alien lift, and calibration for a scenario |

## Suggested flow

```text
/picsou-grill  or  /picsou-grill-auto
        │
        ▼
 scaffold scenarios/<id>/  (after brief confirm)
        │
        ▼
      /Picsou
        │
        ├─► /picsou-eval-review   (explain this eval)
        └─► /picsou-readme        (keep product messaging honest)
```

1. **Design** — `/picsou-grill` (human Q&A) or `/picsou-grill-auto` (agent fills waves).
2. **Confirm** the Workflow brief, then scaffold under `scenarios/<id>/`.
3. **Run** — `/Picsou` → `npm run evaluate:matrix -- --canvas` + open canvases.
4. **Explain** — `/picsou-eval-review` for methodology tied to that scenario’s files.
5. **Document** — `/picsou-readme` when public messaging drifts from the method.

## Rules shared by all skills

- Jury / offline path stays fixture-first (no login, no paid API required).
- Do not claim live Alien MCP or live GPU runs unless this session actually ran them.
- Evidence for new workflows must be freezable (`cases.json` / optional `cases.alien.json`).
- `1.0` quality = oracle on the frozen ground truth, not general intelligence.
- Confidence stays `demo-low` for fixture / single-trial runs until live repeats.

## Layout

```text
.cursor/skills/
  picsou/SKILL.md
  picsou-grill/SKILL.md
  picsou-grill-auto/SKILL.md
  picsou-readme/SKILL.md
  picsou-eval-review/SKILL.md
```

Each skill is one `SKILL.md` (YAML frontmatter + instructions). There are no
nested sub-skill folders; cross-links between skills are in the prose above.
