# ARCHIVE - closed effort directories

These directories are the falsification record for first-principled.
They are kept because `docs/FALSIFIED.md` cites measurements inside
them, and a measurement you cannot check is not evidence.

**Nothing in here describes current state.** The single source of
current truth is `docs/STATUS.md`. If you are about to act on a claim
you found in one of these directories, verify it against the code
first. Every one of them was current at some point and every one is now
wrong in at least one fact, because time passed and nobody was
maintaining a document that was no longer the frontier.

| Directory | Effort | Fate |
| --- | --- | --- |
| `.scratch/first-principled/` | v1 product spec | spec still mostly accurate; the map is not |
| `.scratch/first-principled-v2/` | early refinements | superseded |
| `.scratch/first-principled-v3/` | concept tree, observations | superseded |
| `.scratch/first-principled-v4/` | cladogram | superseded |
| `.scratch/first-principled-v5/` | dependence path, tutor sheet | superseded |
| `.scratch/first-principled-v6/` | OpenRouter transport, one-shot maps | generator falsified; transport retained |
| `.scratch/first-principled-v7/` | three-stage funnel | **falsified**; still in prod, do not retune |
| `.scratch/first-principled-v8/` | Chapel display | shipped |
| `.scratch/first-principled-v9/` | pairwise generator | **live** |
| `.scratch/first-principled-payments/` | unrelated research | not part of this product |

## Known-bad contents

- **`.scratch/first-principled-v7/research/_sources/` is 18.5 MB of
  scraped vendor HTML and plain text** across 66 files - DeepSeek,
  OpenAI, Anthropic, OpenRouter, and library documentation. Nothing
  imports it, no measurement depends on it, and it is not cited by
  content anywhere. It is the single largest thing in the repository
  and it is dead weight. Safe to delete or move to cold storage.
- **The v6 and v7 research notes name models the code has not used for
  several versions** (`nvidia/nemotron-3-ultra-550b-a55b`,
  `stealth/ox-alpha`). Read them as history. `src/claims.test.js`
  asserts that no *entry* document repeats this error; it deliberately
  does not assert anything about archived files, because rewriting
  history would destroy the evidence.

## Why this is not deleted

Because the whole reason v9 exists is that a previous agent read the
evidence instead of rebuilding. `docs/FALSIFIED.md` is only trustworthy
if the measurements behind it still exist. The archives are the
measurements.

What should not survive is duplication. If a fact appears in four
documents and all four can drift, it belongs in one. That is why
`docs/STATUS.md` exists and why it is enforced by a test.
