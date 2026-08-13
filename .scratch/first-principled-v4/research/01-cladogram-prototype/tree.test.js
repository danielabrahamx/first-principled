import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { sampleMap } from "./sample-map.js";
import {
  treeLayout,
  cladogramPaths,
  trunkReveal,
  layerReveal,
  TREE_CARD_WIDTH,
  TREE_CARD_HEIGHT,
  TREE_CARD_GAP,
  TREE_COLUMN_GAP,
  TREE_ROOT_GAP,
  TREE_LABEL_GAP,
  TREE_DIVERGENCE_STEP,
} from "./tree.js";

const here = dirname(fileURLToPath(import.meta.url));

test("sample chronology: apps crown-nearest, physics foundations, dates inside layers", () => {
  assert.deepEqual(
    sampleMap.branches.map((branch) => branch.name),
    ["apps", "OS", "logic", "electronics", "materials", "physics"]
  );
  assert.deepEqual(
    sampleMap.branches[2].nodes.map((node) => node.label),
    ["logic gate", "bit"]
  );
  assert.deepEqual(
    sampleMap.branches[3].nodes.map((node) => node.label),
    ["transistor", "circuit"]
  );
});

test("treeLayout: 6 distinct increasing divergenceY, even right odd left, deepest-nearest", () => {
  const layout = treeLayout(sampleMap);
  assert.equal(layout.branches.length, 6);
  assert.equal(layout.root.y, 0);

  const ys = layout.branches.map((branch) => branch.divergenceY);
  const unique = new Set(ys);
  assert.equal(unique.size, 6, "six distinct divergence depths");
  for (let i = 1; i < ys.length; i++) {
    assert.ok(ys[i] > ys[i - 1], "divergence depth strictly increasing");
    assert.equal(ys[i] - ys[i - 1], TREE_DIVERGENCE_STEP);
  }
  assert.equal(ys[0] - (layout.root.y + layout.root.height), TREE_ROOT_GAP);

  const trunk = layout.root.cx;
  for (let i = 0; i < layout.branches.length; i++) {
    if (i % 2 === 0) {
      assert.ok(layout.branches[i].cx > trunk, `even branch ${i} sits right of trunk`);
    } else {
      assert.ok(layout.branches[i].cx < trunk, `odd branch ${i} sits left of trunk`);
    }
  }

  /** @param {{ cx: number }} branch */
  const dist = (branch) => Math.abs(branch.cx - trunk);
  assert.ok(dist(layout.branches[5]) < dist(layout.branches[3]));
  assert.ok(dist(layout.branches[3]) < dist(layout.branches[1]));
  assert.ok(dist(layout.branches[4]) < dist(layout.branches[2]));
  assert.ok(dist(layout.branches[2]) < dist(layout.branches[0]));

  const cxs = layout.branches.map((branch) => branch.cx).sort((a, b) => a - b);
  for (let i = 1; i < cxs.length; i++) {
    assert.equal(cxs[i] - cxs[i - 1], TREE_CARD_WIDTH + TREE_COLUMN_GAP);
  }

  for (const branch of layout.branches) {
    assert.equal(branch.firstCardY, branch.divergenceY + TREE_LABEL_GAP);
  }
  const electronics = layout.branches[3];
  assert.equal(electronics.cards.length, 2);
  assert.equal(
    electronics.cards[1].y - electronics.cards[0].y,
    TREE_CARD_HEIGHT + TREE_CARD_GAP
  );
});

test("treeLayout balances an odd branch count around the trunk", () => {
  /** @param {number} i */
  const mk = (i) => ({
    id: `b${i}`,
    name: `layer ${i}`,
    nodes: [{ id: `n${i}`, label: `node ${i}` }],
  });
  const layout = treeLayout({
    rootLabel: "x",
    branches: [mk(0), mk(1), mk(2), mk(3), mk(4)],
  });
  const trunk = layout.root.cx;
  for (const branch of layout.branches) {
    assert.ok(
      Math.abs(branch.cx - trunk) >= TREE_CARD_WIDTH / 2 + TREE_COLUMN_GAP / 2
    );
  }
  const cxs = layout.branches.map((branch) => branch.cx);
  assert.equal(Math.min(...cxs) - TREE_CARD_WIDTH / 2, 0);
  assert.equal(Math.max(...cxs) + TREE_CARD_WIDTH / 2, layout.width);
});

