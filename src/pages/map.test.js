import { test } from "node:test";
import assert from "node:assert/strict";

import { skeletonBands } from "./map.js";

test("the skeleton mirrors the vertical-path tree with a chain of layer bands", () => {
  const bands = skeletonBands();
  assert.ok(bands.length >= 3, `expected a layered skeleton, got ${bands.length}`);
  for (const band of bands) {
    assert.ok(
      Number.isInteger(band.cards) && band.cards >= 1,
      `every band carries at least one card placeholder: ${JSON.stringify(band)}`
    );
  }
});
