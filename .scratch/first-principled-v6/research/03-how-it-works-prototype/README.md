# How-it-works chrome prototype (throwaway)

Answers: what does the locked framing look like as chrome - one
sentence on the empty Tree, a short How it works page in the header, and
a word box that asks for a thing in reality from its foundations?

Not the live app. Do not copy this folder into `src/` as-is.
[Ship how-it-works into the Tree home](../../issues/05-ship-how-it-works.md)
ports the accepted bits.

Three layout variants, same locked copy, switchable from the bottom bar
or `?variant=A|B|C`.

| Key | Name | Structure |
| --- | --- | --- |
| A | Header chrome | Word box stays in the header (the old dock toggle becomes How it works). Empty Tree holds the one sentence. How it works is a short page. |
| B | Canvas hero | Header is logo + How it works only. Word box and sentence live on the empty canvas. |
| C | Docked box | Sentence and a faint Tree sit in the canvas. Word box docks at the bottom and stays while you read How it works. |

Recommended for [Ship how-it-works into the Tree home](../../issues/05-ship-how-it-works.md): **A**. It is the closest reading of the
grilling lock (header control, page not overlay, word box where it is
today). Steal from B or C before shipping if a flip-through says so.

## Serve

From the repo root:

```
npm run prototype:how-it-works
```

Opens nothing by itself. Visit http://localhost:4173/

Direct:

```
node .scratch/first-principled-v6/research/03-how-it-works-prototype/serve.mjs
```

Hash `#how` is the How it works page. Back to the Tree keeps whatever
you typed in the word box (memory only). There is no dock control and
no generator.

Overflow check (needs Edge or Chrome plus `puppeteer-core` in
node_modules):

```
node .scratch/first-principled-v6/research/03-how-it-works-prototype/check-overflow.mjs
```
