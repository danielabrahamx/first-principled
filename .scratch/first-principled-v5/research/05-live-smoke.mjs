// CDP live smoke for v5 ticket 05 against the unique deploy URL.
// Prints no secrets. Screenshots land next to this file.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const LIVE = "https://6a7e012e95f23a8700288a8b--first-principled.netlify.app/";

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

async function waitLoad(page) {
  await evaluate(
    page,
    `new Promise((resolve) => {
      if (document.readyState === "complete") resolve(true);
      else window.addEventListener("load", () => resolve(true), { once: true });
    })`
  );
}

const run = async () => {
  const { child, port } = await launch();
  const page = await connect(port);
  await page.call("Page.enable", {});
  await page.call("Runtime.enable", {});
  await page.call("Emulation.setDeviceMetricsOverride", {
    width: 375,
    height: 667,
    deviceScaleFactor: 1,
    mobile: true,
  });

  await page.call("Page.navigate", { url: LIVE });
  await waitLoad(page);
  await new Promise((r) => setTimeout(r, 1500));

  const chrome = await evaluate(page, `(() => {
    const buttons = [...document.querySelectorAll("button, a, [role='tab']")].map((n) => n.textContent.trim());
    const header = document.querySelector(".map-header");
    const hr = header ? header.getBoundingClientRect() : null;
    const dock = document.querySelector(".map-dock-wrap");
    return {
      buttons,
      hasAsk: buttons.includes("Ask"),
      hasChat: buttons.includes("Chat"),
      hasMapTab: buttons.includes("Map"),
      hasReality: buttons.includes("Reality"),
      hasTutor: buttons.includes("Tutor"),
      hasEntry: !!document.querySelector(".map-entry-input"),
      tutorExpanded: document.querySelector(".tutor-toggle")?.getAttribute("aria-expanded") === "true",
      dockHidden: !dock || dock.hidden === true,
      headerRight: hr ? Math.round(hr.right) : null,
      vw: window.innerWidth,
      docScrollWidth: document.documentElement.scrollWidth,
    };
  })()`);

  check("375px live page loads", true, `vw ${chrome.vw}`);
  check(
    "no Ask / Chat / Map / Reality chrome",
    !chrome.hasAsk && !chrome.hasChat && !chrome.hasMapTab && !chrome.hasReality,
    JSON.stringify(chrome.buttons)
  );
  check(
    "Tutor toggle present, closed",
    chrome.hasTutor && chrome.tutorExpanded === false && chrome.dockHidden
  );
  check("word input present", chrome.hasEntry);
  check(
    "375px no page overflow",
    chrome.docScrollWidth <= chrome.vw && chrome.headerRight <= chrome.vw + 1,
    `scrollWidth ${chrome.docScrollWidth} headerRight ${chrome.headerRight} vw ${chrome.vw}`
  );
  await shot(page, "05-375-empty.png");

  await page.call("Page.navigate", { url: `${LIVE}?demo=1` });
  await waitLoad(page);
  await evaluate(
    page,
    `new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const layers = [...document.querySelectorAll(".tree-layer")];
        const ready =
          layers.length > 0 &&
          layers.every((layer) => getComputedStyle(layer).opacity === "1");
        if (ready || Date.now() - start > 4000) resolve(ready);
        else requestAnimationFrame(tick);
      };
      tick();
    })`
  );

  const tree = await evaluate(page, `(() => {
    const cards = [...document.querySelectorAll(".tree-branch-card")];
    const yOf = (id) => {
      const n = cards.find((c) => c.dataset.nodeId === id);
      return n ? parseFloat(n.style.top) : null;
    };
    const cxs = [...new Set(cards.map((c) =>
      Math.round(parseFloat(c.style.left) + parseFloat(c.style.width || 280) / 2)
    ))];
    const dock = document.querySelector(".map-dock-wrap");
    const labels = [...document.querySelectorAll(".tree-branch-label")].map((n) => n.textContent);
    return {
      hasRoot: !!document.querySelector(".tree-root-card"),
      cardCount: cards.length,
      uniqueCx: cxs.length,
      yElectricity: yOf("n-electricity"),
      ySilicon: yOf("n-silicon"),
      yTransistor: yOf("n-transistor"),
      labels,
      dockHidden: !dock || dock.hidden === true,
      scrollY: window.scrollY,
      docScrollWidth: document.documentElement.scrollWidth,
      vw: window.innerWidth,
    };
  })()`);

  check("dependence-path Tree at scroll 0", tree.hasRoot && tree.scrollY === 0, `cards ${tree.cardCount}`);
  check(
    "electricity below silicon below transistor",
    tree.yElectricity > tree.ySilicon && tree.ySilicon > tree.yTransistor,
    `e ${tree.yElectricity} si ${tree.ySilicon} tr ${tree.yTransistor}`
  );
  check(
    "vertical spine, not a left/right cladogram",
    tree.uniqueCx <= 2 && tree.labels.includes("physics"),
    `cx ${tree.uniqueCx}`
  );
  check("Tutor still closed after Tree lands", tree.dockHidden === true);
  check(
    "375px tree: no page overflow",
    tree.docScrollWidth <= tree.vw,
    `scrollWidth ${tree.docScrollWidth} vw ${tree.vw}`
  );
  await shot(page, "05-375-tree.png");

  await evaluate(page, `document.querySelector(".tutor-toggle").click()`);
  await new Promise((r) => setTimeout(r, 200));
  const opened = await evaluate(page, `(() => {
    const sheet = document.getElementById("tutor-sheet");
    const treeEl = document.querySelector(".tree-stage");
    const split = document.querySelector(".map-split");
    const cols = split ? getComputedStyle(split).gridTemplateColumns : "";
    const sr = sheet.getBoundingClientRect();
    return {
      expanded: document.querySelector(".tutor-toggle")?.getAttribute("aria-expanded") === "true",
      hidden: sheet.hidden,
      sheetWidth: sr.width,
      sheetHeight: sr.height,
      sheetTop: sr.top,
      treeWidth: treeEl ? treeEl.getBoundingClientRect().width : 0,
      cols,
      vw: window.innerWidth,
    };
  })()`);
  check("Tutor opens as a bottom sheet", opened.expanded && opened.hidden === false, `h ${opened.sheetHeight}`);
  check(
    "open Tutor does not steal Tree width",
    opened.sheetWidth >= opened.vw - 1 && !String(opened.cols).includes("340") && opened.treeWidth >= opened.vw - 40,
    `sheet ${opened.sheetWidth} tree ${opened.treeWidth} cols ${opened.cols}`
  );

  const reach = await evaluate(page, `(() => {
    const card = document.querySelector('[data-node-id="n-electricity"]');
    const sheet = document.getElementById("tutor-sheet");
    card.scrollIntoView({ block: "end" });
    const cr = card.getBoundingClientRect();
    const sr = sheet.getBoundingClientRect();
    return {
      visibleHeight: Math.min(cr.bottom, sr.top) - Math.max(cr.top, 0),
      cardBottom: cr.bottom,
      sheetTop: sr.top,
    };
  })()`);
  check(
    "foundations reachable with sheet open",
    reach.visibleHeight > 24 && reach.cardBottom <= reach.sheetTop + 4,
    `visible ${reach.visibleHeight} cardBottom ${reach.cardBottom} sheetTop ${reach.sheetTop}`
  );
  await shot(page, "05-375-sheet.png");

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  child.kill();
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((e) => {
  console.error("PROBE ERROR:", e.message);
  process.exit(1);
});
