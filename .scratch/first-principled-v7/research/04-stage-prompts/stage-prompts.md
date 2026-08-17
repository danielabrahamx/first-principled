# Prompt prototype: three-stage Tree prompts

**Locked:** Danny, 2026-08-17. Ticket 05 wires this file as-is.
Iterate only after the four-topic KEEP/KILL test, not by retuning first.

This is the implementation input for
[The generator is three stages and nothing else](../../issues/05-the-generator-is-three-stages-and-nothing-else.md).
It turns the architecture lock in `round-1-verdict.md` into three prompts,
three complete JSON contracts, and one worked battery example.

The architecture is falsifiable. It gets one pass per Stage and no repair
call. The learner receives only the checked `map` from Arrange. Chronology,
raw Epiphanies, provenance, discarded IDs, and prompts remain server-side.

## Stage 1 - Chronology

### System prompt

```text
Identify a short ordered chain of target-specific capability regimes that
made the requested target possible.

Each regime must introduce a capability needed by a later regime and by the
target. Physical ancestry is the default spine. Use technical ancestry for
constructed capabilities and conceptual ancestry for abstract ideas. Include
a regime only when removing it would break a reasonably direct account of the
target.

Return JSON only with concept and chronology. Each chronology item has id,
regime, new_capability, enabled_by_previous, ancestry_kind, and
target_relevance. IDs are c1, c2, and so on. enabled_by_previous may name
multiple earlier IDs but never a later ID.

Do not give discovery history, a Tree, or universal ancestry. Do not list
discoverers, dates, inventions, layers, cards, or Dependence edges. Do not
start from the Big Bang, stars, civilization, or a generic field sequence.
Do not teach the topic, personalize it, reward breadth, or promise that every
item will appear in the final Tree.
```

### Input

```json
{
  "concept": "<word or phrase>"
}
```

### Output contract

```json
{
  "concept": "<same word or phrase>",
  "chronology": [
    {
      "id": "c1",
      "regime": "<noun phrase naming a stable capability regime>",
      "new_capability": "<what became possible>",
      "enabled_by_previous": [],
      "ancestry_kind": "PHYSICAL",
      "target_relevance": "<why removing this breaks a direct account of the target>"
    }
  ]
}
```

Rules:

- `chronology` is ordered from the earliest useful regime to the
  target-nearest regime.
- `ancestry_kind` is exactly `PHYSICAL`, `TECHNICAL`, or `CONCEPTUAL`.
- A natural process may use functional physical order, but must not claim a
  speculative evolutionary history.
- An abstract target uses conceptual capability ancestry, not a history of
  people or terminology.
- `enabled_by_previous` contains only IDs earlier in the array. It may contain
  more than one ID so convergent ancestry is not forced into one predecessor.
- The list is deliberately lossy and short. It is not the future trunk.

## Stage 2 - Epiphanies

### System prompt

```text
Identify the results that warrant transitions between the supplied capability
regimes. A result is the joint. Human history documents how that result was
established; a person's private insight is not the joint.

Return JSON only with concept and epiphanies. Each item has id, from_regimes,
to_regimes, result, joint_kind, history, and candidate_node. Name the result
first. Then record who, when, and the observation, proof, formalization, or
engineered result that established it. Use UNKNOWN or NO_SINGLE_JOINT when
history does not support a precise event.

Do not arrange a Tree, rewrite the Chronology, or force one item for every
transition. Do not force one hero or date, confuse first observation with
accepted explanation, apply laboratory language to mathematics, add famous
names for decoration, or invent facts to avoid UNKNOWN.
```

### Input

The complete Stage 1 output.

### Output contract

```json
{
  "concept": "<same word or phrase>",
  "epiphanies": [
    {
      "id": "e1",
      "from_regimes": ["c1"],
      "to_regimes": ["c2"],
      "result": "<the result that warrants this transition>",
      "joint_kind": "EXPERIMENTAL_RESULT",
      "history": {
        "certainty": "EXACT",
        "who": ["<person or group>"],
        "when": "<date or bounded period>",
        "observation": "<observation, proof, formalization, or engineered result>",
        "uncertainty_note": ""
      },
      "candidate_node": "<concrete rabbit-hole target or null>"
    }
  ]
}
```

Rules:

- `from_regimes` and `to_regimes` contain valid Stage 1 IDs.
- `joint_kind` is exactly `OBSERVATION`, `EXPERIMENTAL_RESULT`,
  `ENGINEERED_RESULT`, `FORMALIZATION`, `PROOF`, `GRADUAL_SYNTHESIS`, or
  `NO_SINGLE_JOINT`.
