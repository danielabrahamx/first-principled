import { test } from "node:test";
import assert from "node:assert/strict";

import { createRouter, ROUTES, DEFAULT_ROUTE } from "./router.js";

/**
 * A fake "location-like" object so the router can be driven without a DOM.
 *
 * @param {string} [initialHash]
 * @returns {{ hash: string; addEventListener: (type: string, listener: () => void) => void; fireHashChange: () => void }}
 */
function fakeLocation(initialHash = "") {
  const listeners = new Set();
  return {
    hash: initialHash,
    addEventListener(type, listener) {
      if (type === "hashchange") listeners.add(listener);
    },
    fireHashChange() {
      for (const listener of listeners) listener();
    },
  };
}

test("ROUTES are exactly chat and map", () => {
  assert.deepEqual(ROUTES, ["chat", "map"]);
});

test("the default route is chat when the hash is empty", () => {
  const router = createRouter({ location: fakeLocation("") });
  assert.equal(router.route, DEFAULT_ROUTE);
  assert.equal(router.route, "chat");
});

test("an unknown hash falls back to chat", () => {
  const router = createRouter({ location: fakeLocation("#about") });
  assert.equal(router.route, "chat");
});

test("navigate switches the route and notifies subscribers", () => {
  const router = createRouter({ location: fakeLocation("") });
  /** @type {string[]} */
  const seen = [];
  const unsubscribe = router.subscribe((route) => seen.push(route));

  router.navigate("map");
  assert.equal(router.route, "map");
  router.navigate("chat");
  assert.equal(router.route, "chat");
  assert.deepEqual(seen, ["map", "chat"]);

  unsubscribe();
  router.navigate("map");
  assert.deepEqual(seen, ["map", "chat"]);
});

test("navigate ignores unknown routes", () => {
  const router = createRouter({ location: fakeLocation("") });
  /** @type {string[]} */
  const seen = [];
  router.subscribe((route) => seen.push(route));
  router.navigate("settings");
  assert.equal(router.route, "chat");
  assert.deepEqual(seen, []);
});

test("the router works without a location (pure route tracking)", () => {
  const router = createRouter({ location: null });
  assert.equal(router.route, "chat");
  router.navigate("map");
  assert.equal(router.route, "map");
});

test("the browser hashchange event drives the router too", () => {
  const location = fakeLocation("");
  const router = createRouter({ location });
  /** @type {string[]} */
  const seen = [];
  router.subscribe((route) => seen.push(route));

  location.hash = "#map";
  location.fireHashChange();
  assert.equal(router.route, "map");
  assert.deepEqual(seen, ["map"]);
});
