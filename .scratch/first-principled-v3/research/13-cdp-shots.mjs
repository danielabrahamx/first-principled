// Screenshots for ticket 13: multi-stream convergence. Seeds generation with
// the convergence fixture (llmRealityMap) via /api/agent interception, then
// captures the reality tree at desktop (fan-in strokes), 375px (combines
// chip), and 320px (combines chip), plus the convergence node panel.
// Usage: node .scratch/first-principled-v3/research/13-cdp-shots.mjs
const { spawn } = await import("node:child_process");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
import http from "node:http";

import { llmRealityMap } from "../../../src/lib/mmg/fixtures.js";

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
  const res = await new Promise((resolve, reject) =>
    http.get(`http://127.0.0.1:${port}/json`, (r) => resolve(r))
  );
  let data = "";
  for await (const chunk of res) data += chunk;
  const targets = JSON.parse(data);
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
  let id = 0;
  const call = (method, params = {}) => cdp(ws, ++id, method, params);
  return { ws, call };
}

async function evaluate(page, expression) {
  const r = await page.call("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
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
        resolve({ child, port: Number(out[1].match(/^ws:\/\/[^:]+:(\d+)/)[1]) });
      } else if (Date.now() > wait) {
        reject(new Error("no devtools endpoint: " + stderr));
      } else setTimeout(poll, 200);
    };
    poll();
  });

const initResponse = {
  reply: "What have you noticed about how a machine learns language?",
  learnerMap: { nodes: [], edges: [] },
  diff: { added: [], flipped: [], updated: [] },
  phase: "active",
  failedAttempts: {},
  realityMap: llmRealityMap,
};

const server = spawn(process.execPath, [".scratch/first-principled-v3/research/13-serve.mjs"]);
await new Promise((r) => setTimeout(r, 800));

const { child, port } = await launch();
const page = await connect(port);
await page.call("Page.enable", {});
await page.call("Runtime.enable", {});

let pendingApi = null;
const events = {};
page.ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data.toString());
  if (msg.method && events[msg.method]) events[msg.method](msg.params);
});
events["Fetch.requestPaused"] = (params) => {
  const url = params.request.url;
  if (url.endsWith("/api/agent")) pendingApi = params.requestId;
  else page.call("Fetch.continueRequest", { requestId: params.requestId }).catch(() => {});
};
await page.call("Fetch.enable", { patterns: [{ urlPattern: "*" }] });

await page.call("Page.navigate", { url: "http://localhost:8787/" });
await new Promise((r) => setTimeout(r, 1500));

async function seed(width, height, mobile) {
  await page.call("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
  pendingApi = null;
  await page.call("Page.reload", {});
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    const ok = await evaluate(page, `!!document.querySelector(".map-entry-input")`);
    if (ok) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  await evaluate(page, `(() => {
    document.querySelector(".map-entry-input").value = "large language model";
    document.querySelector(".map-entry").requestSubmit();
    return true;
  })()`);
  await new Promise((r) => setTimeout(r, 600));
  if (pendingApi !== null) {
    await page.call("Fetch.fulfillRequest", {
      requestId: pendingApi,
      responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      body: Buffer.from(JSON.stringify(initResponse)).toString("base64"),
    });
    pendingApi = null;
  }
  await new Promise((r) => setTimeout(r, 1200));
  await evaluate(page, `window.scrollTo(0, 0)`);
  await new Promise((r) => setTimeout(r, 300));
}

async function shot(file, scrollToBottom = false) {
  if (scrollToBottom) {
    await evaluate(page, `window.scrollTo(0, document.documentElement.scrollHeight)`);
    await new Promise((r) => setTimeout(r, 400));
  }
  const snap = await page.call("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  const fs = await import("node:fs");
  fs.writeFileSync(file, Buffer.from(snap.data, "base64"));
  console.log("saved", file);
}

// Desktop: fan-in strokes visible.
await seed(1280, 900, false);
await shot(".scratch/first-principled-v3/research/13-tree-desktop.png", true);

// Desktop: convergence node panel (crux + contributing observations).
await evaluate(page, `(() => {
  const cards = [...document.querySelectorAll(".tree-branch-card")];
  const card = cards.find((c) => (c.querySelector(".tree-branch-card-label")?.textContent || "") === "transformer");
  if (card) card.click();
  return true;
})()`);
await new Promise((r) => setTimeout(r, 400));
const snapPanel = await page.call("Page.captureScreenshot", { format: "png" });
const fs3 = await import("node:fs");
fs3.writeFileSync(
  ".scratch/first-principled-v3/research/13-panel-convergence.png",
  Buffer.from(snapPanel.data, "base64")
);
console.log("saved 13-panel-convergence.png");

// Mobile: combines chip readable, no fan.
await seed(375, 667, true);
await shot(".scratch/first-principled-v3/research/13-tree-375.png", true);
await seed(320, 568, true);
await shot(".scratch/first-principled-v3/research/13-tree-320.png", true);

server.kill();
child.kill();
process.exit(0);
