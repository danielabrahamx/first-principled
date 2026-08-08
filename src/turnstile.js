/**
 * Cloudflare Turnstile helper (ticket 18): invisible widget, zero-dependency.
 *
 * The site key is public by design (it is shipped in the page); the secret
 * key lives server-side in the Netlify env (TURNSTILE_SECRET_KEY). Until a
 * site key is pasted here, the module returns null tokens and the server
 * skips verification entirely (its gate is keyed on the secret), so local
 * dev and the unconfigured site keep working.
 *
 * The widget is created on demand per submit and removed after the token
 * arrives, so no iframe leaks across turns. Tokens are single-use and
 * expire after 300 seconds - never cache them.
 */

/** The public site key from the Cloudflare dashboard widget. */
const TURNSTILE_SITE_KEY = "";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** @type {Promise<any> | null} */
let scriptPromise = null;

/**
 * Load the Turnstile script once and resolve with the global api object,
 * or null when the script fails (adblock, offline, old browser).
 *
 * @returns {Promise<any | null>}
 */
function loadTurnstile() {
  if (!TURNSTILE_SITE_KEY) return Promise.resolve(null);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve) => {
    const win = /** @type {any} */ (globalThis);
    if (win.turnstile) {
      resolve(win.turnstile);
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(win.turnstile || null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Run one invisible Turnstile challenge and resolve with a single-use
 * token, or null when Turnstile is unavailable or the challenge failed.
 *
 * @param {string} action - the widget action tag, matched server-side.
 * @returns {Promise<string | null>}
 */
export async function getTurnstileToken(action) {
  const turnstile = await loadTurnstile();
  if (!turnstile) return null;
  return new Promise((resolve) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    let settled = false;
    const finish = (/** @type {string | null} */ token) => {
      if (settled) return;
      settled = true;
      try {
        turnstile.remove(widgetId);
      } catch {
        // widget already gone
      }
      container.remove();
      resolve(token);
    };
    let widgetId = /** @type {any} */ (null);
    try {
      widgetId = turnstile.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        size: "invisible",
        action,
        callback: (/** @type {string} */ token) => finish(token),
        "expired-callback": () => finish(null),
        "error-callback": () => finish(null),
      });
      turnstile.execute(widgetId);
    } catch {
      container.remove();
      resolve(null);
    }
  });
}
