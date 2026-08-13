// CDP probe for v5 ticket 04: Tutor bottom sheet, foundations reachable, 375/320.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../src");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 8794;
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok, extra });
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? ` (${extra})` : ""}`);
};

const server = http.createServer((req, res) => {
  let p = req.url.split("?")[0];
  if (p === "/" || p === "") p = "/index.html";
  const f = path.join(root, p);
  fs.readFile(f, (e, d) => {
    if (e) {
      res.writeHead(404);
      res.end("nf");
      return;
    }
    res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" });
    res.end(d);
  });
});

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
  const res = await new Promise((resolve) => {
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
  return { ws, call };
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

async function shot(page, name) {
  const { data } = await page.call("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(here, name), Buffer.from(data, "base64"));
  console.log("wrote", name);
}

async function audit(page, width, height) {
  await page.call("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await page.call("Page.reload", {});
  await evaluate(
    page,
    `new Promise((resolve) => {
      if (document.readyState === "complete") resolve(true);
      else window.addEventListener("load", () => resolve(true), { once: true });
    })`
  );
  await evaluate(
    page,
    `new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const layers = [...document.querySelectorAll(".tree-layer")];
        const ready =
          layers.length > 0 &&
          layers.every((layer) => getComputedStyle(layer).opacity === "1");
        if (ready || Date.now() - start > 3500) resolve(ready);
        else requestAnimationFrame(tick);
      };
      tick();
    })`
  );

  const closed = await evaluate(page, `(() => {
    const sheet = document.getElementById("tutor-sheet");
    const toggle = document.querySelector(".tutor-toggle");
    const tree = document.querySelector(".tree-stage");
    const split = document.querySelector(".map-split");
    const cols = split ? getComputedStyle(split).gridTemplateColumns : "";
    return {
      hidden: sheet ? sheet.hidden : true,
      expanded: toggle ? toggle.getAttribute("aria-expanded") : null,
      treeWidth: tree ? tree.getBoundingClientRect().width : 0,
      cols,
      docScrollWidth: document.documentElement.scrollWidth,
      vw: window.innerWidth,
    };
  })()`);

  check(`[${width}px] closed on first paint`, closed.hidden === true && closed.expanded === "false");
  check(
    `[${width}px] closed: no 340px rail`,
    !String(closed.cols).includes("340"),
    `cols ${closed.cols}`
  );
  check(
    `[${width}px] closed: no page overflow`,
    closed.docScrollWidth <= closed.vw,
    `scrollWidth ${closed.docScrollWidth} vw ${closed.vw}`
  );
  await shot(page, `04-${width}-closed.png`);

  await evaluate(page, `document.querySelector(".tutor-toggle").click()`);
  await new Promise((r) => setTimeout(r, 200));

  const opened = await evaluate(page, `(() => {
    const sheet = document.getElementById("tutor-sheet");
    const tree = document.querySelector(".tree-stage");
    const sheetRect = sheet.getBoundingClientRect();
    const treeRect = tree.getBoundingClientRect();
    const split = document.querySelector(".map-split");
    const cols = split ? getComputedStyle(split).gridTemplateColumns : "";
    return {
      hidden: sheet.hidden,
      sheetWidth: sheetRect.width,
      sheetLeft: sheetRect.left,
      sheetTop: sheetRect.top,
      sheetHeight: sheetRect.height,
      treeWidth: treeRect.width,
      cols,
      vw: window.innerWidth,
      docScrollWidth: document.documentElement.scrollWidth,
    };
  })()`);

  check(`[${width}px] open: sheet visible`, opened.hidden === false, `h ${opened.sheetHeight} top ${opened.sheetTop}`);
  check(
    `[${width}px] open: sheet spans viewport, not a 340px rail`,
    opened.sheetWidth >= opened.vw - 1 && opened.sheetLeft === 0 && !String(opened.cols).includes("340"),
    `sheet ${opened.sheetWidth} cols ${opened.cols}`
  );
  check(
    `[${width}px] open: tree width not stolen`,
    opened.treeWidth >= opened.vw - 40,
    `tree ${opened.treeWidth} vw ${opened.vw}`
  );
  check(
    `[${width}px] open: no page overflow`,
    opened.docScrollWidth <= opened.vw,
    `scrollWidth ${opened.docScrollWidth} vw ${opened.vw}`
  );

  const reach = await evaluate(page, `(() => {
    const card = document.querySelector('[data-node-id="n-electricity"]');
    const sheet = document.getElementById("tutor-sheet");
    card.scrollIntoView({ block: "end" });
    const cr = card.getBoundingClientRect();
    const sr = sheet.getBoundingClientRect();
    const visibleTop = Math.max(cr.top, 0);
    const visibleBottom = Math.min(cr.bottom, sr.top);
    return {
      cardBottom: cr.bottom,
      sheetTop: sr.top,
      visibleHeight: visibleBottom - visibleTop,
    };
  })()`);
  check(
    `[${width}px] foundations reachable above the sheet`,
    reach.visibleHeight > 24 && reach.cardBottom <= reach.sheetTop + 4,
    `visible ${reach.visibleHeight} cardBottom ${reach.cardBottom} sheetTop ${reach.sheetTop}`
  );
  await shot(page, `04-${width}-open.png`);
}

const run = async () => {
  await new Promise((resolve) => server.listen(PORT, resolve));
  const { child, port } = await launch();
  const page = await connect(port);
  await page.call("Page.enable", {});
  await page.call("Runtime.enable", {});
  await page.call("Page.navigate", { url: `http://127.0.0.1:${PORT}/?demo=1` });
  await new Promise((r) => setTimeout(r, 1600));

  await audit(page, 375, 667);
  await audit(page, 320, 568);

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  child.kill();
  server.close();
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((e) => {
  console.error("PROBE ERROR:", e.message);
  process.exit(1);
});
