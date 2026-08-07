/**
 * Defensive parsing of model JSON output.
 *
 * Per the ticket 03 findings, DeepSeek JSON mode is best-effort: the reply
 * is candidate JSON, not guaranteed. This module implements the fallback
 * chain: JSON.parse, then extraction of the first balanced `{...}` span
 * (tolerating markdown fences and surrounding commentary), then null.
 * The caller decides whether to retry the model.
 */

/**
 * Extracts the first balanced `{...}` span from a string. Scans character by
 * character, tracking brace depth, so inner braces and strings with braces
 * do not break the span. Returns null when no balanced span exists.
 *
 * @param {string} text
 * @returns {string | null}
 */
export function extractBalancedObject(text) {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

/**
 * Parses a model reply as JSON. Returns null when the reply contains no
 * parseable JSON object.
 *
 * @param {string} content
 * @returns {unknown | null}
 */
export function parseModelJson(content) {
  if (typeof content !== "string" || content.trim().length === 0) {
    return null;
  }
  const direct = content.trim();
  try {
    const parsed = JSON.parse(direct);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // fall through to span extraction
  }
  const span = extractBalancedObject(content);
  if (span === null) return null;
  try {
    const parsed = JSON.parse(span);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // fall through
  }
  return null;
}
