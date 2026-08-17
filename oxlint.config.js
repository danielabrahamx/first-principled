import { defineConfig } from "oxlint";

/**
 * Anti-slop only. Default Oxlint correctness is off: this ticket vendors
 * the plugin, it does not adopt a full linter rewrite.
 *
 * TypeScript-syntax rules are off. This tree is JSDoc `.js`; those rules
 * need a TS type checker and would be silent or misleading here.
 */
export default defineConfig({
  // Empty plugins overwrites the default unicorn/typescript/oxc set.
  plugins: [],
  categories: {
    correctness: "off",
  },
  ignorePatterns: [
    "node_modules/",
    ".netlify/",
    ".scratch/",
    ".agent/",
    ".agents/",
    ".claude/",
    ".codex/",
    ".continue/",
    ".cursor/",
    ".gemini/",
    ".gstack/",
    ".opencode/",
    ".pi/",
    ".roo/",
    ".windsurf/",
    "tools/oxlint/anti-slop/",
    // Parked v2 engine-thread files. Do not lint or rewrite them here.
    "src/lib/agent/gaps.js",
    "src/lib/agent/gaps.test.js",
    "src/lib/agent/confidence.js",
    "src/lib/agent/confidence.test.js",
    "eval/concepts.js",
    "eval/eval.test.js",
    "eval/scorers.js",
  ],
  jsPlugins: [
    { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
  ],
  rules: {
    "anti-slop/no-conditional-empty-object-spread": "error",
    "anti-slop/no-module-mocking": "error",
    "anti-slop/no-reflect-apply": "error",
    "anti-slop/no-reflect-get": "error",
    "anti-slop/no-shape-in-symbol-names": "error",

    // Off: need TypeScript syntax or a type checker. This repo is JSDoc JS.
    "anti-slop/no-chained-type-assertions": "off",
    "anti-slop/no-known-value-widening": "off",
    "anti-slop/no-object-parameters": "off",
    "anti-slop/no-unknown-parameters": "off",
    "anti-slop/no-unknown-returns": "off",
    "anti-slop/no-unknown-type-aliases": "off",
    "anti-slop/no-unsafe-dictionary-type": "off",
    "anti-slop/no-widen-then-assert": "off",
    "anti-slop/require-safety-comment-for-type-assertion": "off",

    // Off: JSDoc JS decodes untrusted LLM JSON with typeof; there is no
    // compile-time type to recover. Enabling this would rewrite realityMap.js.
    "anti-slop/no-runtime-typeof": "off",
  },
});