test("treeLayout centers a single branch on the trunk", () => {
  const layout = treeLayout({
    rootLabel: "x",
    branches: [{ id: "b", name: "layer", nodes: [{ id: "n", label: "node" }] }],
  });
  assert.equal(layout.width, TREE_CARD_WIDTH);
  assert.equal(layout.branches[0].cx, layout.root.cx);
});

test("cladogramPaths: trunk to deepest divergence, one elbow per branch", () => {
  const layout = treeLayout(sampleMap);
  const d = cladogramPaths(layout);
  const connectors = layout.branches.reduce(
    (sum, branch) => sum + Math.max(0, branch.cards.length - 1),
    0
  );
  assert.equal(d.length, 1 + layout.branches.length + connectors);

  const last = layout.branches[layout.branches.length - 1];
  assert.equal(
    d[0],
    `M ${layout.root.cx} ${layout.root.y + layout.root.height} V ${last.divergenceY}`
  );

  let at = 1;
  for (const branch of layout.branches) {
    assert.equal(
      d[at],
      `M ${layout.root.cx} ${branch.divergenceY} H ${branch.cx} V ${branch.firstCardY}`
    );
    at += 1;
    for (let j = 1; j < branch.cards.length; j++) {
      const prev = branch.cards[j - 1];
      const card = branch.cards[j];
      assert.equal(
        d[at],
        `M ${branch.cx} ${prev.y + TREE_CARD_HEIGHT} V ${card.y}`
      );
      at += 1;
    }
  }
  assert.equal(at, d.length);
});

test("trunkReveal and layerReveal at progress 1 are fully visible", () => {
  assert.equal(trunkReveal(1), 1);
  for (let i = 0; i < 6; i++) {
    assert.equal(layerReveal(1, 6, i), 1, `layer ${i} fully visible at progress 1`);
  }
  assert.equal(trunkReveal(0), 0);
  assert.equal(layerReveal(0, 6, 0), 0, "crown-most layer hidden at time 0");
  assert.equal(layerReveal(0, 6, 5), 0, "foundation layer hidden at time 0");
  assert.ok(layerReveal(0.6, 6, 5) > 0, "physics (deepest) buds before apps");
  assert.equal(layerReveal(0.6, 6, 0), 0, "apps still hidden while physics buds");
});

test("layerReveal does not use scroll: progress is elapsed 0..1", () => {
  const src = readFileSync(join(here, "tree.js"), "utf8");
  const fnBody = (name) => {
    const match = src.match(
      new RegExp(`export function ${name}\\([^)]*\\) \\{[^}]*\\}`)
    );
    assert.ok(match, `${name} source found`);
    return match[0];
  };
  for (const name of ["trunkReveal", "layerReveal"]) {
    const body = fnBody(name);
    assert.doesNotMatch(body, /scrollY/);
    assert.doesNotMatch(body, /window/);
    assert.doesNotMatch(body, /addEventListener/);
  }
  assert.doesNotMatch(src, /addEventListener\(\s*["']scroll["']/);
  assert.equal(layerReveal(1, 6, 0), 1);
  assert.equal(layerReveal(1, 6, 5), 1);
});

test("375px invariant is CSS-enforced: page hidden, stage scrolls", () => {
  const css = readFileSync(join(here, "styles.css"), "utf8");
  assert.match(css, /html,\s*body\s*\{[^}]*overflow-x:\s*hidden/s);
  assert.match(css, /\.mt-tree-scroll\s*\{[^}]*overflow-x:\s*auto/s);
});
