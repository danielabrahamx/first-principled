// CDP live smoke for ticket 05 against first-principled.netlify.app.
// Prints no secrets. Screenshots land next to this file.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const LIVE = "https://first-principled.netlify.app/";
const TREE_WAIT_MS = 240000;
const BRIEF_WAIT_MS = 120000;

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
  await new Promise((r) => setTimeout(r, 1200));

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
      headerBottom: hr ? Math.round(hr.bottom) : null,
      vw: window.innerWidth,
      vh: window.innerHeight,
      docScrollWidth: document.documentElement.scrollWidth,
    };
  })()`);

  check("375px live page loads", true, `vw ${chrome.vw}`);
  check("no Ask / Chat / Map / Reality chrome", !chrome.hasAsk && !chrome.hasChat && !chrome.hasMapTab && !chrome.hasReality, JSON.stringify(chrome.buttons));
  check("Tutor toggle present, closed", chrome.hasTutor && chrome.tutorExpanded === false && chrome.dockHidden, `expanded ${chrome.tutorExpanded} dockHidden ${chrome.dockHidden}`);
  check("word input present", chrome.hasEntry);
  check(
    "375px header does not overflow the page",
    chrome.headerRight !== null && chrome.headerRight <= chrome.vw + 1,
    `headerRight ${chrome.headerRight} vw ${chrome.vw} docScrollWidth ${chrome.docScrollWidth}`
  );
  await shot(page, "05-375-empty.png");

  await evaluate(page, `(() => {
    const input = document.querySelector(".map-entry-input");
    const form = document.querySelector(".map-entry");
    input.focus();
    input.value = "bit";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    form.requestSubmit();
    return true;
  })()`);

  const landed = await evaluate(
    page,
    `new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const tree = document.querySelector(".tree-root-card");
        const err = document.querySelector(".map-error");
        const errVisible = err && !err.hidden && err.textContent.trim().length > 0;
        const note = document.querySelector(".map-empty");
        const noteVisible = note && !note.hidden && note.textContent.trim().length > 0;
        if (tree) resolve({ kind: "tree" });
        else if (errVisible) resolve({ kind: "error", text: err.textContent.trim().slice(0, 240) });
        else if (noteVisible) resolve({ kind: "note", text: note.textContent.trim().slice(0, 240) });
        else if (Date.now() - start > ${TREE_WAIT_MS}) resolve({ kind: "timeout" });
        else setTimeout(tick, 250);
      };
      tick();
    })`
  );
  console.log("land", JSON.stringify(landed));

  if (landed.kind !== "tree") {
    check("live Tree after typing a word", false, JSON.stringify(landed));
    await shot(page, "05-375-fail.png");
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} checks passed`);
    child.kill();
    process.exit(2);
  }

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
    const root = document.querySelector(".tree-root-card");
    const cards = [...document.querySelectorAll(".tree-branch-card")];
    const layers = [...document.querySelectorAll(".tree-layer")];
    const cxs = cards.map((c) => Math.round(parseFloat(c.style.left) + parseFloat(c.style.width || 280) / 2));
    const dock = document.querySelector(".map-dock-wrap");
    const msgs = [...document.querySelectorAll(".dock-messages .msg, .dock-messages p")].map((n) => n.textContent.trim());
    return {
      hasRoot: !!root,
      cardCount: cards.length,
      layerCount: layers.length,
      uniqueCx: new Set(cxs).size,
      opacities: layers.map((l) => getComputedStyle(l).opacity),
      dockHidden: !dock || dock.hidden === true,
      dockText: msgs.join(" | ").slice(0, 200),
      scrollY: window.scrollY,
    };
  })()`);

  check("branching cladogram (not a vertical stack)", tree.hasRoot && tree.uniqueCx >= 4, `cards ${tree.cardCount} uniqueCx ${tree.uniqueCx}`);
  check("layers visible at scroll 0", tree.opacities.length > 0 && tree.opacities.every((o) => Number(o) === 1) && tree.scrollY === 0, JSON.stringify(tree.opacities));
  check("Tutor still closed after Tree lands", tree.dockHidden, `dockText ${tree.dockText}`);
  check("no opening tutor probe", !tree.dockText || tree.dockText.length === 0, tree.dockText);
  await shot(page, "05-375-tree.png");

  await evaluate(page, `document.querySelector(".tutor-toggle").click()`);
  const opened = await evaluate(page, `(() => {
    const dock = document.querySelector(".map-dock-wrap");
    return {
      expanded: document.querySelector(".tutor-toggle")?.getAttribute("aria-expanded") === "true",
      dockHidden: !dock || dock.hidden === true,
      placeholder: document.querySelector(".dock-input")?.placeholder || "",
    };
  })()`);
  check("Tutor opens on toggle", opened.expanded && opened.dockHidden === false, JSON.stringify(opened));

  const submitted = await evaluate(page, `(() => {
    const input = document.querySelector(".dock-input");
    const form = document.querySelector(".dock-composer");
    input.focus();
    input.value = "What is a bit?";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    form.requestSubmit();
    return { hidden: form.hidden, value: input.value, sending: form.getAttribute("aria-busy") };
  })()`);
  console.log("submit", JSON.stringify(submitted));

  const brief = await evaluate(
    page,
    `new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const err = document.querySelector(".dock-error");
        const errVisible = err && !err.hidden && err.textContent.trim().length > 0;
        const replies = [...document.querySelectorAll(".dock-assistant p")].map((n) => n.textContent.trim()).filter(Boolean);
        const last = replies[replies.length - 1] || "";
        if (errVisible) resolve({ kind: "error", text: err.textContent.trim().slice(0, 240) });
        else if (last.length > 20) resolve({ kind: "brief", text: last.slice(0, 240), endsProbe: /\\?\\s*$/.test(last) });
        else if (Date.now() - start > ${BRIEF_WAIT_MS}) resolve({ kind: "timeout", sample: last.slice(0, 120) });
        else setTimeout(tick, 250);
      };
      tick();
    })`
  );
  console.log("brief", JSON.stringify(brief));
  check("one briefing turn works", brief.kind === "brief" && brief.endsProbe === false, JSON.stringify(brief));
  await shot(page, "05-375-brief.png");

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  child.kill();
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((e) => {
  console.error("PROBE ERROR:", e.message);
  process.exit(1);
});
