/**
 * App entry: wires the hash router to the Tree home and the shared session
 * store.
 *
 * Ticket 02: one route. Home is the Tree. Tutor is parked from chrome.
 * `#chat` and unknown hashes land on home. The router still exists so old
 * hashes resolve without mounting a second page.
 */

import { createRouter } from "./state/router.js";
import { sessionStore } from "./state/session.js";
import { renderMapPage } from "./pages/map.js";
import { wantsDemo, runDemo } from "./demo.js";

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function element(id) {
  const found = document.getElementById(id);
  if (found === null) {
    throw new Error(`Missing element #${id}`);
  }
  return found;
}

const router = createRouter();
const mapView = element("view-map");
const mapPage = renderMapPage(mapView, sessionStore);

/**
 * @param {string} [_route]
 */
function render(_route) {
  mapView.hidden = false;
  mapPage.sync();
}

router.subscribe(render);
render(router.route);

// ?demo=1 seeds a scripted session so the Tree home is reviewable
// without the API key (the DeepSeek key is 402 pending top-up, research/03).
if (wantsDemo()) {
  runDemo(sessionStore);
}
