// Screenshots for ticket 12: the motion port in the live tree. Reuses the
// local static server (port 8787). Captures the reality tree at 375, 320,
// and desktop widths, plus a mid-growth scrolled shot (trunk half-drawn) so
// the scroll-driven growth is reviewable as a still for Danny.
// Usage: node .scratch/first-principled-v3/research/12-cdp-shots.mjs
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

async function shot(width, height, file, scrollFraction = 0) {
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
  if (scrollFraction > 0) {
    await evaluate(page, `window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * ${scrollFraction})`);
    await new Promise((r) => setTimeout(r, 300));
  }
  const snap = await page.call("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  const fs = await import("node:fs");
  fs.writeFileSync(file, Buffer.from(snap.data, "base64"));
  console.log("saved", file);
}

await shot(375, 667, ".scratch/first-principled-v3/research/12-tree-375.png", 1);
await shot(320, 568, ".scratch/first-principled-v3/research/12-tree-320.png", 1);
await shot(375, 667, ".scratch/first-principled-v3/research/12-tree-375-midgrowth.png", 0.3);

// Desktop full-tree shot.
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
await evaluate(page, `window.scrollTo(0, document.documentElement.scrollHeight)`);
await new Promise((r) => setTimeout(r, 300));
const desk = await page.call("Page.captureScreenshot", { format: "png" });
const fs2 = await import("node:fs");
fs2.writeFileSync(
  ".scratch/first-principled-v3/research/12-tree-desktop.png",
  Buffer.from(desk.data, "base64")
);
console.log("saved 12-tree-desktop.png");
process.exit(0);
