# 12 - Port the phylogenetic motion into the live tree

**Type:** task

**What:** Ship the ticket 07 motion prototype into the real tree: flowing
sap pulses, scroll-driven growth, node lifecycle stagger - on the new
vertical path geometry, with reduced-motion support, mobile-clean.

**Blocked by:** 10 - Vertical path layout + strict chronology + panel close
fix

**Status:** ready-for-agent

## Question

Ticket 07 resolved with a prototype (`research/07-motion-prototype/`) and a
decision on which effects ship, but zero motion code exists in `src/` - the
live tree is still the static v1 layout. Danny: the tree "was not even
rebuilt for it to look like the one on portfoolio-clone2."

## What

1. **Port the 07 decision into the live tree.** From the ticket 07
   resolution:
   - Flowing sap pulses via animateMotion - one pulse train on the trunk and
     one per branch, riding the cladogram centerlines in the rising
     direction (deepest divergence up to the crown; branch cards up to the
     trunk). Observations rise from foundations to abstractions. Pure SMIL,
     zero JS animation loop.
   - Scroll-driven growth - the trunk draws down as the first half of the
     scroll (pathLength-normalized dashoffset), then each layer buds in.
   - Node lifecycle stagger (ticket 07 decision item 3).
   - Skipped (per 07): parallax, cursor hydrotropism, root hairs, grain
     filter.
2. **Reduced motion.** JS skips SMIL + scroll wiring; CSS media query kills
   animations. Same contract as the prototype.
3. **Vertical path geometry.** The motion rides the ticket 10 vertical
   layout - trunk down the center, branches peeling off, sap rising
   bottom-to-top. Reading direction: concept top, oldest foundations bottom.
4. **Mobile.** Motion must not cause horizontal overflow or layout shift at
   375px/320px. Scroll-driven growth hooks the natural page scroller
   (ticket 10 scroll model). Performance-minded: SMIL on mobile is fine but
   verify no jank at 375px; reduced-motion is the escape hatch.

## Acceptance criteria

- [ ] Sap pulses animate on trunk + branches in the live tree (SMIL
      animateMotion, rising direction)
- [ ] Scroll-driven growth: trunk draws on scroll, layers bud in sequence
- [ ] Node lifecycle stagger ships
- [ ] Reduced-motion: no SMIL, no scroll wiring, CSS animations killed -
      verified in the prototype's simulate-reduced-motion check
- [ ] Works on the vertical path layout from ticket 10
- [ ] 375px and 320px CDP audits clean; screenshots delivered for Danny
      approval before deploy
- [ ] npm test green, tsc clean; deploy via the manual Netlify command;
      probes re-run against the live URL

## Docs rule

Update the map's Decisions so far with the motion-shipped resolution. The
07 decision line stays as the source of truth for what ships vs. what does
not.
