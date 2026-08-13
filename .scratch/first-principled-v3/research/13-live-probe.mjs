// CDP probe for ticket 13: multi-stream convergence. Drives headless Edge
// against a local static server (13-serve.mjs, port 8787), seeds generation
// with the convergence fixture (llmRealityMap - the transformer node
// combines attention, embeddings, and compute), and audits:
//  - the convergence node card carries a readable "combines N fields" chip
//  - desktop renders the fan-in strokes; mobile (375/320) renders the chip
//    and no fan (the fan would crowd a single column)
//  - the node panel renders the crux record AND the contributing
//    observations from the other fields
//  - no horizontal overflow at 375/320/desktop
//
// The /api/agent request is intercepted and fulfilled with the fixture, so
// the run needs no backend and no API key.
//
// Usage: node .scratch/first-principled-v3/research/13-cdp-probe.mjs
const { spawn } = await import("node:child_process");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
import http from "node:http";

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
  const server = spawn(process.execPath, [".scratch/first-principled-v3/research/13-serve.mjs"]);
  await new Promise((r) => setTimeout(r, 800));

  const { child, port } = await launch();
  const page = await connect(port);
  await page.call("Page.enable", {});
  await page.call("Runtime.enable", {});

  // Intercept the generation call; non-api requests flow through.
  let pendingApi = null;
  page.events["Fetch.requestPaused"] = (params) => {
    const url = params.request.url;
    if (url.endsWith("/api/agent")) {
      pendingApi = params.requestId;
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

  /** Fulfill the paused generation with the convergence fixture. Waits up to
   *  4s for the request to pause, so a slow reload cannot flake the run. */
  async function fulfillGeneration() {
    const deadline = Date.now() + 4000;
    while (pendingApi === null && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (pendingApi === null) {
      check("generation request was made", false, "no paused request");
      return false;
    }
    await page.call("Fetch.fulfillRequest", {
      requestId: pendingApi,
      responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      body: Buffer.from(JSON.stringify(initResponse)).toString("base64"),
    });
    pendingApi = null;
    await new Promise((r) => setTimeout(r, 1200));
    return true;
  }

  /** Submit a word so the map owns a session and the tree can land. */
  async function submitWord() {
    await evaluate(page, `(() => {
      const input = document.querySelector(".map-entry-input");
      input.value = "large language model";
      document.querySelector(".map-entry").requestSubmit();
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 600));
  }

  const transformerCard = `(() => {
    const cards = [...document.querySelectorAll(".tree-branch-card")];
    return cards.find((c) => (c.querySelector(".tree-branch-card-label")?.textContent || "") === "transformer");
  })()`;

  // Seed one session and land the convergence tree.
  await submitWord();
  await fulfillGeneration();

  // --- desktop: fan-in strokes + chip + panel --------------------------------
  await page.call("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await page.call("Page.reload", {});
  await waitForHeader();
  await submitWord();
  await fulfillGeneration();

  const desktop = await evaluate(page, `(() => {
    const tree = document.querySelector(".tree-stage");
    const card = ${transformerCard};
    const chip = card ? card.querySelector(".tree-converge-chip") : null;
    const fanPaths = [...document.querySelectorAll(".tree-converge-fans path")];
    const fansVisible = fanPaths.every((p) => {
      const r = p.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    return {
      treeRendered: !!tree,
      cardFound: !!card,
      chipText: chip ? chip.textContent.replace(/\\s+/g, " ").trim() : "",
      fanCount: fanPaths.length,
      fansVisible,
      docScrollWidth: document.documentElement.scrollWidth,
      vw: document.documentElement.clientWidth,
      stageWidth: tree ? tree.getBoundingClientRect().width : 0,
    };
  })()`);
  check("[desktop] convergence tree renders", desktop.treeRendered && desktop.cardFound);
  check("[desktop] transformer card carries a combines chip", /combines 3 fields/.test(desktop.chipText), desktop.chipText);
  check("[desktop] fan-in strokes drawn (one per convergence node)", desktop.fanCount >= 1 && desktop.fansVisible, `fans ${desktop.fanCount}`);
  check("[desktop] no horizontal overflow", desktop.docScrollWidth <= desktop.vw, `scrollWidth ${desktop.docScrollWidth} vw ${desktop.vw}`);

  // Open the convergence node panel: crux record + contributing observations.
  await evaluate(page, `(() => {
    const card = ${transformerCard};
    if (card) card.click();
    return true;
  })()`);
  await new Promise((r) => setTimeout(r, 500));
  const panel = await evaluate(page, `(() => {
    const body = document.querySelector(".node-panel-body");
    if (!body) return null;
    const text = body.textContent.replace(/\\s+/g, " ").trim();
    const obsCards = body.querySelectorAll(".obs-card").length;
    const h3s = [...body.querySelectorAll(".node-panel-h")].map((h) => h.textContent);
    return { text, obsCards, h3s };
  })()`);
  check("[desktop] node panel opens for the convergence node", panel !== null);
  check("[desktop] panel renders the crux record", /Vaswani|Attention Is All You Need/.test(panel.text), panel ? panel.text.slice(0, 120) : "");
  check(
    "[desktop] panel renders the contributing observations from other fields",
    panel !== null && /combines observations from other fields/.test(panel.h3s.join(" ")) && panel.obsCards >= 4,
    `obs cards ${panel ? panel.obsCards : 0}`
  );
  check("[desktop] panel shows the attention observation", /Bahdanau/.test(panel.text));

  // --- mobile: chip visible, fan hidden, no overflow -------------------------
  async function auditMobile(width, height) {
    await page.call("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: true,
    });
    pendingApi = null;
    await page.call("Page.reload", {});
    const booted = await waitForHeader();
    check(`[${width}px] map page boots after reload`, booted);
    if (!booted) return;
    await submitWord();
    await fulfillGeneration();

    const m = await evaluate(page, `(() => {
      const card = ${transformerCard};
      const chip = card ? card.querySelector(".tree-converge-chip") : null;
      const chipStyle = chip ? getComputedStyle(chip) : null;
      const fans = document.querySelectorAll(".tree-converge-fans path").length;
      const vw = document.documentElement.clientWidth;
      const offenders = [];
      for (const el of document.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1 || r.left < -1) {
          offenders.push({ tag: el.tagName, cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || "", id: el.id, left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) });
        }
      }
      return {
        cardFound: !!card,
        chipText: chip ? chip.textContent.replace(/\\s+/g, " ").trim() : "",
        chipVisible: chipStyle ? chipStyle.display !== "none" && chipStyle.visibility !== "hidden" : false,
        chipWidth: chip ? Math.round(chip.getBoundingClientRect().width) : 0,
        chipInView: chip ? (() => { const r = chip.getBoundingClientRect(); return r.left >= 0 && r.right <= document.documentElement.clientWidth; })() : false,
        fanCount: fans,
        docScrollWidth: document.documentElement.scrollWidth,
        vw,
        offenders: offenders.slice(0, 12),
      };
    })()`);
    check(`[${width}px] convergence card renders`, m.cardFound);
    check(`[${width}px] combines chip readable ("combines 3 fields")`, /combines 3 fields/.test(m.chipText) && m.chipVisible, m.chipText);
    check(`[${width}px] chip inside viewport (no overflow)`, m.chipInView, `chip width ${m.chipWidth}`);
    check(`[${width}px] no fan strokes on mobile`, m.fanCount === 0, `fans ${m.fanCount}`);
    check(`[${width}px] no horizontal overflow`, m.docScrollWidth <= m.vw, `scrollWidth ${m.docScrollWidth} vw ${m.vw} offenders ${JSON.stringify(m.offenders)}`);
  }

  await auditMobile(375, 667);
  await auditMobile(320, 568);

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
