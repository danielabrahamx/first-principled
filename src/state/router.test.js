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

test("the default route is map when the hash is empty (map-first, ticket 09)", () => {
  const router = createRouter({ location: fakeLocation("") });
  assert.equal(router.route, DEFAULT_ROUTE);
  assert.equal(router.route, "map");
});

test("an unknown hash falls back to map", () => {
  const router = createRouter({ location: fakeLocation("#about") });
  assert.equal(router.route, "map");
});

test("navigate switches the route and notifies subscribers", () => {
  const router = createRouter({ location: fakeLocation("") });
  /** @type {string[]} */
  const seen = [];
  const unsubscribe = router.subscribe((route) => seen.push(route));

  // The default route is map; the first navigation to a different route fires.
  assert.equal(router.route, "map");
  router.navigate("chat");
  assert.equal(router.route, "chat");
  router.navigate("map");
  assert.equal(router.route, "map");
  assert.deepEqual(seen, ["chat", "map"]);

  unsubscribe();
  router.navigate("chat");
  assert.deepEqual(seen, ["chat", "map"]);
});

test("navigate ignores unknown routes", () => {
  const router = createRouter({ location: fakeLocation("") });
  /** @type {string[]} */
  const seen = [];
  router.subscribe((route) => seen.push(route));
  router.navigate("settings");
  assert.equal(router.route, "map");
  assert.deepEqual(seen, []);
});

test("the router works without a location (pure route tracking)", () => {
  const router = createRouter({ location: null });
  assert.equal(router.route, "map");
  router.navigate("chat");
  assert.equal(router.route, "chat");
});

test("the browser hashchange event drives the router too", () => {
  const location = fakeLocation("");
  const router = createRouter({ location });
  /** @type {string[]} */
  const seen = [];
  router.subscribe((route) => seen.push(route));

  assert.equal(router.route, "map", "empty hash means the map (map-first)");
  location.hash = "#chat";
  location.fireHashChange();
  assert.equal(router.route, "chat");
  assert.deepEqual(seen, ["chat"]);
  location.hash = "#map";
  location.fireHashChange();
  assert.equal(router.route, "map");
  assert.deepEqual(seen, ["chat", "map"]);
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
    assert.equal(router.route, "chat");
    assert.deepEqual(seen, ["chat"]);
    bareLocation.hash = "#map";
    for (const listener of listeners.get("hashchange") ?? []) listener();
    assert.equal(router.route, "map");
    assert.deepEqual(seen, ["chat", "map"]);
  } finally {
    globalThis.addEventListener = originalAdd;
  }
});
