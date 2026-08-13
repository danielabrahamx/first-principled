# 01 - cladogram and one-shot grow prototype

Standalone artifact of the locked Tree shape (v1 ticket 17 cladogram +
one-shot elapsed grow). Plain ES modules + SVG + CSS, no React. Not shipped
into `src/` - ticket 03 ports this.

Danny (AFK) session auto-accepted the prototype as matching the locked shape.

## Run

ES modules need http, not file://. From this directory:

```
npx --yes serve
```

or `python -m http.server 8000`, then open the printed local URL
(typically http://localhost:3000).

Unit tests (geometry + grow math, no browser):

```
node --test tree.test.js
```

## Locked shape

Geometry is a port of v1 ticket 17 (`git show 0e72e6e:src/lib/mapview/tree.js`),
not the current v3 vertical-path tree in `src/lib/mapview/tree.js`.

- Crown (root card) at the top. Trunk descends from the root bottom.
- Even branches RIGHT of the trunk, odd LEFT. On each side the deepest
  branch (largest index) sits nearest the trunk so elbows never cross nearer
  columns' cards.
- Sample order is v3 chronology in the data: branch 0 = apps (crown-nearest,
  most derived), last = physics (foundations). Dates stay inside a layer.

One-shot grow (~1s elapsed, not scroll): trunk draws in the first half, then
layers bud deepest-first (physics first, apps last). At time 0 the root is
visible. At progress 1 every layer/card freezes at opacity 1. Scrolling after
grow does not hide or fade anything. Sap pulses (SMIL) may run on the
finished cladogram. `prefers-reduced-motion` or the "simulate reduced motion"
checkbox skips grow and sap and shows the full Tree instantly.

`trunkReveal(progress)` and `layerReveal(progress, count, index)` take elapsed
progress 0..1, not `window.scrollY`.

## 375px / mobile

The locked 6-layer laptop tree is about 1840px wide (280px cards + 32px
column gaps, three columns per side). That cannot fit in a 375px viewport
without shrinking cards, which the locked geometry forbids.

**Stage-scroll is the v1 fit:** `.mt-tree-scroll` uses `overflow-x: auto` so
the tree container scrolls horizontally. `html, body` use `overflow-x: hidden`
so the DOCUMENT/page does not overflow. "Visible without scrolling" in the
ticket AC means opacity-visible after grow, not that the 1840px tree fits in
375px.

## Files

- `index.html` - demo page: sap toggle, simulate-reduced-motion, OS
  prefers-reduced-motion status.
- `tree.js` - locked `treeLayout` + `cladogramPaths`, one-shot grow, sap
  after grow, reduced-motion gate. Pure math is exported and node-testable.
- `sample-map.js` - 6-layer laptop fixture. Stub observation dots and a
  "combines 2 fields" chip on application.
- `styles.css` - light theme, page overflow hidden, stage overflow-x auto.
- `tree.test.js` - node:test coverage of geometry and grow math.
