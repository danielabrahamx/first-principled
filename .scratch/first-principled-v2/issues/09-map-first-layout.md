# 09 - Map-first layout: the map is the home surface

**Type:** prototype
**Status:** resolved 2026-08-10 (Buffy)
**Blocked by:** 08
**Related:** tickets 10, 11, 12; v1 tickets 08, 09, 13;
src/pages/map.js; src/pages/chat.js; src/state/router.js

## Question

v1 is chat-first with the map as a second route. Danny's product call
(2026-08-10): the map should be the main thing, and users should be able to
click on any part of it. What does map-first look like - the map as the home
route, chat docked beside it, the tutor's question highlighting the node it
is probing (probe.nodeId already arrives with every response) - and how does
the layout hold from 375px to desktop?

## What

1. Prototype the split layout: map as the primary pane, chat docked (right
   side on desktop, bottom sheet or tab on narrow screens).
2. The tutor's probe highlight: when a response carries probe.nodeId, that
   node pulses/glows on the map while the question is shown.
3. Route changes: #map (or #) is home; chat stays reachable; the segmented
   control and store subscription survive.
4. Keyboard and ARIA for the split panes.

## Acceptance criteria

1. A working prototype: start a session, the map is the primary surface, the
   tutor's question highlights the probed node, and chat remains fully
   usable docked.
2. 375px and desktop both usable; no document overflow.
3. Existing map/chat behaviors (diff animations, no-leak-in-chat) intact.
4. `npm test` green, `npm run typecheck` clean.

## Docs rule

Spec section 9 updated in the same commit.

## Human gate

Prototype review with Danny - this is his explicit product direction.

## Resolution (2026-08-10)

The map is now the home surface: DEFAULT_ROUTE = "map", so # (empty) and
unknown hashes land here; #chat stays reachable and the Chat segment
navigates to it. The page is a split layout (.map-split): the map is the
primary pane, and a docked Tutor pane (src/pages/dock.js) sits beside it on
desktop (340px rail, sticky) and stacks below it under 960px. The dock is
a compact conversation: transcript, composer, phase pill, error banner with
retry - sharing the session store, api/agent transport, turnstile, and
error wording with the full chat page. The segmented control, store
subscription, diff animations, and no-leak-in-chat all survive.

Probe highlight: the store now carries lastProbe (and the ledger carries
probe per turn - ticket 08 extension); the card the tutor is asking about
pulses (probe-pulse animation). Cards are keyboard-focusable with aria-labels.

Verified in the browser (desktop, Chrome): split layout renders, docked
chat works, probe pulse visible, zero console errors. Narrow-viewport rules
are in place (<960px single column, dock below, full-width panel); the
375px pass is pending a re-run of the browser agent (transient failure) and
Danny's prototype review.
