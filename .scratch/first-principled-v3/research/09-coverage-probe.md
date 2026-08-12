# 09 - Coverage probe: DeepSeek parametric memory of canonical discovery history

Date: 2026-08-12. Probe run from a throwaway script outside the repo
(`C:/Users/danie/AppData/Local/Temp/opencode/fp09-probe`). Key from `.env`,
never committed. Model: deepseek-v4-flash via `https://api.deepseek.com/v1`.

## Probe design

15 concepts spanning three obscurity tiers (famous, mid, obscure plus my own
obscure picks). For each, one API call asking for three fact fields in JSON:
discoverer, date, key observation, each marked EXACT | APPROXIMATE | UNKNOWN.
A system prompt instructed: state only well-documented history, never guess a
plausible value to avoid UNKNOWN, use APPROXIMATE when the record is low
resolution or contested. All raw answers kept in `probe-raw.md`,
`retry5-raw.md`, `probe-contract-raw.md` next to the probe script.

## Verdicts (checked against documented history)

| Concept | Tier | Discoverer | Date | Key observation |
|---|---|---|---|---|
| Gravity (Newton) | famous | EXACT, correct | APPROX 1687/1660s, correct | EXACT, correct (Moon vs surface g, 1/3600) |
| Natural selection | famous | EXACT, correct (Darwin + Wallace) | EXACT 1858, correct | EXACT, correct (Malthus 1838 insight) |
| Planetary orbits (Kepler) | famous | EXACT, correct | APPROX 1609, correct | EXACT, correct (8 arcmin Mars residual) |
| Neptune | mid | EXACT, correct (Galle + d'Arrest, Le Verrier prediction) | EXACT 1846-09-23, correct | EXACT, correct |
| Marine chronometer | mid | EXACT, correct (Harrison H4) | EXACT 1761-62, correct | EXACT, correct (5 s over 81 days) |
| Cepheid distance scale | mid | EXACT, correct (Leavitt) | APPROX 1908-1912, correct | EXACT, correct (SMC period-luminosity) |
| Mercury perihelion precession | obscure | EXACT, correct (Le Verrier) | EXACT 1859, correct | EXACT, correct (38/43 arcsec residual) |
| Andromeda as a galaxy | obscure | EXACT, correct (Hubble) | EXACT 1923, correct | EXACT, correct (M31 V1 Cepheid) |
| Greenhouse climate sensitivity | obscure | EXACT, correct (Arrhenius) | EXACT 1896, correct | EXACT, correct (5-6 C CO2 doubling) |
| Continental drift | obscure | EXACT, correct (Wegener) | EXACT 1912, correct | EXACT, correct |
| Penicillin as antibiotic | obscure | EXACT, correct (Fleming) | APPROX 1928, correct | EXACT, correct |
| Cosmic microwave background | obscure | EXACT, correct (Penzias + Wilson) | EXACT 1965, correct | EXACT, correct (3.5 K at 7.35 cm) |
| DNA double helix | obscure | EXACT, correct (Watson + Crick, Franklin data noted) | EXACT 1953, correct | EXACT, correct (Photo 51) |
| Spiral nebulae as rotating systems | obscure | EXACT, WRONG OBJECT | EXACT 1914, correct | EXACT, method right, object wrong |
| Phases of Venus | obscure | EXACT, correct (Galileo) | APPROX 1610, correct | EXACT, correct |

## Coverage numbers

45 fact fields across 15 concepts:

- EXACT: 40 / 45
- APPROXIMATE: 5 / 45 - all dates, never discoverer or key observation
- UNKNOWN: 0 / 45
- Invented or confident error: 1 field-level incident (spiral-galaxies
  discoverer + observation, one conflation)

Every tier was covered: famous, mid, and obscure all returned correct,
confidently marked facts. Parametric coverage of canonical discovery history
is strong at this model.

## Hedges vs fabrication

Hedges were used well and in the right places: gravity date (1687 publication
vs 1660s calculation), penicillin (September 1928), phases of Venus (1610
conventional date), Leavitt (1908 vs 1912), marine chronometer (H1-H4 lineage
noted), DNA (Franklin and Gosling credit noted). The model explains why a
date is approximate instead of hiding the uncertainty.

One fabrication-adjacent incident: spiral nebulae rotation. Slipher did
measure spiral rotation in 1914, but of M31 - the model said the Sombrero
nebula M104, which is historically Pease 1916-18. Person, date, and method
were right; the object was confidently wrong, with confidence marked high.
That is the failure shape to defend against: not a missing fact but a
confident conflation, invisible without a ground-truth check.

## Reliability finding: silent empty completions

With `max_tokens: 500`, 5 of 15 concepts returned EMPTY content: gravity,
natural selection, marine chronometer, Andromeda, spiral nebulae - exactly
the questions the model reasoned longest about. The usage report showed the
full completion budget consumed by reasoning tokens
(`completion_tokens: 500`, `reasoning_tokens: 500`): the model reasons until
the budget dies and content is never emitted. At `max_tokens: 3000-5000` all
15 answered.

This matches a warning already in `src/lib/agent/llm.js` ("headroom matters:
a low cap truncates JSON"). For the tree generator this means: token budget,
retry, and a no-output detection path are not optional. An empty reply is
the model's most common failure mode on hard nodes, and it must resolve to a
gap, not to an invented observation.

## Contract probe (does the model play honest when told?)

Four extra calls under a strict honesty prompt:

- Vulcan (Le Verrier's predicted planet, never observed): the model did NOT
  invent a confirmed observation. It documented Lescarbault's claimed 1859
  transit, marked the fields EXACT as documented history, and noted
  explicitly "never confirmed and subsequently rejected as a real object".
  Correct handling of a discovery whose observation never happened.
- Invented discoverer (Klaus von Ferber, 1935, stalagmite magnetism): all
  three fields returned UNKNOWN, confidence low, with the note "this appears
  to be a fabricated or misattributed claim". The UNKNOWN instruction works
  under pressure.
- First cosmic X-ray source (Giacconi, Gursky, Paolini, Rossi): EXACT, fully
  correct (1962-06-18, Sco X-1).
- Oil-drop experiment (Millikan + Fletcher): APPROXIMATE marks with correct
  reasoning (1909 vs 1911, shared credit) and correct observation.

Conclusion: told to be honest, the model marks UNKNOWN instead of
confabulating, and documents contested claims accurately. The residual risk
is the confident conflation, which honesty instructions reduce but do not
remove (1 incident in this probe set).

## Raw data

Raw responses: `probe-raw.md`, `retry5-raw.md`, `probe-contract-raw.md` next
to the probe script in the temp dir (not in the repo, key never touched the
repo). Probe script: `probe.cjs`, `retry5.cjs`, `probe-contract.cjs`.
