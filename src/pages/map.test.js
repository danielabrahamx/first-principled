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

test("How it works chrome uses the locked foundations copy", () => {
  const source = readFileSync(path.join(here, "map.js"), "utf8");
  const how = readFileSync(path.join(here, "how.js"), "utf8");
  assert.match(source, /from "\.\/how\.js"/);
  assert.match(source, /how-link/);
  assert.match(source, /WORD_PLACEHOLDER/);
  assert.match(source, /EMPTY_LINE/);
  assert.doesNotMatch(source, /Type a word or phrase/);
  assert.match(how, /A thing in reality \(laptop, photosynthesis\)/);
  assert.match(
    how,
    /Type the thing you want to understand from its foundations\./
  );
  assert.match(how, /not designed to replace reading/);
  assert.match(how, /relationships between layers/);
  assert.match(how, /rabbit holes/);
  assert.doesNotMatch(how, /Tutor/);
  assert.doesNotMatch(how, /atomic facts|atomic principles/);
});

test("header How it works wraps instead of overflowing the page", () => {
  const css = readFileSync(path.join(here, "..", "styles.css"), "utf8");
  assert.match(css, /html,\s*body\s*\{[^}]*overflow-x:\s*hidden/s);
  assert.match(css, /\.map-header\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /\.map-entry\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.how-link\s*\{[^}]*flex:\s*0 0 auto/s);
});

test("node panel is an invitation card without learner-state chrome", () => {
  const source = readFileSync(path.join(here, "map.js"), "utf8");
  const history = readFileSync(
    path.join(here, "..", "lib", "mapview", "history.js"),
    "utf8"
  );
  assert.match(source, /node-panel-invite/);
  assert.match(source, /view\.invitation/);
  assert.match(source, /What it rests on/);
  assert.match(source, /What rests on it/);
  assert.match(history, /This node is a rabbit hole: a thing to go understand, not a chat topic\./);
  assert.doesNotMatch(source, /How your model changed/);
  assert.doesNotMatch(source, /Your words/);
  assert.doesNotMatch(source, /You haven't engaged this node yet/);
  assert.doesNotMatch(source, /Build from this node/);
  assert.doesNotMatch(source, /view\.trail|view\.evidence|view\.engaged/);
});
