# 02 - Vendor anti-slop

**Type:** task

**Status:** resolved

**Blocked by:** none

**Related:** [The generator is three stages and nothing else](05-the-generator-is-three-stages-and-nothing-else.md)

## Question

How does this JSDoc JavaScript repo take
[anti-slop](https://github.com/dmmulroy/anti-slop) so later generator
work is linted against low-evidence patterns, without turning the ticket
into a rewrite of `realityMap.js`?

## What

AFK. Vendor, do not npm-depend on a moving copy as the source of truth.

1. Copy the plugin into the repo (recommended path
   `tools/oxlint/anti-slop/`). Install current `oxlint` and
   `@oxlint/plugins`.
2. Wire an `oxlint` config. Enable rules that apply. This tree is JSDoc
   `.js`, not TypeScript: disable or downgrade rules that only make
   sense with a TS type checker, and record which ones.
3. Add an npm script. Run it. Fix cheap hits on files this ticket
   touches; for a large existing-file baseline, fail-new / warn-old is
   allowed if written down in the ticket answer. Do not rebuild the
   generator here.
4. Ignore agent-skill directories and the vendored plugin itself, per
   upstream README.

**Out of this ticket.** Prompt rewrite. Provider switch. Generator
rebuild. Prod deploy.

## Answer

Vendored [anti-slop](https://github.com/dmmulroy/anti-slop) at
`tools/oxlint/anti-slop/` from commit
`446268e5d15baa968eaec669ff65358d36ae6259`, plus LICENSE. Installed
`oxlint@1.78.0` and `@oxlint/plugins@1.78.0` (devDependencies, matched
to upstream). Config is `oxlint.config.js` (Node 22.14 cannot load a
`.ts` oxlint config or the `.ts` plugin without type-stripping).

`npm run lint` runs oxlint with `--experimental-strip-types` and
`-c oxlint.config.js`. Default unicorn/typescript/oxc plugins are
empty so this is anti-slop only, not a full linter rewrite.

Enabled as error: `no-conditional-empty-object-spread`,
`no-module-mocking`, `no-reflect-apply`, `no-reflect-get`,
`no-shape-in-symbol-names`.

Off, one line each:

- `no-chained-type-assertions` - TypeScript assertion syntax; this tree is JSDoc JS.
- `no-known-value-widening` - needs TS type annotations.
- `no-object-parameters` - flags the TS `object` type, not JSDoc `@typedef`.
- `no-unknown-parameters` - TS `unknown` on params.
- `no-unknown-returns` - TS `unknown` returns.
- `no-unknown-type-aliases` - TS aliases that hide `unknown`.
- `no-unsafe-dictionary-type` - TS index/Record types.
- `no-widen-then-assert` - TS widen-then-assert.
- `require-safety-comment-for-type-assertion` - TS assertions.
- `no-runtime-typeof` - JSDoc JS decodes untrusted LLM JSON with typeof; enabling it would rewrite `realityMap.js`.

One cheap existing hit fixed: `src/api/agent.js` stopped using a
conditional empty-object spread for `turnstileToken`. No warn-old
baseline. Plugin tests were not vendored so `node --test` does not
run them. `npm test` 378 pass; `npx tsc --noEmit` clean.

## Acceptance criteria

- [x] Plugin vendored, oxlint config present, npm script runs on Windows
      PowerShell
- [x] Rules that do not fit JSDoc JS are explicitly off, with a one-line
      reason each
- [x] `npm test` and `npx tsc --noEmit` still pass
- [x] No secrets

## Docs rule

Pointer from this ticket and the map's Decisions so far. README or
package.json script is the install surface; no spec change.
