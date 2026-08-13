// Screenshot + chronology + desktop audit for ticket 10. Reuses the local
// static server (port 8787). Captures the reality tree at 375, 320, and
// desktop widths, and reports the live layer order for the chronology check.
// Usage: node .scratch/first-principled-v3/research/10-cdp-shots.mjs
const { spawn } = await import("node:child_process");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

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
  const http = await import("node:http");
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

const { port } = await launch();
const page = await connect(port);
await page.call("Page.enable", {});
await page.call("Runtime.enable", {});
await page.call("Page.navigate", { url: "http://localhost:8787/?demo=1" });
await new Promise((r) => setTimeout(r, 1500));

async function shot(width, height, file) {
  await page.call("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await page.call("Page.reload", {});
  await new Promise((r) => setTimeout(r, 1200));
  await evaluate(page, `(() => {
    const tab = document.querySelector('.seg-item[data-tab="reality"]');
    if (tab) tab.click();
    return true;
  })()`);
  await new Promise((r) => setTimeout(r, 400));
  const shot = await page.call("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  const fs = await import("node:fs");
  fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
  console.log("saved", file);
}

await shot(375, 667, ".scratch/first-principled-v3/research/10-tree-375.png");
await shot(320, 568, ".scratch/first-principled-v3/research/10-tree-320.png");

// Desktop audit: wide stage, expect layers to stay 1-up for the laptop
// fixture (no layer has 4+ nodes), trunk centered, no overflow.
await page.call("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await page.call("Page.reload", {});
await new Promise((r) => setTimeout(r, 1200));
await evaluate(page, `(() => {
  const tab = document.querySelector('.seg-item[data-tab="reality"]');
  if (tab) tab.click();
  return true;
})()`);
await new Promise((r) => setTimeout(r, 400));
const desk = await evaluate(page, `(() => {
  const labels = [...document.querySelectorAll(".tree-branch-label")].map((b) => b.textContent.trim());
  const cards = [...document.querySelectorAll(".tree-branch-card")].map((c) => c.querySelector(".tree-branch-card-label")?.textContent);
  const stage = document.querySelector(".tree-stage");
  const sr = stage.getBoundingClientRect();
  const cardRects = [...document.querySelectorAll(".tree-branch-card")].map((c) => c.getBoundingClientRect());
  const centers = cardRects.map((r) => Math.round((r.left + r.right) / 2));
  return {
    labels,
    cards,
    stageWidth: Math.round(sr.width),
    stageLeft: Math.round(sr.left),
    centers,
    docScrollWidth: document.documentElement.scrollWidth,
    vw: window.innerWidth,
  };
})()`);
console.log("desktop layers:", JSON.stringify(desk.labels));
console.log("desktop cards:", JSON.stringify(desk.cards));
console.log("desktop stage width:", desk.stageWidth, "left:", desk.stageLeft);
console.log("desktop card centers:", JSON.stringify(desk.centers));
const trunkX = desk.stageLeft + desk.stageWidth / 2;
console.log("trunkX:", Math.round(trunkX));
console.log("no overflow:", desk.docScrollWidth <= desk.vw, `(${desk.docScrollWidth} <= ${desk.vw})`);

const deskShot = await page.call("Page.captureScreenshot", { format: "png" });
const fs2 = await import("node:fs");
fs2.writeFileSync(
  ".scratch/first-principled-v3/research/10-tree-desktop.png",
  Buffer.from(deskShot.data, "base64")
);
console.log("saved 10-tree-desktop.png");
process.exit(0);