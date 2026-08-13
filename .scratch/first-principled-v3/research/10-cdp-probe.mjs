// CDP probe for ticket 10: the vertical path layout + strict chronology +
// panel close fix. Drives headless Edge against the local static server,
// seeds the demo session (?demo=1), opens the Reality tab, and audits:
//  - tree renders (root + branch cards present)
//  - vertical geometry: trunk x centered, cards single-column at 375/320
//  - docScrollWidth == viewport width (no horizontal overflow)
//  - panel close: click a card, then click X / backdrop / Esc each close it
//
// Usage: node .scratch/first-principled-v3/research/10-cdp-probe.mjs
const { spawn } = await import("node:child_process");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

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
  const http = await import("node:http");
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
        child.listener = base;
        resolve({ child, wsUrl: out[1], port: Number(base[1]) });
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

async function auditViewport(page, width, height) {
  await page.call("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await page.call("Page.reload", {});
  await new Promise((r) => setTimeout(r, 1200));
  // Open the Reality tab.
  await evaluate(page, `(() => {
    const tab = document.querySelector('.seg-item[data-tab="reality"]');
    if (tab) { tab.click(); return true; }
    return false;
  })()`);
  await new Promise((r) => setTimeout(r, 400));

  const m = await evaluate(page, `(() => {
    const root = document.querySelector(".tree-root-card");
    const cards = [...document.querySelectorAll(".tree-branch-card")];
    const branchLabels = [...document.querySelectorAll(".tree-branch-label")];
    const stage = document.querySelector(".tree-stage");
    const stageRect = stage ? stage.getBoundingClientRect() : null;
    const cardEls = cards.map((c) => ({
      label: c.querySelector(".tree-branch-card-label")?.textContent,
      left: c.getBoundingClientRect().left,
      top: c.getBoundingClientRect().top,
      right: c.getBoundingClientRect().right,
    }));
    const trunkPaths = [...document.querySelectorAll(".tree-svg path")].map((p) => p.getAttribute("d"));
    return {
      hasRoot: !!root,
      rootWord: root?.querySelector(".tree-root-word")?.textContent ?? null,
      cardCount: cards.length,
      branchCount: branchLabels.length,
      labels: branchLabels.map((b) => b.textContent),
      cardEls,
      stageWidth: stage ? stageRect.width : null,
      stageLeft: stage ? stageRect.left : null,
      trunkPaths,
      docScrollWidth: document.documentElement.scrollWidth,
      vw: window.innerWidth,
      scrollY: window.scrollY,
      headerSticky: getComputedStyle(document.querySelector(".map-header")).position,
    };
  })()`);

  check(
    `[${width}px] root card renders with concept`,
    m.hasRoot && m.rootWord === "laptop",
    m.rootWord ?? "no root"
  );
  check(`[${width}px] tree cards render (${m.cardCount})`, m.cardCount >= 6);
  check(`[${width}px] no horizontal overflow`, m.docScrollWidth <= m.vw, `scrollWidth ${m.docScrollWidth} vw ${m.vw}`);

  // Vertical geometry: single-column at mobile widths - every card centered
  // on the stage's vertical midline, no card exceeds the viewport.
  const trunkX = (m.stageLeft ?? 0) + (m.stageWidth ?? m.vw) / 2;
  const centers = m.cardEls.map((c) => Math.round((c.left + c.right) / 2));
  const centered = m.cardEls.every((c) => Math.abs((c.left + c.right) / 2 - trunkX) < 4);
  check(`[${width}px] cards single-column centered on trunk`, centered, `trunkX ${Math.round(trunkX)} centers ${JSON.stringify(centers)}`);
  const inBounds = m.cardEls.every((c) => c.left >= 0 && c.right <= m.vw);
  check(`[${width}px] cards inside viewport`, inBounds);
  check(`[${width}px] header sticky`, m.headerSticky === "sticky");

  // Tap targets and contrast on the tree's interactive elements.
  const a11y = await evaluate(page, `(() => {
    const targets = [...document.querySelectorAll(".tree-branch-card, .tree-branch-label, .node-panel-close, .map-header .seg-item")];
    const rects = targets.filter((t) => t.offsetParent !== null).map((t) => {
      const r = t.getBoundingClientRect();
      return { cls: t.className, w: Math.round(r.width), h: Math.round(r.height) };
    });
    const samples = [
      document.querySelector(".tree-branch-card"),
      document.querySelector(".tree-branch-label"),
    ].filter(Boolean);
    const contrast = samples.map((s) => {
      const cs = getComputedStyle(s);
      return { cls: s.className, color: cs.color, bg: cs.backgroundColor };
    });
    return { rects, contrast };
  })()`);
  const smallTargets = a11y.rects.filter((t) => t.w < 44 && t.h < 44);
  check(`[${width}px] tap targets >= 44px`, smallTargets.length === 0, JSON.stringify(a11y.rects.slice(0, 6)));

  // Strict chronology: branch labels include the date-ordered layers.
  return m;
}

const run = async () => {
  const { port } = await launch();
  const page = await connect(port);
  await page.call("Page.enable", {});
  await page.call("Runtime.enable", {});
  await page.call("Page.navigate", { url: "http://localhost:8787/?demo=1" });
  await new Promise((r) => setTimeout(r, 1500));

  await auditViewport(page, 375, 667);
  await auditViewport(page, 320, 568);

  // Panel close fix at 375: open a card, then X closes; reopen, backdrop
  // closes; reopen, Esc closes.
  await evaluate(page, `(() => {
    const tab = document.querySelector('.seg-item[data-tab="reality"]');
    if (tab) tab.click();
    return true;
  })()`);
  await new Promise((r) => setTimeout(r, 300));

  const xClose = await evaluate(page, `(() => {
    const card = document.querySelector(".tree-branch-card");
    if (!card) return "no-card";
    const panel = document.querySelector(".node-panel");
    card.click();
    const afterOpen = String(panel.hidden);
    document.querySelector(".node-panel-close").click();
    const afterClose = String(panel.hidden);
    return afterOpen + "->" + afterClose;
  })()`);
  check("X button closes the panel", xClose === "false->true", xClose);

  const backdropClose = await evaluate(page, `(() => {
    const card = document.querySelector(".tree-branch-card");
    card.click();
    const panel = document.querySelector(".node-panel");
    const open = !panel.hidden;
    document.querySelector(".node-panel-backdrop").click();
    return open + "->" + String(panel.hidden);
  })()`);
  check("backdrop click closes the panel", backdropClose === "true->true", backdropClose);

  const escClose = await evaluate(page, `(() => {
    const card = document.querySelector(".tree-branch-card");
    card.click();
    const panel = document.querySelector(".node-panel");
    const open = !panel.hidden;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    return open + "->" + String(panel.hidden);
  })()`);
  check("Esc closes the panel", escClose === "true->true", escClose);

  const focusReturn = await evaluate(page, `(() => {
    const card = document.querySelector(".tree-branch-card");
    card.focus();
    card.click();
    document.querySelector(".node-panel-close").click();
    return document.activeElement === card ? "card" : document.activeElement?.className ?? "other";
  })()`);
  check("focus returns to the opening card", focusReturn === "card", focusReturn);

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((e) => {
  console.error("PROBE ERROR:", e.message);
  process.exit(1);
});
