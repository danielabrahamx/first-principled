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

test("the wait-state is cheap placeholder then grow-in-place on the chapel stage", () => {
  const source = readFileSync(path.join(here, "map.js"), "utf8");
  // Ticket 11 v8: the placeholder stands in only until the first snapshot.
  assert.match(source, /growLayout/);
  assert.match(source, /renderGrow\(\)/);
  assert.match(source, /onPollRecord/);
  assert.doesNotMatch(source, /SKELETON_STEP_MS/);
});

test("the status line is building tree... until Arrange, then gone", () => {
  const source = readFileSync(path.join(here, "map.js"), "utf8");
  assert.match(source, /"building tree\.\.\."/);
  assert.match(source, /buildingNote\.hidden = false/);
  // Terminal records hide it again.
  assert.match(source, /buildingNote\.hidden = true/);
});

test("an error after a snapshot clears stage products instead of faking a Tree", () => {
  const source = readFileSync(path.join(here, "map.js"), "utf8");
  assert.match(source, /function finishGeneration/);
  assert.match(
    source,
    /function finishGeneration[\s\S]*?growSnapshot = null;[\s\S]*?showMapError/
  );
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
  assert.match(css, /\.tree-chapel-card\s*\{[^}]*pointer-events:\s*auto/s);
  assert.match(css, /\.tree-svg\s*\{[^}]*pointer-events:\s*none/s);
});

test("Chapel cards carry title, tag, and gloss", () => {
  const source = readFileSync(path.join(here, "map.js"), "utf8");
  assert.match(source, /tree-chapel-title/);
  assert.match(source, /tree-chapel-tag/);
  assert.match(source, /tree-chapel-gloss/);
  assert.match(source, /tree-chapel-because/);
  assert.doesNotMatch(source, /tree-branch-label/);
});

test("How it works chrome stays in the header", () => {
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
