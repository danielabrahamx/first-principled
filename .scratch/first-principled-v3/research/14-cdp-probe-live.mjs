// CDP probe for ticket 14: background function + client polling. Drives
// headless Edge against a local static server (14-serve.mjs, port 8787),
// seeds generation via the background transport, and audits, at 375px and
// 320px:
//  - the map entry flow submits a word and the POST /api/agent returns an
//    EMPTY 202 immediately (Netlify background function behavior - no job
//    id in the response)
//  - the client then POLLS GET /api/agent-status?job=<id>; the first polls
//    answer {status:"running"} and the skeleton stays up during that longer
//    wait, then a poll answers {status:"success", body} with the convergence
//    fixture (llmRealityMap) and the real tree lands on the map
//  - no horizontal overflow at any point (map entry, skeleton while running,
//    tree landed), tap targets fine
//
// Both endpoints are intercepted and fulfilled, so the run needs no backend
// and no API key. Screenshots (map-entry / skeleton / tree) are saved to
// research/14-<state>-<width>.png.
//
// Usage: node .scratch/first-principled-v3/research/14-cdp-probe.mjs
const { spawn } = await import("node:child_process");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
import http from "node:http";
import fs from "node:fs";

import { llmRealityMap } from "../../../src/lib/mmg/fixtures.js";

const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok, extra });
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? ` (${extra})` : ""}`);
};

function cdp(ws, id, method, params = {}) {
  return new Promise((resolve, reject) => {
    const onMsg = (ev) => {
      const msg = JSON.parse(ev.data.toString());
      if (msg.id === id) {
        ws.removeEventListener("message", onMsg);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function connect(port) {
  const res = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json`, (r) => resolve(r));
  });
  let data = "";
  for await (const chunk of res) data += chunk;
  const targets = JSON.parse(data);
  const page = targets.find((t) => t.type === "page");
  const WebSocket = globalThis.WebSocket;
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
  let id = 0;
  const call = (method, params = {}) => cdp(ws, ++id, method, params);
  const events = {};
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data.toString());
    if (msg.method && events[msg.method]) events[msg.method](msg.params);
  });
  return { ws, call, events };
}

const launch = () =>
  new Promise((resolve, reject) => {
    const child = spawn(EDGE, [
      "--headless=new",
      "--remote-debugging-port=0",
      "--no-first-run",
      "--disable-gpu",
      "about:blank",
    ]);
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));
    const wait = Date.now() + 8000;
    const poll = () => {
      const out = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (out) {
        const base = out[1].match(/^ws:\/\/[^:]+:(\d+)/);
        resolve({ child, port: Number(base[1]) });
      } else if (Date.now() > wait) {
        reject(new Error("no devtools endpoint: " + stderr));
      } else setTimeout(poll, 200);
    };
    poll();
  });

