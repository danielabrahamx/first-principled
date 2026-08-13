# 10 - Vertical path layout + strict chronology + panel close fix

**Type:** task

**What:** Rebuild the reality tree as a vertical, scroll-driven path: the root
concept card at the top, a central trunk descending, layers peeling off
downward, cards narrow enough to read on a 375px phone. Fix the node panel's
unresponsive close button. Make the tree strictly chronological.

**Blocked by:** none

**Status:** ready-for-agent

## Question

The current tree lays layers out left and right of the trunk in alternating
columns (280px cards, ~1900px wide for 6 layers). On mobile it is unreadable.
Chronology exists only in hover popovers - tree cards render in generation
order. The node panel's X button has no click listener (only Esc closes).

## What

1. **Vertical path layout.** Replace the alternating-column geometry in
   `src/lib/mapview/tree.js` with a vertical path: root at top, trunk
   descending, each layer's cards stacked in a single column centered on the
   trunk. Responsive: 1-up on screens <= 480px; layers with 4+ nodes fan
   2-up on desktop, trunk stays centered. No horizontal overflow at 375px or
   320px viewport widths.
2. **Scroll model.** The reality tree uses natural page scroll with a sticky
   header - no nested scroll container. Scroll-driven growth hooks the
   scroller that actually moves (window on mobile, page on desktop).
3. **Strict chronology.** Dates drive ordering everywhere the tree renders:
   cards sorted by date within each layer (oldest first; unknown dates last
   in original order, stable), layers ordered by their oldest date (oldest
   at the bottom, nearest the foundation). The layer chain structure is the
   invariant - never re-sort across layer boundaries (ticket 08 contract).
4. **Panel close fix.** Wire a click listener on `panelClose` in
   `src/pages/map.js`. Add backdrop click-to-close and focus return to the
   card that opened the panel. Esc keeps working.
5. **Reading direction stays:** concept at top, oldest foundations at the
   bottom, sap rises bottom to top. The motion port (ticket 12) rides this
   geometry.

## Acceptance criteria

- [ ] Reality tree renders as a vertical path: root top, trunk descends,
      layers below, readable top to bottom without horizontal scrolling
- [ ] 375px and 320px CDP audits: docScrollWidth == viewport width, overflow
      0, tap targets >= 44px, contrast passes
- [ ] Tree cards sorted by date within each layer; layers ordered by oldest
      date; layer boundaries never crossed by the sort
- [ ] X button closes the node panel; clicking the backdrop closes it;
      focus returns to the opening card; Esc still closes
- [ ] Sticky header, natural page scroll on the reality tree (no nested
      scroll box)
- [ ] Screenshots at 375px and 320px delivered for Danny approval before
      deploy
- [ ] npm test green, tsc clean; deploy via the manual Netlify command;
      375px + DOM probes re-run against the live URL

## Docs rule

Update the map's Decisions so far with the layout + chronology + close-fix
resolution. Ticket 04's tree UI notes in the map stay accurate (hover /
panel behavior unchanged except the close fix).
