# Etymology-style Dependence layout (throwaway)

Answers: does an Etymonline-shaped flowchart of Dependence, filled with
gold **battery** nodes (not the English word's etymology), read as the
product surface?

Not the live app. Do not copy this folder into `src/` as-is.
[Prototype the etymology-style Dependence layout](../../issues/04-prototype-the-etymology-style-dependence-layout.md)
**KEEP Chapel (variant B).** Do not copy this folder into `src/` as-is.

Three layout variants, switchable from the bottom bar or `?variant=A|B|C`.
Toggle **Gold battery** vs a captured **Nemotron slice** (`?map=gold|live`,
or G / L). The live slice is a saved Arrange fragment from v7 diagnostics,
not a live LLM call. After this chrome is wired, smoke it on
OpenRouter `:free` (or DeepSeek) against the four gold words.

Locks from tickets 02 and 03 (all variants):

- Crown (`battery`) at the **bottom**; supports above.
- Arrow A down to B means B depends on A.
- One Dependence trunk: electrodes -> electrolyte -> battery.
- Extra parent **ions** fans in from the side (and also skip-joins the
  crown). Not Chronology order. Not word etymology.

Working card slots (ticket 06 still open): title = node label; tag =
layer name; gloss = description.

| Key | Name | Structure |
| --- | --- | --- |
| A | Etymonline facsimile | Cream page, serif cards, rose tags, merge bar then a centred spine. Closest to the screenshot. |
| B | Chapel Tree shell | Live header chrome around the same geometry, Fraunces / amethyst cards. |
| C | Typeset spine | Left rail, extra parents as side insets, skip-edge drawn. Not a card stack. |

## Serve

From the repo root:

```
npm run prototype:etymology-layout
```

Visit http://127.0.0.1:4174/

Direct:

```
node .scratch/first-principled-v8/research/04-etymology-layout-prototype/serve.mjs
```