- `certainty` is exactly `EXACT`, `APPROXIMATE`, or `UNKNOWN`.
- `EXACT` requires non-empty `who`, `when`, and `observation`, with a precise
  claim.
- `APPROXIMATE` permits an empty `who` or null `when`, but requires a non-empty
  `observation` and `uncertainty_note`.
- `UNKNOWN` requires empty `who`, null `when`, null `observation`, and a
  non-empty `uncertainty_note`.
- `NO_SINGLE_JOINT` must not be dressed up with a token famous person.
- `candidate_node` is a string or null. It is a suggestion, not a guaranteed
  final node.
- There may be zero, one, or several joints between regimes.

## Stage 3 - Arrange

### System prompt

```text
Arrange the supplied capability regimes and joints into one followable
Dependence Tree for a curious adult who opens rabbit holes.

The crown is the requested target. Make one clear walk from an observable
Foundation to the crown, with small conceptual jumps and concrete node names.
Branches must provide genuine support. Every edge means the source cannot
exist or be understood without the target. Its because text must complete:
"The source rests on the target because without the target..."

You may reorder, drop, collapse, rename, and promote inputs. Chronology is not
a spanning chain. Calendar order is never evidence for an edge. Preserve an
observation record only when its node has role EPIPHANY. Mark grouping-only
nodes STRUCTURAL. Mark other nodes DOMAIN.

Return JSON only with map and provenance. Cite chronology or epiphany IDs for
every DOMAIN or EPIPHANY node and every edge. List every unused input ID with
a short reason. Provenance is diagnostic, not learner-facing.

Do not emit a timeline, preserve every input, regenerate a generic domain
table of contents, use "related to", "came before", or "helped lead to" as
Dependence, place an observation record on an ordinary node, add biographies
as prerequisites, use "physics", "chemistry", "biology", or "computer
science" as nodes unless that abstraction is itself a useful rabbit hole, add
disconnected branches, generate nested Trees, or copy the Stage 1 or Stage 2
payload into map.
```

### Input

```json
{
  "concept": "<word or phrase>",
  "chronology": ["<complete Stage 1 chronology items>"],
  "epiphanies": ["<complete Stage 2 epiphany items>"]
}
```

### Output contract

```json
{
  "map": {
    "concept": "<same word or phrase>",
    "layers": [
      {
        "id": "l0",
        "name": "<pedagogical kind of thing>",
        "nodes": ["n-foundation"]
      }
    ],
    "nodes": [
      {
        "id": "n-foundation",
        "label": "<concrete rabbit-hole target>",
        "layer": "l0",
        "description": "<short account of what this node contributes>",
        "role": "DOMAIN"
      }
    ],
    "edges": [
      {
        "source": "n-upper",
        "target": "n-lower",
        "type": "depends-on",
        "because": "<why the source cannot exist or be understood without the target>"
      }
    ],
    "trunk": ["n-foundation", "n-crown"]
  },
  "provenance": {
    "nodes": [
      {
        "node_id": "n-foundation",
        "input_refs": ["c1"]
      }
    ],
    "edges": [
      {
        "source": "n-upper",
        "target": "n-lower",
        "input_refs": ["c1", "c2", "e1"]
      }
    ],
    "discarded_input_ids": [
      {
        "id": "c3",
        "reason": "<why this input does not improve the final dependence path>"
      }
    ]
  }
}
```

Node rules:

- `role` is exactly `DOMAIN`, `EPIPHANY`, or `STRUCTURAL`.
- An `EPIPHANY` node must carry `basis`. `DOMAIN` and `STRUCTURAL` nodes must
  not carry `basis` or any other observation record.
- `basis` uses the existing learner-map observation shape:

```json
{
  "discoverer": {
    "value": "<joined Stage 2 history.who, or empty>",
    "mark": "EXACT"
  },
  "date": {
    "value": "<Stage 2 history.when, or empty>",
    "mark": "EXACT"
  },
  "keyObservation": {
    "value": "<Stage 2 history.observation, or empty>",
    "mark": "EXACT"
  },
  "confidence": "high",
  "note": "<Stage 2 uncertainty_note>"
}
```

- Arrange may only normalize a retained Stage 2 `history` into `basis`; it
  must not add historical facts.
- For Stage 2 `EXACT`, populated fields use `EXACT` and confidence is `high`.
- For Stage 2 `APPROXIMATE`, populated fields use `APPROXIMATE`, missing
  fields use `UNKNOWN` with an empty value, and confidence is `medium` or
  `low`.
