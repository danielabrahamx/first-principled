import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CARD_WIDTH,
  CARD_HEIGHT,
  GAP,
  columnCount,
  gridMetrics,
  nodePositions,
  edgePaths,
} from "./layout.js";

test("columnCount grows with width up to the cap, never below 1", () => {
  assert.equal(columnCount(0), 1);
  assert.equal(columnCount(100), 1);
  assert.equal(columnCount(CARD_WIDTH + GAP - 1), 1);
  assert.equal(columnCount(CARD_WIDTH + GAP), 1);
  assert.equal(columnCount(2 * CARD_WIDTH + GAP - 1), 1);
  assert.equal(columnCount(2 * CARD_WIDTH + GAP), 2);
  assert.equal(columnCount(9999), 4);
});

test("gridMetrics computes rows and stage size from the node count", () => {
  assert.deepEqual(gridMetrics(0, 4), { columns: 0, rows: 0, width: 0, height: 0 });
  assert.deepEqual(gridMetrics(1, 4), { columns: 4, rows: 1, width: 4 * CARD_WIDTH + 3 * GAP, height: CARD_HEIGHT });
  assert.deepEqual(gridMetrics(4, 2), { columns: 2, rows: 2, width: 2 * CARD_WIDTH + GAP, height: 2 * CARD_HEIGHT + GAP });
  assert.deepEqual(gridMetrics(5, 2), { columns: 2, rows: 3, width: 2 * CARD_WIDTH + GAP, height: 3 * CARD_HEIGHT + 2 * GAP });
});

test("nodePositions flows nodes left-to-right then top-to-bottom", () => {
  const nodes = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }];
  const pos = nodePositions(nodes, 2);

  assert.deepEqual(pos.a, { x: 0, y: 0, cx: CARD_WIDTH / 2, cy: CARD_HEIGHT / 2 });
  assert.deepEqual(pos.b, { x: CARD_WIDTH + GAP, y: 0, cx: CARD_WIDTH + GAP + CARD_WIDTH / 2, cy: CARD_HEIGHT / 2 });
  assert.deepEqual(pos.c, { x: 0, y: CARD_HEIGHT + GAP, cx: CARD_WIDTH / 2, cy: CARD_HEIGHT + GAP + CARD_HEIGHT / 2 });
  // e is alone on the last row, so it starts a new row in column 0.
  assert.deepEqual(pos.e, { x: 0, y: 2 * (CARD_HEIGHT + GAP), cx: CARD_WIDTH / 2, cy: 2 * (CARD_HEIGHT + GAP) + CARD_HEIGHT / 2 });
});

test("edgePaths draws a curve between card edges for a neighbor pair", () => {
  const nodes = [{ id: "a" }, { id: "b" }];
  const pos = nodePositions(nodes, 2);
  const paths = edgePaths([{ source: "a", target: "b" }], pos);

  assert.equal(paths.length, 1);
  const d = paths[0].d;
  assert.match(d, /^M /);
  assert.match(d, / Q /);
  const tokens = d.split(" ");
  const [sx, sy] = [Number(tokens[1]), Number(tokens[2])];
  const [ex, ey] = [Number(tokens.at(-2)), Number(tokens.at(-1))];
  // The start hugs the right edge of card a; the end hugs the left edge of card b.
  assert.equal(sx, CARD_WIDTH);
  assert.equal(sy, CARD_HEIGHT / 2);
  assert.equal(ex, CARD_WIDTH + GAP);
  assert.equal(ey, CARD_HEIGHT / 2);
});

test("edgePaths anchors a vertical edge between stacked cards off the card faces", () => {
  const nodes = [{ id: "a" }, { id: "b" }];
  const pos = nodePositions(nodes, 1);
  const paths = edgePaths([{ source: "a", target: "b" }], pos);

  assert.equal(paths.length, 1);
  const tokens = paths[0].d.split(" ");
  const [, sy] = [Number(tokens[1]), Number(tokens[2])];
  assert.equal(sy, CARD_HEIGHT);
  const [, ey] = [Number(tokens.at(-2)), Number(tokens.at(-1))];
  assert.equal(ey, CARD_HEIGHT + GAP);
});

test("edgePaths skips edges with unknown endpoints and self loops", () => {
  const pos = nodePositions([{ id: "a" }], 2);
  assert.deepEqual(edgePaths([{ source: "a", target: "ghost" }], pos), []);
  assert.deepEqual(edgePaths([{ source: "ghost", target: "a" }], pos), []);
  assert.deepEqual(edgePaths([{ source: "a", target: "a" }], pos), []);
});
