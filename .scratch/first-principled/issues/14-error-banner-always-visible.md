# 14 - CSS regression: error banner (Retry) permanently visible

**Type:** bug
**Status:** resolved (2026-08-08)
**Blocked by:** none
**Related:** ticket 13 (regression source); `src/styles.css`

## Question

Why is the error banner (and its Retry button) permanently on screen, even
with no error?

## Root cause

Ticket 13's redesign gave `.error-banner` an author `display: flex` rule. The
HTML relies on the `hidden` attribute to toggle the banner, but an author
`display` rule overrides the UA stylesheet's `[hidden] { display: none }`
(author origin beats UA origin at equal specificity). So the banner computed
`display: flex` with a 65px box on every page load. The same latent hazard
exists on `#composer` and `#composer-wrap` (both `display: flex` + `hidden`),
currently masked by `.chat.starting` parent rules.

## Fix

One global guard in `src/styles.css`:

```css
[hidden] {
  display: none !important;
}
```

The hidden attribute now always wins, everywhere, for every element toggled
via `el.hidden` (banner, composer, composer-wrap, hero, panels). No behavior
change to the show paths: `showError` still sets `hidden = false`, which
removes the attribute and lets the flex layout take over.

## Acceptance criteria

1. On load, `#error-banner` renders nothing (computed `display: none`, zero
   box). VERIFIED via headless Chromium CDP: before fix `display: flex`,
   rect height 65px; after fix `display: none`, height 0.
2. On a failed agent call, the banner appears with the friendly message and
   a working Retry (computed `flex`, 65px, `#retry-button` visible).
   VERIFIED by submitting a word against a server with no /api/agent.
3. `#composer`, `#composer-wrap`, `#chat-hero` stay hidden when toggled off.
   VERIFIED in the same computed-style pass.
4. No regressions: 169/169 tests pass, `tsc --noEmit` clean.
