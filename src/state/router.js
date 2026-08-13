/**
 * The hash router: one home route (the Tree).
 *
 * Per ticket 07, the frontend is a static site with no server-side rewrites,
 * so routing is hash-based - "#map" is a plain anchor any static host serves.
 * Ticket 02 drops `#chat` as a first-class page: empty hashes, `#chat`, and
 * unknown hashes all land on home. Switching the hash never reloads the
 * document, so the session store singleton (session.js) survives.
 *
 * The router takes an optional "location-like" object so node:test can drive
 * it without a DOM; in the browser it defaults to globalThis.location.
 */

/**
 * @typedef {object} RouterLocation
 * @property {string} hash - the current fragment, "" or "#map" etc.
 * @property {(type: string, listener: () => void) => void} [addEventListener]
 */

/** @type {readonly string[]} */
export const ROUTES = Object.freeze(["map"]);

/** The default route when the hash is empty or unknown. Tree home
 * (ticket 02): `#chat` and anything else fall back here. */
export const DEFAULT_ROUTE = "map";

/**
 * @param {string} hash
 * @returns {string}
 */
function routeFromHash(hash) {
  const route = hash.replace(/^#/, "");
  return ROUTES.includes(route) ? route : DEFAULT_ROUTE;
}

/**
 * Create a hash router.
 *
 * @param {object} [options]
 * @param {RouterLocation | null} [options.location] - defaults to
 *   globalThis.location in the browser; pass a fake in tests.
 * @returns {{
 *   get route(): string;
 *   navigate(route: string): void;
 *   subscribe(listener: (route: string) => void): () => void;
 * }}
 */
export function createRouter(options = {}) {
  const location =
    options.location !== undefined
      ? options.location
      : typeof globalThis.location === "undefined"
        ? null
        : /** @type {RouterLocation} */ (/** @type {unknown} */ (globalThis.location));

  /** A fallback hash used when no location is available (tests, prerender). */
  let fallbackHash = location ? location.hash : "";

  let route = routeFromHash(fallbackHash);
  /** @type {Set<(route: string) => void>} */
  const listeners = new Set();

  /**
   * Re-read the hash and notify listeners when the route changed. Also
   * invoked directly by navigate (the hashchange event may or may not fire
   * in a test fake; calling it here makes navigation deterministic).
   */
  function emit() {
    const next = routeFromHash(location ? location.hash : fallbackHash);
    if (next === route) return;
    route = next;
    for (const listener of listeners) listener(route);
  }

  if (location && typeof location.addEventListener === "function") {
    location.addEventListener("hashchange", emit);
  } else if (typeof globalThis.addEventListener === "function") {
    // Some embedded or sandboxed Chrome contexts expose a Location object
    // without addEventListener; window still dispatches hashchange there.
    /** @type {{ addEventListener: (type: string, listener: () => void) => void }} */
    const windowTarget = /** @type {any} */ (globalThis);
    windowTarget.addEventListener("hashchange", emit);
  }

  return {
    /** @returns {string} */
    get route() {
      return route;
    },

    /**
     * Navigate to a route by setting the hash.
     *
     * @param {string} next
     */
    navigate(next) {
      if (!ROUTES.includes(next)) return;
      if (location) {
        location.hash = `#${next}`;
      } else {
        fallbackHash = `#${next}`;
      }
      emit();
    },

    /**
     * Subscribe to route changes. Returns an unsubscribe function.
     *
     * @param {(route: string) => void} listener
     * @returns {() => void}
     */
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