- For Stage 2 `UNKNOWN`, all three fields use `UNKNOWN` with empty values and
  confidence is `low`.
- A convergence `combines` record, if retained, is permitted only on an
  `EPIPHANY` node and follows the same observation rules.
- Every `DOMAIN` and `EPIPHANY` node has at least one valid provenance input
  reference. A `STRUCTURAL` node may have an empty `input_refs` array.

Map rules:

- `layers` are ordered from Foundation to crown and use contiguous IDs.
- `trunk` is ordered from Foundation to crown. Every trunk ID exists and
  every consecutive pair has an edge from the higher node to the lower node.
- The target is the single crown. The graph is connected and acyclic.
- Edge direction follows the existing Reality Map convention: upper
  `source` rests on lower `target`.
- Edge `type` is exactly `part-of`, `depends-on`, `built-on`,
  `abstraction-of`, `predicts`, or `contradicts`.
- Extra parents are allowed because the current Tree represents convergent
  support. The gate does not force the map into a one-parent graph.
- Every chronology and epiphany ID appears either in provenance or in
  `discarded_input_ids`, never neither.
- Only `map` crosses the learner-facing API boundary. `provenance` remains in
  server diagnostics and tests. `role` remains machine-readable in `map` but
  is not learner copy.

## Worked example - battery

The values below demonstrate the contracts. They are prototype data, not a
claim that this is the final gold battery Tree.

### Stage 1 output

```json
{
  "concept": "battery",
  "chronology": [
    {
      "id": "c1",
      "regime": "Matter can separate and carry charge",
      "new_capability": "Separated charge can create electrical effects and move through a path.",
      "enabled_by_previous": [],
      "ancestry_kind": "PHYSICAL",
      "target_relevance": "A battery requires charge separation and charge flow."
    },
    {
      "id": "c2",
      "regime": "Different materials can sustain electrical potential",
      "new_capability": "A stable voltage can exist between unlike material conditions.",
      "enabled_by_previous": ["c1"],
      "ancestry_kind": "PHYSICAL",
      "target_relevance": "A cell needs a potential difference across its terminals."
    },
    {
      "id": "c3",
      "regime": "Ionic and electronic paths can form a cell",
      "new_capability": "Ions can move internally while electrons move through an external path.",
      "enabled_by_previous": ["c1", "c2"],
      "ancestry_kind": "TECHNICAL",
      "target_relevance": "The two coordinated paths are the operating structure of an electrochemical cell."
    },
    {
      "id": "c4",
      "regime": "Chemical reactions can drive current through the cell",
      "new_capability": "A redox reaction can maintain electron flow instead of merely releasing static charge.",
      "enabled_by_previous": ["c3"],
      "ancestry_kind": "PHYSICAL",
      "target_relevance": "This is the energy-conversion mechanism of a battery."
    },
    {
      "id": "c5",
      "regime": "Some cell reactions can be reversed",
      "new_capability": "Electrical energy can restore chemical differences for repeated use.",
      "enabled_by_previous": ["c4"],
      "ancestry_kind": "TECHNICAL",
      "target_relevance": "This enables rechargeable batteries, but is not required by every battery."
    }
  ]
}
```

### Stage 2 output

```json
{
  "concept": "battery",
  "epiphanies": [
    {
      "id": "e1",
      "from_regimes": ["c2"],
      "to_regimes": ["c3"],
      "result": "Dissimilar materials separated by a moist conductor can produce sustained current.",
      "joint_kind": "ENGINEERED_RESULT",
      "history": {
        "certainty": "EXACT",
        "who": ["Alessandro Volta"],
        "when": "1800",
        "observation": "A stack of dissimilar metal pairs separated by brine-soaked material produced continuous current.",
        "uncertainty_note": ""
      },
      "candidate_node": "electrochemical cell"
    },
    {
      "id": "e2",
      "from_regimes": ["c3"],
      "to_regimes": ["c4"],
      "result": "The current produced by a cell depends on chemical reactions, not only contact between metals.",
      "joint_kind": "EXPERIMENTAL_RESULT",
      "history": {
        "certainty": "APPROXIMATE",
        "who": ["Humphry Davy"],
        "when": "early 1800s",
        "observation": "Experiments with the voltaic pile connected electrical current with chemical decomposition and affinity.",
        "uncertainty_note": "The result emerged through several experiments and its interpretation changed over time."
      },
      "candidate_node": "redox reaction"
    },
    {
      "id": "e3",
      "from_regimes": ["c4"],
      "to_regimes": ["c5"],
      "result": "Suitable electrode reactions can be driven in reverse so the cell can be used again.",
      "joint_kind": "NO_SINGLE_JOINT",
      "history": {
        "certainty": "UNKNOWN",
        "who": [],
        "when": null,
        "observation": null,
        "uncertainty_note": "No single historical joint is asserted for the general transition to reversible storage."
      },
      "candidate_node": "reversible electrode reaction"
    }
  ]
}
```

