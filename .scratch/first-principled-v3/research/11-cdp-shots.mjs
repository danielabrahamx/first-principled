// Screenshot capture for ticket 11 (Danny review; deploy deferred). Reuses
// the local static server (11-serve.mjs, port 8787) and the same Fetch
// interception as 11-cdp-probe.mjs: it stalls the generation call to capture
// the progressive skeleton, then fulfills it with the laptop fixture to
// capture the landed tree.
//
// Shots: map entry (no session), skeleton mid-build, landed tree, and the
// follow-up-only chat page - at 375px, 320px, and desktop.
//
// Usage: node .scratch/first-principled-v3/research/11-cdp-shots.mjs
const { spawn } = await import("node:child_process");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
import http from "node:http";
import fs from "node:fs";

import { laptopRealityMap } from "../../../src/lib/mmg/fixtures.js";

const OUT = ".scratch/first-principled-v3/research";

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
        resolve({ child, port: Number(out[1].match(/^ws:\/\/[^:]+:(\d+)/)[1]) });
      } else if (Date.now() > wait) {
        reject(new Error(stderr));
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

async function shot(page, file) {
  const s = await page.call("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  fs.writeFileSync(file, Buffer.from(s.data, "base64"));
  console.log("saved", file);
}

const initResponse = {
  reply: "What have you noticed about electricity?",
  learnerMap: { nodes: [], edges: [] },
  diff: { added: [], flipped: [], updated: [] },
  phase: "active",
  failedAttempts: {},
  realityMap: laptopRealityMap,
};

const server = spawn(process.execPath, [".scratch/first-principled-v3/research/11-serve.mjs"]);
await new Promise((r) => setTimeout(r, 800));

const { child, port } = await launch();
const page = await connect(port);
await page.call("Page.enable", {});
await page.call("Runtime.enable", {});

let pendingApi = null;
page.events["Fetch.requestPaused"] = (params) => {
  if (params.request.url.endsWith("/api/agent")) {
    pendingApi = params.requestId;
  } else {
    page.call("Fetch.continueRequest", { requestId: params.requestId }).catch(() => {});
  }
};
await page.call("Fetch.enable", { patterns: [{ urlPattern: "*" }] });

await page.call("Emulation.setDeviceMetricsOverride", {
  width: 375,
  height: 667,
  deviceScaleFactor: 1,
  mobile: true,
});
await page.call("Page.navigate", { url: "http://localhost:8787/" });
await new Promise((r) => setTimeout(r, 1500));

// 1. Map entry (no session): the full-width word input in the sticky header.
await shot(page, `${OUT}/11-map-entry-375.png`);

// 2. Skeleton mid-build: submit a word, hold the request, let a few bands light.
await evaluate(page, `(() => {
  document.querySelector(".map-entry-input").value = "laptop";
  document.querySelector(".map-entry").requestSubmit();
  return true;
})()`);
await new Promise((r) => setTimeout(r, 7000));
await shot(page, `${OUT}/11-skeleton-375.png`);

await page.call("Emulation.setDeviceMetricsOverride", {
  width: 320,
  height: 568,
  deviceScaleFactor: 1,
  mobile: true,
});
await page.call("Page.reload", {});
await new Promise((r) => setTimeout(r, 1500));
await evaluate(page, `(() => {
  document.querySelector(".map-entry-input").value = "laptop";
  document.querySelector(".map-entry").requestSubmit();
  return true;
})()`);
await new Promise((r) => setTimeout(r, 7000));
await shot(page, `${OUT}/11-skeleton-320.png`);

// 3. Landed tree: fulfill the held request, then shoot 320/375/desktop.
if (pendingApi) {
  await page.call("Fetch.fulfillRequest", {
    requestId: pendingApi,
    responseCode: 200,
    responseHeaders: [{ name: "Content-Type", value: "application/json" }],
    body: Buffer.from(JSON.stringify(initResponse)).toString("base64"),
  });
  pendingApi = null;
}
await new Promise((r) => setTimeout(r, 1500));
await shot(page, `${OUT}/11-tree-320.png`);

await page.call("Emulation.setDeviceMetricsOverride", {
  width: 375,
  height: 667,
  deviceScaleFactor: 1,
  mobile: true,
});
await new Promise((r) => setTimeout(r, 400));
await shot(page, `${OUT}/11-tree-375.png`);

await page.call("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await new Promise((r) => setTimeout(r, 600));
await shot(page, `${OUT}/11-tree-desktop.png`);

// 4. Chat follow-up-only at 375: no start form, points to the map.
await page.call("Emulation.setDeviceMetricsOverride", {
  width: 375,
  height: 667,
  deviceScaleFactor: 1,
  mobile: true,
});
await page.call("Page.navigate", { url: "http://localhost:8787/#chat" });
await new Promise((r) => setTimeout(r, 1500));
await shot(page, `${OUT}/11-chat-375.png`);

server.kill();
child.kill();
process.exit(0);
