/**
 * Vocabulary check for learner-facing copy (ticket 06, docs/ste.md).
 *
 * Scans the hand-written UI copy in the static page and the Tutor dock
 * against the approved word list in docs/ste.md (one meaning per word, rule
 * 1). A word passes when it is on the approved list, a documented function
 * word, a documented UI/product term, or an inflection of an approved word
 * (plural, -ing, -ed). Everything else is a violation, reported per string.
 *
 * The check is a report, not a gate on the approved list alone: the approved
 * list is a domain vocabulary for the tree content, so plain-English glue
 * words (function words) and unavoidable UI chrome (tutor, session, retry)
 * are documented here instead. New drift outside both sets fails the test.
 *
 * Scope: src/index.html, src/pages/dock.js - the hand-written UI copy.
 * chat.js is unmounted (ticket 02); its leftover helpers are not learner-
 * facing. Scripted demo content (src/demo.js) models generated tutor output,
 * which is STE-gated by the generator prompt (rules 1-6) and steProblems,
 * not by this vocabulary list; the same applies to the refusal reasons in
 * realityMap.js and orchestrator.js, which were edited to the rules by hand.
 * Error envelopes in the Netlify function are internal API text the client
 * never shows (api/agent.js maps codes to its own lines).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { steProblems } from "./lib/agent/realityMap.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const COPY_FILES = [
  path.join(ROOT, "src", "index.html"),
  path.join(ROOT, "src", "pages", "dock.js"),
  path.join(ROOT, "src", "lib", "generation.js"),
];

/**
 * The approved word list from docs/ste.md: the first cell of every table row
 * under the three section headers. The header rows ("| Word | One meaning |")
 * do not match (capital W).
 *
 * @returns {Set<string>}
 */
function approvedWords() {
  const md = readFileSync(path.join(ROOT, "docs", "ste.md"), "utf8");
  const words = new Set();
  for (const line of md.split("\n")) {
    const m = line.match(/^\|\s*([a-z]+)\s*\|/);
    if (m) words.add(m[1]);
  }
  return words;
}

/** Closed-class English function words allowed in any copy. */
const FUNCTION_WORDS = new Set(
  `i me my mine you your yours he him his she her hers it its we us our ours
   they them their theirs this that these those who whom whose which what
   when where why how a an the and but or nor for so yet not no yes at by in
   of on to up down out off over under again further then once here there
   all any both each few many more most other another some such only own is are
   was were be been being am do does did have has had will would can could
   shall should may might must please try later too very just even still
   also ever never already about as because if than while although though
   unless until during since into onto through within without with between
   among against one`
    .split(/\s+/)
    .filter(Boolean)
);

/**
 * UI and product words the approved list does not cover, kept by design. The
 * list is the report: every entry is a conscious vocabulary choice in the
 * hand-written copy. Add a word here only when the copy genuinely needs it
 * and no approved word carries the meaning.
 */
const CHROME_WORDS = new Set(
  `tutor session demo key pages word phrase type enter send retry end new
   input message answer question request wait moment human pass continue
   ready fault happen side accept reach produce unreadable work large right
   like want name principled quick needed map page`
    .split(/\s+/)
    .filter(Boolean)
);

/** Example concept names in the start copy (content, not vocabulary). */
const EXAMPLE_WORDS = new Set(["laptop", "recursion", "photosynthesis"]);

/**
 * The inflected forms of a word the check tries against the approved list:
 * the word itself, its plural, its -ing and -ed forms. "Testing" -> "test",
 * "requests" -> "request", "happened" -> "happen".
 *
 * @param {string} word
 * @returns {string[]}
 */
function forms(word) {
  const out = [word];
  if (word.endsWith("es")) out.push(word.slice(0, -2));
  if (word.endsWith("s")) out.push(word.slice(0, -1));
  if (word.endsWith("ing")) out.push(word.slice(0, -3));
  if (word.endsWith("ed")) {
    out.push(word.slice(0, -2));
    out.push(word.slice(0, -1));
  }
  return out;
}

