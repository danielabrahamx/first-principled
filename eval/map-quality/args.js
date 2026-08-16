/**
 * CLI flags for eval/map-quality/run.js.
 *
 * --live                 generate against the landed LLM
 * --maps-dir <path>      write each live concept as JSON (relative to repo root)
 * --baseline <path>      markdown gate table (relative to repo root)
 */

/**
 * @param {string[]} argv process.argv.slice(2)
 * @param {{ baselineFile: string }} defaults
 * @returns {{ wantLive: boolean; mapsDir: string | null; baselineFile: string }}
 */
export function parseEvalArgs(argv, defaults) {
  const args = Array.isArray(argv) ? argv : [];
  let wantLive = false;
  let mapsDir = null;
  let baselineFile = defaults.baselineFile;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === "--live") {
      wantLive = true;
      continue;
    }
    if (flag === "--maps-dir") {
      mapsDir = args[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (flag === "--baseline") {
      baselineFile = args[i + 1] ?? baselineFile;
      i += 1;
    }
  }
  return { wantLive, mapsDir, baselineFile };
}
