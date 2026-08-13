# 01 - dependence-path Tree prototype

Standalone artifact of the locked Tree shape (vertical spine of existing
dependence edges, foundations at the bottom, short ribs at convergence,
layers as named bands). Plain ES modules + SVG + CSS. Not shipped into
`src/` - ticket 03 ports this.

Danny (AFK) session auto-accepted the prototype as matching the locked shape.

## Run

ES modules need http, not file://. From this directory:

```
npx --yes serve
```

or `python -m http.server 8000`, then open the printed local URL
(typically http://localhost:3000).

Unit tests (geometry, no browser):

```
node --test tree.test.js
```

375px / 320px page-overflow probe (headless Edge):

```
node cdp-probe.mjs
```

## Locked shape

- Crown (concept) at the top. Foundations at the bottom.
- Y position follows `built-on` / `depends-on` / `abstraction-of`. Observation
  dates are hover stubs and never the sort.
- Laptop fixture: electricity sits below silicon below transistor.
- Parallel extra parents of a convergence node (`combines`) sit as short ribs,
  not even-right / odd-left layer columns.
- Layers are named bands behind the spine.
- Stage width is the viewport. Horizontal stage-scroll is a failure.

## Files

- `index.html` - demo page: laptop fixture (acceptance) and LLM (ribs).
- `tree.js` - `dependenceRanks`, `treeLayout`, `spinePaths`, `buildTree`.
- `sample-map.js` - laptop + LLM maps with the live fixture edges.
- `styles.css` - light theme, `html/body` overflow-x hidden.
- `tree.test.js` - node:test coverage of ranks, y-order, dates-ignored, 320/375 fit.
- `cdp-probe.mjs` - 375 and 320 viewport overflow check.