/**
 * Whether a word passes the vocabulary check. A word passes when any of its
 * inflected forms (the word, its plural, -ing, -ed) is on the approved list
 * or in a documented allowlist.
 *
 * @param {string} word
 * @param {Set<string>} approved
 * @returns {boolean}
 */
function passes(word, approved) {
  const lower = word.toLowerCase();
  return forms(lower).some(
    (form) =>
      approved.has(form) ||
      FUNCTION_WORDS.has(form) ||
      CHROME_WORDS.has(form) ||
      EXAMPLE_WORDS.has(form)
  );
}

/**
 * The candidate copy strings in a JS module: double-quoted and backtick
 * literals that look like prose or labels, skipping code tokens (ids, class
 * names, kinds, import paths) - lowercase tokens without spaces, kebab or
 * snake case, and template expressions. Comments are stripped first so
 * doc-string prose (which the rules also govern, but which is not copy) does
 * not pollute the report.
 *
 * @param {string} source
 * @returns {string[]}
 */
function jsCopyStrings(source) {
  const noComments = source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");
  const out = [];
  const literals = [
    ...noComments.matchAll(/"([^"\\\n]+)"/g),
    ...noComments.matchAll(/`([^`\\\n]+)`/g),
  ];
  for (const m of literals) {
    const s = m[1];
    if (s.includes("${")) continue;
    if (/^[a-z0-9-_.\/]+$/.test(s)) continue;
    if (/^[a-z0-9-_.\/ ]+$/.test(s) && s.includes("-")) continue;
    out.push(s);
  }
  return out;
}

/**
 * The candidate copy strings in the static page: visible text plus the
 * placeholder, title, aria-label and alt attribute values.
 *
 * @param {string} source
 * @returns {string[]}
 */
function htmlCopyStrings(source) {
  const out = [];
  const text = source
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ");
  out.push(text);
  for (const m of source.matchAll(/(?:placeholder|title|aria-label|alt)="([^"]+)"/g)) {
    out.push(m[1]);
  }
  return out;
}

/**
 * The words of a copy string.
 *
 * @param {string} s
 * @returns {string[]}
 */
function wordsOf(s) {
  return [...s.matchAll(/[a-z]+/gi)].map((m) => m[0]);
}

/**
 * @param {string} file
 * @returns {string[]}
 */
function copyStringsOf(file) {
  const source = readFileSync(file, "utf8");
  return file.endsWith(".html") ? htmlCopyStrings(source) : jsCopyStrings(source);
}

/**
 * Every violation as "word" -> "string" pairs, in file order.
 *
 * @param {Set<string>} approved
 * @returns {Array<{ file: string; string: string; words: string[] }>}
 */
function violations(approved) {
  const found = [];
  for (const file of COPY_FILES) {
    for (const s of copyStringsOf(file)) {
      const bad = [...new Set(wordsOf(s))].filter((w) => !passes(w, approved));
      if (bad.length > 0) found.push({ file, string: s, words: bad });
    }
  }
  return found;
}

test("learner-facing copy stays in the approved vocabulary", () => {
  const approved = approvedWords();
  assert.ok(approved.size >= 60, `expected at least 60 approved words, parsed ${approved.size}`);
  const found = violations(approved);
  const report = found
    .map((v) => `${v.file}: "${v.string}" -> [${v.words.join(", ")}]`)
    .join("\n");
  assert.deepEqual(
    found,
    [],
    `copy words outside the approved list and the documented allowlists:\n${report}`
  );
});

test("learner-facing copy follows the sentence rules (no contractions, no long sentences, no filler)", () => {
  const approved = approvedWords();
  const broken = [];
  for (const file of COPY_FILES) {
    for (const s of copyStringsOf(file)) {
      const check = steProblems(s);
      if (check.errors.length > 0) broken.push(`${file}: "${s}" -> ${check.errors.join("; ")}`);
    }
  }
  assert.deepEqual(
    broken,
    [],
    `copy strings failing the STE sentence rules:\n${broken.join("\n")}`
  );
});
