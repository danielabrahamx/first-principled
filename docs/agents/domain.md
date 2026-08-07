# Domain docs

Single-context layout.

## Layout

- `CONTEXT.md` at the repo root: the current architecture mental model and
  onboarding guide. Keep it short and current.
- `docs/adr/`: architecture decision records, one file per decision, numbered.
- `docs/MISSION.md`: immutable mission, theory of learning, and the 12 core
  principles. Agent prompts follow it; it is never edited by agents without a
  human decision.

## Consumer rules

- Read `CONTEXT.md` and `docs/MISSION.md` before working any ticket.
- The spec (`.scratch/first-principled/spec.md`) is the source of truth for
  product decisions; update it in the same commit as the code that changes it.
- ADRs are for decisions that outlive the current map; create one when a
  decision changes the architecture in a way later sessions must know.
