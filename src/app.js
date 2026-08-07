/**
 * App entry: wires the hash router to the two pages and the shared session
 * store.
 *
 * Per ticket 07, chat and map are separate hash routes ("#chat", "#map")
 * that share the session store singleton (session.js), so navigation keeps
 * the session. The chat UI arrives with ticket 08 and the map UI with
 * ticket 09; this module only toggles which view is visible.
 */

import { createRouter } from "./state/router.js";

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
const chatView = element("view-chat");
const mapView = element("view-map");

/**
 * @param {string} route
 */
function render(route) {
  chatView.hidden = route !== "chat";
  mapView.hidden = route !== "map";
}

router.subscribe(render);
render(router.route);
