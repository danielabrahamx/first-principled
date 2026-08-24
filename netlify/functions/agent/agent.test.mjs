/**
 * Unit tests for the function wrapper's abuse gates (ticket 18) that do
 * not need the Netlify runtime: the rate limiter's counting logic with an
 * injected in-memory store. The body cap, Turnstile gate and dispatch are
 * exercised live against the deployed site (see the ticket file).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

// The wrapper reads the cap at module load; a small cap makes the
// in-memory fallback testable without sending 60+ requests.
process.env.RATE_LIMIT_MAX = "3";
const { overRateLimit, writeSnapshot } = await import("./agent.mjs");

const HOUR = new Date().toISOString().slice(0, 13);
const OLD_HOUR = "20000101T00";

/** A fake store recording what was written and persisting per key. */
function fakeStore(initial = null) {
  const writes = [];
  const data = new Map();
  if (initial !== null) data.set("ip:1.2.3.4", initial);
  return {
    writes,
    store: {
      async get(key) {
        return data.has(key) ? data.get(key) : null;
      },
      async setJSON(key, value, options) {
        data.set(key, value);
        writes.push({ key, value, options });
      },
      async set(key, value, options) {
        data.set(key, value);
        writes.push({ key, value, options });
      },
    },
  };
}

test("rate limiter allows requests under the cap and counts them", async () => {
  const { store, writes } = fakeStore();
  assert.equal(await overRateLimit("1.2.3.4", store), false);
  assert.equal(await overRateLimit("1.2.3.4", store), false);
  assert.equal(writes.length, 2);
  assert.equal(writes[1].value.count, 2);
  assert.equal(writes[1].value.hour, HOUR);
  assert.equal(writes[1].key, "ip:1.2.3.4");
  assert.ok(writes[1].options.expires > 0);
});

test("rate limiter rejects when the current window is at the cap", async () => {
  const { store } = fakeStore({ count: 60, hour: HOUR });
  assert.equal(await overRateLimit("1.2.3.4", store), true);
});

test("rate limiter resets when the stored window is stale", async () => {
  const { store, writes } = fakeStore({ count: 60, hour: OLD_HOUR });
  assert.equal(await overRateLimit("1.2.3.4", store), false);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].value.count, 1);
});

test("rate limiter keeps IPs independent", async () => {
  const { store } = fakeStore();
  await overRateLimit("10.0.0.1", store);
  assert.equal(await overRateLimit("10.0.0.2", store), false);
});

test("rate limiter fails open when the store throws", async () => {
  const broken = {
    async get() {
      throw new Error("store down");
    },
    async set() {
      throw new Error("store down");
    },
  };
  // A broken store falls through to the in-memory fallback, which limits
  // (the site stays up but the gate keeps counting locally).
  const memIp = "9.9.9.1";
  assert.equal(await overRateLimit(memIp, broken), false);
  assert.equal(await overRateLimit(memIp, broken), false);
});

test("rate limiter falls back to in-memory counting without a store", async () => {
  const memIp = "9.9.9.2";
  assert.equal(await overRateLimit(memIp), false);
  assert.equal(await overRateLimit(memIp), false);
  assert.equal(await overRateLimit(memIp), false);
  assert.equal(await overRateLimit(memIp), true);
});

test("snapshot writes swallow store errors instead of throwing after 202", async () => {
  const broken = {
    async setJSON() {
      throw new Error("blobs down");
    },
  };
  await writeSnapshot("job-1", "chronology", { concept: "battery", chronology: [] }, broken);
});
