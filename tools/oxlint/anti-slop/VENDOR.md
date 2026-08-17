Vendored from https://github.com/dmmulroy/anti-slop
Commit: 446268e5d15baa968eaec669ff65358d36ae6259
Date: 2026-08-17

Copy of `src/` plus LICENSE, excluding `*.test.ts` so `npm test`
does not pick up the plugin's own suite. Do not npm-depend on a moving
anti-slop release as the source of truth. Edit rules in this tree when
the team's standard changes.
