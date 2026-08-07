/**
 * App entry: wires the hash router to the two pages and the shared session
 * store.
 *
 * Per ticket 07, chat and map are separate hash routes ("#chat", "#map")
 * that share the session store singleton (session.js), so navigation keeps
 * the session. The chat UI (ticket 08) wires itself here; the map UI
 * (ticket 09) mounts here and re-syncs whenever its route becomes visible.
 */

import { createRouter } from "./state/router.js";
import { sessionStore } from "./state/session.js";
import { renderMapPage } from "./pages/map.js";
import { initChatPage } from "./pages/chat.js";

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
const mapPage = renderMapPage(mapView, sessionStore, {
  navigate: (route) => router.navigate(route),
});
initChatPage(chatView);

/**
 * @param {string} route
 */
function render(route) {
  chatView.hidden = route !== "chat";
  mapView.hidden = route !== "map";
  if (route === "map") {
    mapPage.sync();
  }
}

router.subscribe(render);
render(router.route);
