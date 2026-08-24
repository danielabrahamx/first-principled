import { test } from "node:test";
import assert from "node:assert/strict";

import { growLayout } from "./grow.js";
import {
  TREE_ARROW_GAP,
  TREE_CARD_HEIGHT,
} from "./tree.js";

const CHRONOLOGY = [
  {
    id: "r1",
    regime: "Static charge",
    new_capability: "Sparks that can be stored and moved.",
    enabled_by_previous: false,
    ancestry_kind: "origin",
    target_relevance: "indirect",
  },
  {
    id: "r2",
    regime: "Voltaic pile",
    new_capability: "A steady current from stacked cells.",
    enabled_by_previous: true,
    ancestry_kind: "extension",
    target_relevance: "direct",
  },
  {
    id: "r3",
    regime: "Lead-acid cell",
    new_capability: "Rechargeable current on demand.",
    enabled_by_previous: true,
    ancestry_kind: "extension",
    target_relevance: "direct",
  },
];

test("accepted Chronology draws one temporary spine card per regime", () => {
  const layout = growLayout(
    { concept: "battery", chronology: CHRONOLOGY },
    { width: 800 }
  );
  assert.equal(layout.cards.length, CHRONOLOGY.length);
  for (const [index, card] of layout.cards.entries()) {
    assert.equal(card.label, CHRONOLOGY[index].regime);
    assert.equal(card.gloss, CHRONOLOGY[index].new_capability);
  }
});

test("the spine keeps Chapel orientation: foundations above, crown at the bottom", () => {
  const layout = growLayout(
    { concept: "battery", chronology: CHRONOLOGY },
    { width: 800 }
  );
  const [first, second, last] = layout.cards;
  assert.ok(first.y < second.y && second.y < last.y);
  assert.equal(last.crown, true);
  assert.equal(first.crown, false);
  assert.ok(
    last.y - first.y >= (CHRONOLOGY.length - 1) * (TREE_CARD_HEIGHT + TREE_ARROW_GAP) - 1
  );
  // One column: every card shares the trunk.
  for (const card of layout.cards) {
    assert.equal(card.x + card.width / 2, layout.trunk);
  }
});

test("chronology-only shows no arrows and no epiphany cards", () => {
  const layout = growLayout(
    { concept: "battery", chronology: CHRONOLOGY },
    { width: 800 }
  );
  assert.equal(layout.arrows.length, 0);
});

test("accepted Epiphanies grow labeled arrows between regimes, never extra cards", () => {
  const snapshot = {
    concept: "battery",
    chronology: CHRONOLOGY,
    epiphanies: [
      {
        id: "e1",
        from_regimes: ["r1"],
        to_regimes: ["r2"],
        result: "Storing charge makes a steady current possible.",
        joint_kind: "refinement",
        candidate_node: "The pile",
      },
      {
        id: "e2",
        from_regimes: ["r2"],
        to_regimes: ["r3"],
        result: "A reversible reaction stores current chemically.",
        joint_kind: "refinement",
        candidate_node: "The cell",
      },
    ],
  };
  const layout = growLayout(snapshot, { width: 800 });
  assert.equal(layout.cards.length, CHRONOLOGY.length, "no epiphany cards");
  assert.equal(layout.arrows.length, snapshot.epiphanies.length);
  assert.equal(layout.arrows[0].because, snapshot.epiphanies[0].result);
  assert.equal(layout.arrows[1].because, snapshot.epiphanies[1].result);
  // Each arrow runs downward from its from-regime to its to-regime.
  assert.match(layout.arrows[0].d, /^M \d+(\.\d+)? \d+(\.\d+)? V \d+(\.\d+)?$/);
  const yOf = Object.fromEntries(layout.cards.map((card) => [card.id, card.y]));
  assert.ok(yOf.r1 < yOf.r2 && yOf.r2 < yOf.r3);
});

test("epiphanies whose regimes are missing or inverted draw nothing unsafe", () => {
  const snapshot = {
    concept: "battery",
    chronology: CHRONOLOGY,
    epiphanies: [
      { id: "e1", from_regimes: ["ghost"], to_regimes: ["r2"], result: "x" },
      { id: "e2", from_regimes: ["r2"], to_regimes: ["r1"], result: "y" },
      { id: "e3", from_regimes: [], to_regimes: ["r3"], result: "z" },
    ],
  };
  const layout = growLayout(snapshot, { width: 800 });
  assert.equal(layout.arrows.length, 0);
  assert.equal(layout.cards.length, CHRONOLOGY.length);
});

test("a missing or empty snapshot is a safe empty stage", () => {
  for (const snapshot of [null, undefined, {}, { chronology: [] }]) {
    const layout = growLayout(snapshot, { width: 375 });
    assert.equal(layout.cards.length, 0);
    assert.equal(layout.arrows.length, 0);
    assert.ok(Number.isFinite(layout.width) && layout.width > 0);
    assert.ok(Number.isFinite(layout.height));
  }
});

test("a narrow viewport keeps the spine inside the page", () => {
  const layout = growLayout(
    { concept: "battery", chronology: CHRONOLOGY },
    { width: 320 }
  );
  for (const card of layout.cards) {
    assert.ok(card.x >= 16, `card left edge ${card.x} inside padding`);
    assert.ok(card.x + card.width <= layout.width - 15, `card right edge inside ${layout.width}`);
  }
});
