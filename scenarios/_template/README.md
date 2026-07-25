# Scenario template

Clone this folder for a new decision workflow scenario:

1. Copy `workflows/_template/contract.json` → `workflows/<your-id>/contract.json`
2. Copy this folder → `scenarios/<your-id>/`
3. Fill `cases.json`, `cases.alien.json`, `ground-truth.json`, `perfect-output.json`, `prompt.md`
4. Register in `scenarios/manifest.json` with `workflow_id` pointing at your contract
5. Set `matrix_default: true` only if the scenario should run in the default offline matrix

Nightmare triage scenarios omit `workflow_id` — they default to `triage-v1`.
