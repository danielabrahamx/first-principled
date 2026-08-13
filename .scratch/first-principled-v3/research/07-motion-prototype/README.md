# 07 - phylogenetic motion prototype

Port of the portfoolio_clone2 RootTree motion onto our zero-dep SVG concept
tree (ticket 07). Plain ES modules + SVG + CSS, no React.

## Run

ES modules need http, not file://. From this directory:

- `npx serve` or
- `python -m http.server 8000`

then open http://localhost:8000.

## Files

- `index.html` - demo page: toggles for each effect, a simulate-reduced-motion
  checkbox, and the live OS prefers-reduced-motion status.
- `motion-tree.js` - geometry (ported from `src/lib/mapview/tree.js`), sap
  pulses via SMIL animateMotion, scroll-driven growth, node lifecycle
  animation, reduced-motion gate. Pure math (`layoutTree`, `sapPaths`,
  `trunkReveal`, `layerReveal`) is exported and node-testable.
- `sample-map.js` - a 6-layer laptop tree in the v1 reality-tree shape.
- `styles.css` - light theme, animations, reduced-motion media query.

## Decision

Recorded in `../../issues/07-port-the-phylogenetic-motion.md`: sap pulses,
scroll-driven growth and node lifecycle animation ship; parallax,
cursor-hydrotropism, root hairs and the grain filter do not. Reduced motion
skips SMIL and scroll wiring in JS and kills CSS animations via media query.
