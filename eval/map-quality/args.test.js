import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseEvalArgs } from "./args.js";

const defaults = { baselineFile: "research/07.md" };

describe("parseEvalArgs", () => {
  it("defaults to gold self-score with the given baseline path", () => {
    const parsed = parseEvalArgs([], defaults);
    assert.equal(parsed.wantLive, false);
    assert.equal(parsed.mapsDir, null);
    assert.equal(parsed.baselineFile, "research/07.md");
  });

  it("reads live, maps-dir, and baseline without clobbering defaults on missing values", () => {
    const parsed = parseEvalArgs(
      [
        "--live",
        "--maps-dir",
        "research/12-live-maps",
        "--baseline",
        "research/12-live-gate.md",
      ],
      defaults
    );
    assert.equal(parsed.wantLive, true);
    assert.equal(parsed.mapsDir, "research/12-live-maps");
    assert.equal(parsed.baselineFile, "research/12-live-gate.md");
  });
});