async function evaluate(page, expression) {
  const r = await page.call("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}

/** A valid init-turn response: the convergence fixture plus an opening turn. */
const initResponse = {
  reply: "What have you noticed about how a machine learns language?",
  learnerMap: { nodes: [], edges: [] },
  diff: { added: [], flipped: [], updated: [] },
  phase: "active",
  failedAttempts: {},
  realityMap: llmRealityMap,
};

const run = async () => {
  const server = spawn(process.execPath, [".scratch/first-principled-v3/research/14-serve.mjs"]);
  await new Promise((r) => setTimeout(r, 800));

  const { child, port } = await launch();
  const page = await connect(port);
  await page.call("Page.enable", {});
  await page.call("Runtime.enable", {});

  // Intercept both transport endpoints: the POST /api/agent is fulfilled
  // with the empty 202 a background function returns, and each GET
  // /api/agent-status?job=<id> poll is answered running until the success
  // fixture. Non-api requests flow through.
  /** @type {string | null} */
  let pendingPost = null;
  /** @type {string[]} */
  const pendingStatus = [];
  /** @type {string[]} */
  const statusPollUrls = [];
  /** @type {number} */
  let statusFulfilled = 0;
  page.events["Fetch.requestPaused"] = (params) => {
    const url = params.request.url;
    if (url.includes("/api/agent-status")) {
      pendingStatus.push(params.requestId);
      statusPollUrls.push(url);
    } else if (url.endsWith("/api/agent")) {
      pendingPost = params.requestId;
    } else {
      page.call("Fetch.continueRequest", { requestId: params.requestId }).catch(() => {});
    }
  };
  await page.call("Fetch.enable", { patterns: [{ urlPattern: "*" }] });

  await page.call("Page.navigate", { url: "https://first-principled.netlify.app/" });
  await new Promise((r) => setTimeout(r, 1500));

  async function waitForHeader() {
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      const ok = await evaluate(page, `!!document.querySelector(".map-header")`);
      if (ok) return true;
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  }

  /** Fulfill the paused generation POST with the empty 202 a background
   *  function returns. Waits up to 4s for the request to pause. */
  async function fulfillPost() {
    const deadline = Date.now() + 4000;
    while (pendingPost === null && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (pendingPost === null) return false;
    await page.call("Fetch.fulfillRequest", {
      requestId: pendingPost,
      responseCode: 202,
      responseHeaders: [],
      body: "",
    });
    pendingPost = null;
    return true;
  }

  /** Wait for the next paused status poll (the client polls every 2s). */
  async function waitForStatusPoll() {
    const deadline = Date.now() + 6000;
    while (pendingStatus.length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return pendingStatus.length > 0;
  }

  /** Fulfill every paused status poll: the first `runningFor` polls answer
   *  running, the rest answer success with the fixture. */
  async function fulfillStatusPolls(runningFor) {
    while (pendingStatus.length > 0) {
      const requestId = pendingStatus.shift();
      statusFulfilled += 1;
      const body =
        statusFulfilled <= runningFor
          ? { status: "running" }
          : { status: "success", body: initResponse };
      await page.call("Fetch.fulfillRequest", {
        requestId,
        responseCode: 200,
        responseHeaders: [{ name: "Content-Type", value: "application/json" }],
        body: Buffer.from(JSON.stringify(body)).toString("base64"),
      });
    }
  }

  async function shot(file) {
    const snap = await page.call("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(file, Buffer.from(snap.data, "base64"));
    console.log("saved", file);
  }

  async function auditViewport(width, height) {
    await page.call("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: true,
    });
    pendingPost = null;
    pendingStatus.length = 0;
    statusPollUrls.length = 0;
    statusFulfilled = 0;
    await page.call("Page.reload", {});
    const booted = await waitForHeader();
    check(`[${width}px] map page boots after reload`, booted);
    if (!booted) return;

    // --- map entry state ------------------------------------------------
    const entry = await evaluate(page, `(() => {
      const input = document.querySelector(".map-entry-input");
      const button = document.querySelector(".map-entry-button");
      const vw = document.documentElement.clientWidth;
      const offenders = [];
      for (const el of document.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1 || r.left < -1) {
          offenders.push({ tag: el.tagName, cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || "", left: Math.round(r.left), right: Math.round(r.right) });
        }
      }
      return {
        hasInput: !!input,
        hasButton: !!button,
        inputHeight: input ? Math.round(input.getBoundingClientRect().height) : 0,
        buttonHeight: button ? Math.round(button.getBoundingClientRect().height) : 0,
        docScrollWidth: document.documentElement.scrollWidth,
        vw,
        offenders: offenders.slice(0, 8),
      };
    })()`);
    check(`[${width}px] map entry input and build button present`, entry.hasInput && entry.hasButton);
    check(`[${width}px] no overflow with map entry`, entry.docScrollWidth <= entry.vw, `scrollWidth ${entry.docScrollWidth} vw ${entry.vw} ${JSON.stringify(entry.offenders)}`);
    check(`[${width}px] tap targets at least 40px`, entry.inputHeight >= 40 && entry.buttonHeight >= 40, `input ${entry.inputHeight} button ${entry.buttonHeight}`);
    await shot(`.scratch/first-principled-v3/research/14-map-entry-${width}.png`);

    // --- submit a word; the skeleton comes up immediately ---------------
    await evaluate(page, `(() => {
      const input = document.querySelector(".map-entry-input");
      input.value = "large language model";
      document.querySelector(".map-entry").requestSubmit();
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 600));
    const early = await evaluate(page, `(() => {
      const sk = document.querySelector(".tree-skeleton");
      return { visible: sk ? !sk.hidden : false };
    })()`);
    check(`[${width}px] skeleton visible right after submit`, early.visible);

    // The background function answers the POST with an empty 202; the client
    // then polls. Fulfill the POST, answer the first poll running, and
    // confirm the skeleton holds during the running wait.
    const posted = await fulfillPost();
    check(`[${width}px] generation POST was made`, posted);
    if (!posted) return;
    await waitForStatusPoll();
    await fulfillStatusPolls(2);
    await new Promise((r) => setTimeout(r, 300));

    const during = await evaluate(page, `(() => {
      const sk = document.querySelector(".tree-skeleton");
      const vw = document.documentElement.clientWidth;
      const offenders = [];
      for (const el of document.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1 || r.left < -1) {
          offenders.push({ tag: el.tagName, cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || "", left: Math.round(r.left), right: Math.round(r.right) });
        }
      }
      return {
        skeletonVisible: sk ? !sk.hidden : false,
        docScrollWidth: document.documentElement.scrollWidth,
        vw,
        offenders: offenders.slice(0, 8),
      };
    })()`);
    check(`[${width}px] skeleton holds while the job is running (a poll later)`, during.skeletonVisible);
    check(`[${width}px] no overflow with skeleton while running`, during.docScrollWidth <= during.vw, `scrollWidth ${during.docScrollWidth} vw ${during.vw} ${JSON.stringify(during.offenders)}`);
    await shot(`.scratch/first-principled-v3/research/14-skeleton-${width}.png`);

    // Let the remaining running poll answer, then the success poll lands the
    // tree on the map and hides the skeleton.
    await waitForStatusPoll();
    await fulfillStatusPolls(2);
    await waitForStatusPoll();
    await fulfillStatusPolls(2);
    await new Promise((r) => setTimeout(r, 1200));

    const landed = await evaluate(page, `(() => {
      const root = document.querySelector(".tree-root-card");
      const realityTab = document.querySelector('.seg-item[data-tab="reality"]');
      const sk = document.querySelector(".tree-skeleton");
      const vw = document.documentElement.clientWidth;
      const offenders = [];
      for (const el of document.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1 || r.left < -1) {
          offenders.push({ tag: el.tagName, cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || "", left: Math.round(r.left), right: Math.round(r.right) });
        }
      }
      return {
        hasRoot: !!root,
        rootWord: root ? root.querySelector(".tree-root-word")?.textContent ?? null : null,
        realityActive: realityTab ? realityTab.classList.contains("active") : false,
        skeletonHidden: sk ? sk.hidden : true,
        docScrollWidth: document.documentElement.scrollWidth,
        vw,
        offenders: offenders.slice(0, 8),
      };
    })()`);
    check(
      `[${width}px] generated tree lands on the map after the poll success`,
      landed.hasRoot && landed.realityActive,
      `root ${landed.rootWord} reality ${landed.realityActive}`
    );
    check(`[${width}px] skeleton hides when the tree lands`, landed.skeletonHidden);
    check(`[${width}px] no overflow with tree`, landed.docScrollWidth <= landed.vw, `scrollWidth ${landed.docScrollWidth} vw ${landed.vw} ${JSON.stringify(landed.offenders)}`);
    check(
      `[${width}px] status polls hit /api/agent-status with a job id`,
      statusPollUrls.length >= 2 && statusPollUrls.every((u) => u.includes("/api/agent-status?job=")),
      `${statusPollUrls.length} polls`
    );
    await shot(`.scratch/first-principled-v3/research/14-tree-${width}.png`);
  }

  await auditViewport(375, 667);
  await auditViewport(320, 568);

  server.kill();
  child.kill();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((e) => {
  console.error("PROBE ERROR:", e.message);
  process.exit(1);
});
