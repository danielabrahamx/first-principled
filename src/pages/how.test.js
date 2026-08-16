import { test } from "node:test";
import assert from "node:assert/strict";

import {
  EMPTY_LINE,
  HOW_BACK,
  HOW_PARAS,
  HOW_TITLE,
  WORD_ARIA,
  WORD_PLACEHOLDER,
  isHowRoute,
} from "./how.js";

test("isHowRoute treats #how as the How it works page", () => {
  assert.equal(isHowRoute("#how"), true);
  assert.equal(isHowRoute("how"), true);
  assert.equal(isHowRoute(""), false);
  assert.equal(isHowRoute("#map"), false);
  assert.equal(isHowRoute("#chat"), false);
});

test("locked grilling copy is unchanged", () => {
  assert.equal(
    WORD_PLACEHOLDER,
    "A thing in reality (laptop, photosynthesis)"
  );
  assert.equal(
    EMPTY_LINE,
    "Type the thing you want to understand from its foundations."
  );
  assert.equal(
    WORD_ARIA,
    "A thing in reality to understand from its foundations"
  );
  assert.equal(HOW_TITLE, "How it works");
  assert.equal(HOW_BACK, "Back to the Tree");
  assert.equal(HOW_PARAS[0], "This is not designed to replace reading.");
  assert.match(HOW_PARAS[1], /relationships between layers/);
  assert.match(HOW_PARAS[2], /rabbit holes/);
  assert.match(HOW_PARAS[3], /from its foundations/);
});