There is no forced Epiphany between `c1` and `c2`. Stage 2 is allowed to
leave that transition without a manufactured hero or date.

### Stage 3 output

```json
{
  "map": {
    "concept": "battery",
    "layers": [
      {
        "id": "l0",
        "name": "charge behavior",
        "nodes": ["n-charge-separation", "n-electron-transfer", "n-ion-movement"]
      },
      {
        "id": "l1",
        "name": "electrochemical processes",
        "nodes": ["n-potential-difference", "n-redox-reaction", "n-electrolyte"]
      },
      {
        "id": "l2",
        "name": "cell structure",
        "nodes": ["n-electrochemical-cell"]
      },
      {
        "id": "l3",
        "name": "energy source",
        "nodes": ["n-battery"]
      }
    ],
    "nodes": [
      {
        "id": "n-charge-separation",
        "label": "charge separation",
        "layer": "l0",
        "description": "An imbalance of charge creates an electrical push.",
        "role": "DOMAIN"
      },
      {
        "id": "n-electron-transfer",
        "label": "electron transfer",
        "layer": "l0",
        "description": "Electrons move between reacting species and through the external path.",
        "role": "DOMAIN"
      },
      {
        "id": "n-ion-movement",
        "label": "ion movement",
        "layer": "l0",
        "description": "Charged atoms or molecules move internally to prevent charge from accumulating.",
        "role": "DOMAIN"
      },
      {
        "id": "n-potential-difference",
        "label": "potential difference",
        "layer": "l1",
        "description": "Different electrical conditions at two terminals provide voltage.",
        "role": "DOMAIN"
      },
      {
        "id": "n-redox-reaction",
        "label": "redox reaction",
        "layer": "l1",
        "description": "Coupled oxidation and reduction sustain electron flow.",
        "role": "EPIPHANY",
        "basis": {
          "discoverer": {
            "value": "Humphry Davy",
            "mark": "APPROXIMATE"
          },
          "date": {
            "value": "early 1800s",
            "mark": "APPROXIMATE"
          },
          "keyObservation": {
            "value": "Experiments with the voltaic pile connected electrical current with chemical decomposition and affinity.",
            "mark": "APPROXIMATE"
          },
          "confidence": "medium",
          "note": "The result emerged through several experiments and its interpretation changed over time."
        }
      },
      {
        "id": "n-electrolyte",
        "label": "electrolyte",
        "layer": "l1",
        "description": "An ion-conducting medium closes the internal path.",
        "role": "DOMAIN"
      },
      {
        "id": "n-electrochemical-cell",
        "label": "electrochemical cell",
        "layer": "l2",
        "description": "Electrodes and an electrolyte coordinate chemical and electrical paths.",
        "role": "EPIPHANY",
        "basis": {
          "discoverer": {
            "value": "Alessandro Volta",
            "mark": "EXACT"
          },
          "date": {
            "value": "1800",
            "mark": "EXACT"
          },
          "keyObservation": {
            "value": "A stack of dissimilar metal pairs separated by brine-soaked material produced continuous current.",
            "mark": "EXACT"
          },
          "confidence": "high",
          "note": ""
        }
      },
      {
        "id": "n-battery",
        "label": "battery",
        "layer": "l3",
        "description": "One or more electrochemical cells provide electrical energy at terminals.",
        "role": "DOMAIN"
      }
    ],
    "edges": [
      {
        "source": "n-battery",
        "target": "n-electrochemical-cell",
        "type": "built-on",
        "because": "Without an electrochemical cell there is no device that converts stored chemical difference into terminal voltage and current."
      },
      {
        "source": "n-electrochemical-cell",
        "target": "n-potential-difference",
        "type": "depends-on",
        "because": "Without a potential difference the cell has no electrical push across its terminals."
      },
      {
        "source": "n-potential-difference",
        "target": "n-charge-separation",
        "type": "depends-on",
        "because": "Without separated charge there is no voltage between the terminal conditions."
      },
      {
        "source": "n-electrochemical-cell",
        "target": "n-redox-reaction",
        "type": "depends-on",
        "because": "Without redox reactions the cell cannot sustain the transfer of electrons."
      },
      {
        "source": "n-redox-reaction",
        "target": "n-electron-transfer",
        "type": "depends-on",
        "because": "Without electron transfer oxidation and reduction do not occur."
      },
      {
        "source": "n-electrochemical-cell",
        "target": "n-electrolyte",
        "type": "built-on",
        "because": "Without an ion-conducting internal path charge would accumulate and current would stop."
      },
      {
        "source": "n-electrolyte",
        "target": "n-ion-movement",
        "type": "depends-on",
        "because": "Without moving ions the electrolyte cannot carry charge through the cell."
      }
    ],
    "trunk": [
      "n-charge-separation",
      "n-potential-difference",
      "n-electrochemical-cell",
      "n-battery"
    ]
  },
  "provenance": {
    "nodes": [
      {
        "node_id": "n-charge-separation",
        "input_refs": ["c1"]
      },
      {
        "node_id": "n-electron-transfer",
        "input_refs": ["c1", "c4"]
      },
      {
        "node_id": "n-ion-movement",
        "input_refs": ["c3"]
      },
      {
        "node_id": "n-potential-difference",
        "input_refs": ["c2"]
      },
      {
        "node_id": "n-redox-reaction",
        "input_refs": ["c4", "e2"]
      },
      {
        "node_id": "n-electrolyte",
        "input_refs": ["c3"]
      },
      {
        "node_id": "n-electrochemical-cell",
        "input_refs": ["c3", "e1"]
      },
      {
        "node_id": "n-battery",
        "input_refs": ["c3", "c4"]
      }
    ],
    "edges": [
      {
        "source": "n-battery",
        "target": "n-electrochemical-cell",
        "input_refs": ["c3", "c4"]
      },
      {
        "source": "n-electrochemical-cell",
        "target": "n-potential-difference",
        "input_refs": ["c2", "c3", "e1"]
      },
      {
        "source": "n-potential-difference",
        "target": "n-charge-separation",
        "input_refs": ["c1", "c2"]
      },
      {
        "source": "n-electrochemical-cell",
        "target": "n-redox-reaction",
        "input_refs": ["c3", "c4", "e2"]
      },
      {
        "source": "n-redox-reaction",
        "target": "n-electron-transfer",
        "input_refs": ["c1", "c4"]
      },
      {
        "source": "n-electrochemical-cell",
        "target": "n-electrolyte",
        "input_refs": ["c3", "e1"]
      },
      {
        "source": "n-electrolyte",
        "target": "n-ion-movement",
        "input_refs": ["c3"]
      }
    ],
    "discarded_input_ids": [
      {
        "id": "c5",
        "reason": "Reversible storage is specific to rechargeable batteries and is not required to explain the requested target."
      },
      {
        "id": "e3",
        "reason": "The reversible-reaction joint supports the discarded rechargeable-only regime."
      }
    ]
  }
}
```

