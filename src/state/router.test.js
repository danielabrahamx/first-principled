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

test("ROUTES is only map", () => {
  assert.deepEqual(ROUTES, ["map"]);
});

test("the default route is map when the hash is empty", () => {
  const router = createRouter({ location: fakeLocation("") });
  assert.equal(router.route, DEFAULT_ROUTE);
  assert.equal(router.route, "map");
});

test("#chat falls back to the default route", () => {
  const router = createRouter({ location: fakeLocation("#chat") });
  assert.equal(router.route, "map");
});

test("an unknown hash falls back to map", () => {
  const router = createRouter({ location: fakeLocation("#about") });
  assert.equal(router.route, "map");
});

test("navigate to map does not notify when already on home", () => {
  const router = createRouter({ location: fakeLocation("") });
  /** @type {string[]} */
  const seen = [];
  const unsubscribe = router.subscribe((route) => seen.push(route));

  assert.equal(router.route, "map");
  router.navigate("map");
  assert.equal(router.route, "map");
  assert.deepEqual(seen, []);

  unsubscribe();
});

test("navigate ignores unknown routes including chat", () => {
  const router = createRouter({ location: fakeLocation("") });
  /** @type {string[]} */
  const seen = [];
  router.subscribe((route) => seen.push(route));
  router.navigate("chat");
  router.navigate("settings");
  assert.equal(router.route, "map");
  assert.deepEqual(seen, []);
});

test("the router works without a location (pure route tracking)", () => {
  const router = createRouter({ location: null });
  assert.equal(router.route, "map");
  router.navigate("chat");
  assert.equal(router.route, "map");
});

test("the browser hashchange event keeps #chat on home", () => {
  const location = fakeLocation("");
  const router = createRouter({ location });
  /** @type {string[]} */
  const seen = [];
  router.subscribe((route) => seen.push(route));

  assert.equal(router.route, "map", "empty hash means the Tree home");
  location.hash = "#chat";
  location.fireHashChange();
  assert.equal(router.route, "map");
  assert.deepEqual(seen, []);
  location.hash = "#map";
  location.fireHashChange();
  assert.equal(router.route, "map");
  assert.deepEqual(seen, []);
});

test("a Location without addEventListener falls back to globalThis", () => {
  // Some embedded Chrome contexts expose a Location object without
  // addEventListener; the router must attach to the window instead.
  const bareLocation = { hash: "" };
  const originalAdd = globalThis.addEventListener;
  /** @type {Map<string, Set<() => void>>} */
  const listeners = new Map();
  globalThis.addEventListener = /** @type {any} */ ((
    /** @type {string} */ type,
    /** @type {() => void} */ listener
  ) => {
    const set = listeners.get(type);
    if (set === undefined) {
      listeners.set(type, new Set([listener]));
    } else {
      set.add(listener);
    }
  });
  try {
    const router = createRouter({ location: bareLocation });
    /** @type {string[]} */
    const seen = [];
    router.subscribe((route) => seen.push(route));

    bareLocation.hash = "#chat";
    for (const listener of listeners.get("hashchange") ?? []) listener();
    assert.equal(router.route, "map");
    assert.deepEqual(seen, []);
    bareLocation.hash = "#map";
    for (const listener of listeners.get("hashchange") ?? []) listener();
    assert.equal(router.route, "map");
    assert.deepEqual(seen, []);
  } finally {
    globalThis.addEventListener = originalAdd;
  }
});
