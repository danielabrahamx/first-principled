# 02 - Vendor anti-slop

**Type:** task

**Status:** ready-for-agent

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

## Acceptance criteria

- [ ] Plugin vendored, oxlint config present, npm script runs on Windows
      PowerShell
- [ ] Rules that do not fit JSDoc JS are explicitly off, with a one-line
      reason each
- [ ] `npm test` and `npx tsc --noEmit` still pass
- [ ] No secrets

## Docs rule

Pointer from this ticket and the map's Decisions so far. README or
package.json script is the install surface; no spec change.
