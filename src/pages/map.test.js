import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { skeletonBands } from "./map.js";

const here = path.dirname(fileURLToPath(import.meta.url));

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

test("the Tree header has a Tutor toggle and no page tabs", () => {
  const source = readFileSync(path.join(here, "map.js"), "utf8");
  assert.match(source, /tutor-toggle/);
  assert.match(source, /aria-label",\s*"Tutor"/);
  assert.match(source, /aria-expanded/);
  assert.doesNotMatch(source, /"Chat"/);
  assert.doesNotMatch(source, /"Reality"/);
  assert.doesNotMatch(source, /seg-item/);
});

test("Tutor is a bottom sheet, not a 340px side rail", () => {
  const css = readFileSync(path.join(here, "..", "styles.css"), "utf8");
  const source = readFileSync(path.join(here, "map.js"), "utf8");
  const orchestrator = readFileSync(
    path.join(here, "..", "lib", "agent", "orchestrator.js"),
    "utf8"
  );
  assert.doesNotMatch(css, /minmax\(0,\s*1fr\)\s+340px/);
  assert.match(css, /--tutor-sheet/);
  assert.match(css, /position:\s*fixed/);
  assert.match(source, /tutor-sheet/);
  assert.match(source, /page\.classList\.toggle\("tutor-open"/);
  assert.doesNotMatch(source, /split\.classList\.toggle\("tutor-open"/);
  assert.match(orchestrator, /forceBrief:\s*true/);
});

test("index.html has one Tree home and no chat view", () => {
  const html = readFileSync(path.join(here, "..", "index.html"), "utf8");
  assert.match(html, /id="view-map"/);
  assert.doesNotMatch(html, /id="view-chat"/);
  assert.doesNotMatch(html, />Ask</);
});