### Learner-facing Tree

The learner receives the checked `map`, rendered approximately as:

```text
battery
└─ electrochemical cell [epiphany record]
   ├─ potential difference
   │  └─ charge separation
   ├─ redox reaction [epiphany record]
   │  └─ electron transfer
   └─ electrolyte
      └─ ion movement
```

No chronology, raw epiphany JSON, provenance, discarded ID, or prompt text is
present in the learner payload.

## Mechanical gate for ticket 05

The gate establishes structure and honesty, not semantic truth:

- exact JSON shape for all three Stage outputs;
- valid and prior-only Chronology references;
- valid Epiphany regime references and certainty rules;
- one crown, one declared contiguous trunk, connected and acyclic map;
- contiguous layer IDs and mirrored layer membership;
- valid Foundation-to-crown trunk edges in the existing edge direction;
- observation records only on `EPIPHANY` nodes;
- no value under an `UNKNOWN` observation field;
- all provenance IDs resolve;
- every domain node and every edge has provenance;
- every Stage 1 and Stage 2 ID is used or explicitly discarded;
- learner response contains `map` only.

It cannot establish that Dependence is true, Chronology found the decisive
regimes, provenance is semantically honest, or Danny would walk the Tree.
Those are benchmark results.

## Falsification rule

Compare this builder with the one-shot generator on laptop, battery,
photosynthesis, and recursion. If Arrange repeatedly preserves Chronology as
the layout or ignores it while producing the old table of contents, reject
the funnel. Do not add prompt machinery, a repair loop, or a retune ticket to
rescue it. The replacement candidate is an unordered prerequisite inventory,
then evidence enrichment, then Arrange.
