// CDP probe for ticket 03: branching cladogram + one-shot grow in the live Tree.
// Serves src/, drives headless Edge against ?demo=1, writes screenshots here.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../src");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 8788;
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
    const labels = [...document.querySelectorAll(".tree-branch-label")];
    const layers = [...document.querySelectorAll(".tree-layer")];
    const chips = [...document.querySelectorAll(".tree-converge-chip")];
    const panel = document.querySelector(".node-panel");
    const cxs = cards.map((c) => Math.round(parseFloat(c.style.left) + parseFloat(c.style.width || 280) / 2));
    return {
      hasRoot: !!root,
      cardCount: cards.length,
      branchCount: labels.length,
      layerCount: layers.length,
      uniqueCx: new Set(cxs).size,
      opacities: layers.map((l) => getComputedStyle(l).opacity),
      chipCount: chips.length,
      hasPanel: !!panel,
      docScrollWidth: document.documentElement.scrollWidth,
      vw: window.innerWidth,
    };
  })()`);

  check(`[${width}px] root + cards render`, m.hasRoot && m.cardCount >= 6, `cards ${m.cardCount}`);
  check(`[${width}px] branching (not a single column)`, m.uniqueCx >= 4, `unique cx ${m.uniqueCx}`);
  check(`[${width}px] layers visible at scroll 0`, m.opacities.every((o) => Number(o) === 1), JSON.stringify(m.opacities));
  check(`[${width}px] no page overflow`, m.docScrollWidth <= m.vw, `scrollWidth ${m.docScrollWidth} vw ${m.vw}`);
  check(`[${width}px] one layer per branch`, m.layerCount === m.branchCount, `layers ${m.layerCount}`);

  await evaluate(page, `window.scrollTo(0, Math.min(200, document.documentElement.scrollHeight))`);
  await new Promise((r) => setTimeout(r, 200));
  const after = await evaluate(page, `(() => ({
    opacities: [...document.querySelectorAll(".tree-layer")].map((l) => getComputedStyle(l).opacity),
    scrollY: window.scrollY,
  }))()`);
  check(
    `[${width}px] scroll does not fade layers`,
    after.opacities.every((o) => Number(o) === 1),
    `scrollY ${after.scrollY} ops ${JSON.stringify(after.opacities)}`
  );

  await evaluate(page, `window.scrollTo(0, 0)`);
  await new Promise((r) => setTimeout(r, 100));
  await shot(page, `03-${width}.png`);
  return m;
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

  await page.call("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await page.call("Emulation.setDeviceMetricsOverride", {
    width: 375,
    height: 667,
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
        if (layers.length > 0 || Date.now() - start > 3500) resolve(layers.length > 0);
        else requestAnimationFrame(tick);
      };
      tick();
    })`
  );
  const reduced = await evaluate(page, `(() => {
    const pulses = [...document.querySelectorAll(".tree-sap .tree-sap-pulse")];
    const layers = [...document.querySelectorAll(".tree-layer")];
    return {
      pulseCount: pulses.length,
      opacities: layers.map((l) => getComputedStyle(l).opacity),
      matches: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  })()`);
  check("reduced: OS setting honoured", reduced.matches === true);
  check("reduced: no sap pulses", reduced.pulseCount === 0);
  check(
    "reduced: full tree visible instantly",
    reduced.opacities.length > 0 && reduced.opacities.every((o) => Number(o) === 1),
    JSON.stringify(reduced.opacities)
  );
  await shot(page, "03-reduced-375.png");

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
