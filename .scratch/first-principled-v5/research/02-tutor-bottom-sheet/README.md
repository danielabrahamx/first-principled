# 02 - Tutor bottom sheet prototype

Extends the accepted 01 dependence-path prototype with closed-by-default
Tutor chrome. Compact bottom sheet plus spine padding-bottom equal to the
sheet height so foundations stay reachable. Not shipped into `src/` -
ticket 04 ports this.

Danny (AFK) session auto-accepted compact-sheet-with-spine-padding.

## Run

From this directory:

```
npx --yes serve
```

or `python -m http.server 8000`.

```
node --test tree.test.js
node cdp-probe.mjs
```

## Accepted pattern

- Closed on first paint. Header **Tutor** toggle opens and closes it.
- Sheet is `position: fixed` at the bottom (240px / max 42dvh). It never
  adds a 340px column or overlays Tree width.
- While open, `.mt-tree-wrap` gains `padding-bottom: var(--tutor-sheet)` so
  electricity can scroll into the gap above the sheet.
- Not a full-screen swap. Not an overlay rail.

## Files

- `index.html` - 01 spine plus Tutor toggle and compact sheet.
- `styles.css` - 01 styles plus sheet / spine-padding.
- `tree.js` / `sample-map.js` / `tree.test.js` - copied from 01.
- `cdp-probe.mjs` - closed default, no width steal, foundations reachable,
  375/320 no page overflow.
