// CDP probe for v5 ticket 03: dependence-path Tree in src/ at 375 and 320.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../src");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 8793;
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

  const m = await evaluate(page, `(() => {
    const root = document.querySelector(".tree-root-card");
    const cards = [...document.querySelectorAll(".tree-branch-card")];
    const labels = [...document.querySelectorAll(".tree-branch-label")].map((n) => n.textContent);
    const yOf = (id) => {
      const n = cards.find((c) => c.dataset.nodeId === id);
      return n ? parseFloat(n.style.top) : null;
    };
    const cxs = [...new Set(cards.map((c) =>
      Math.round(parseFloat(c.style.left) + parseFloat(c.style.width || 280) / 2)
    ))];
    return {
      hasRoot: !!root,
      cardCount: cards.length,
      labels,
      yElectricity: yOf("n-electricity"),
      ySilicon: yOf("n-silicon"),
      yTransistor: yOf("n-transistor"),
      uniqueCx: cxs.length,
      docScrollWidth: document.documentElement.scrollWidth,
      vw: window.innerWidth,
    };
  })()`);

  check(`[${width}px] root + cards render`, m.hasRoot && m.cardCount >= 6, `cards ${m.cardCount}`);
  check(
    `[${width}px] electricity below silicon below transistor`,
    m.yElectricity > m.ySilicon && m.ySilicon > m.yTransistor,
    `e ${m.yElectricity} si ${m.ySilicon} tr ${m.yTransistor}`
  );
  check(
    `[${width}px] named layer bands, not a cladogram`,
    m.labels.includes("physics") && m.labels.includes("electronics") && m.uniqueCx <= 2,
    `cx ${m.uniqueCx} labels ${m.labels.join(",")}`
  );
  check(
    `[${width}px] no page overflow`,
    m.docScrollWidth <= m.vw,
    `scrollWidth ${m.docScrollWidth} vw ${m.vw}`
  );

  await evaluate(page, `document.querySelector('[data-node-id="n-transistor"]').click()`);
  await new Promise((r) => setTimeout(r, 200));
  const panel = await evaluate(page, `(() => {
    const p = document.querySelector(".node-panel");
    return { open: p && !p.hidden, text: p ? p.textContent.slice(0, 80) : "" };
  })()`);
  check(`[${width}px] node panel opens`, panel.open === true, panel.text);
  await evaluate(page, `document.querySelector(".node-panel-close")?.click()`);
  await shot(page, `03-${width}.png`);
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
