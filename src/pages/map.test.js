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

test("the Tree header has no Tutor toggle and no page tabs", () => {
  const source = readFileSync(path.join(here, "map.js"), "utf8");
  assert.doesNotMatch(source, /tutor-toggle/);
  assert.doesNotMatch(source, /aria-label",\s*"Tutor"/);
  assert.doesNotMatch(source, /"Chat"/);
  assert.doesNotMatch(source, /"Reality"/);
  assert.doesNotMatch(source, /seg-item/);
});

test("layer overlays do not steal clicks from cards above them", () => {
  const css = readFileSync(path.join(here, "..", "styles.css"), "utf8");
  assert.match(css, /\.tree-layer\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(css, /\.tree-branch-card\s*\{[^}]*pointer-events:\s*auto/s);
  assert.match(css, /\.tree-svg\s*\{[^}]*pointer-events:\s*none/s);
});

test("layer captions wrap inside the card width instead of nowrap", () => {
  const css = readFileSync(path.join(here, "..", "styles.css"), "utf8");
  const source = readFileSync(path.join(here, "map.js"), "utf8");
  assert.match(css, /\.tree-branch-label\s*\{[^}]*white-space:\s*normal/s);
  assert.match(css, /\.tree-branch-label\s*\{[^}]*-webkit-line-clamp:\s*2/s);
  assert.match(source, /label\.style\.width/);
});

test("tree cards lock the layout height so edges are not covered", () => {
  const source = readFileSync(path.join(here, "map.js"), "utf8");
  assert.match(source, /root\.style\.height/);
  assert.match(source, /node\.style\.height/);
});

test("Tutor is parked from chrome; the briefing engine stays", () => {
  const css = readFileSync(path.join(here, "..", "styles.css"), "utf8");
  const source = readFileSync(path.join(here, "map.js"), "utf8");
  const orchestrator = readFileSync(
    path.join(here, "..", "lib", "agent", "orchestrator.js"),
    "utf8"
  );
  assert.doesNotMatch(css, /minmax\(0,\s*1fr\)\s+340px/);
  assert.doesNotMatch(css, /--tutor-sheet/);
  assert.doesNotMatch(css, /\.tutor-toggle/);
  assert.doesNotMatch(css, /tutor-open/);
  assert.doesNotMatch(source, /tutor-sheet/);
  assert.doesNotMatch(source, /tutor-open/);
  assert.doesNotMatch(source, /renderDock/);
  assert.match(orchestrator, /forceBrief:\s*true/);
});

test("index.html has one Tree home and no chat view", () => {
  const html = readFileSync(path.join(here, "..", "index.html"), "utf8");
  assert.match(html, /id="view-map"/);
  assert.doesNotMatch(html, /id="view-chat"/);
  assert.doesNotMatch(html, />Ask</);
});
