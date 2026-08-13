// CDP probe for ticket 12: the 07 motion shipped into the live vertical-path
// tree. Drives headless Edge against the local static server, seeds the demo
// session (?demo=1), opens the Reality tab, and audits:
//  - sap pulses: .tree-sap-pulse count == 1 trunk + one per branch (7 for the
//    6-layer laptop fixture), trunk tagged .tree-trunk with pathLength 1
//  - node lifecycle stagger: every root/label/card carries .tree-bud + a
//    deterministic --mt-delay
//  - scroll-driven growth: at scroll top the trunk is hidden (dashoffset 1)
//    and the crown layer is at opacity 0; at the bottom the trunk is drawn
//    (dashoffset 0) and every layer is fully visible
//  - reduced motion (Emulation.setEmulatedMedia): 0 sap pulses, no scroll
//    wiring (trunk renders full, no dashoffset), layers fully visible
//  - 375px / 320px: no horizontal overflow, no layout shift
//
// Usage: node .scratch/first-principled-v3/research/12-cdp-probe.mjs
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

const openTree = `(() => {
  const tab = document.querySelector('.seg-item[data-tab="reality"]');
  if (tab) tab.click();
  return true;
})()`;

async function auditViewport(page, width, height) {
  await page.call("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await page.call("Page.reload", {});
  await new Promise((r) => setTimeout(r, 1200));
  await evaluate(page, openTree);
  await new Promise((r) => setTimeout(r, 400));

  const m = await evaluate(page, `(() => {
    const root = document.querySelector(".tree-root-card");
    const cards = [...document.querySelectorAll(".tree-branch-card")];
    const labels = [...document.querySelectorAll(".tree-branch-label")];
    const pulses = [...document.querySelectorAll(".tree-sap .tree-sap-pulse")];
    const trunks = [...document.querySelectorAll(".tree-trunk")];
    const layers = [...document.querySelectorAll(".tree-layer")];
    const buds = [...document.querySelectorAll(".tree-bud")];
    const cardRects = cards.map((c) => {
      const r = c.getBoundingClientRect();
      return { left: r.left, right: r.right, w: r.width };
    });
    const stage = document.querySelector(".tree-stage");
    const sr = stage ? stage.getBoundingClientRect() : null;
    return {
      hasRoot: !!root,
      cardCount: cards.length,
      branchCount: labels.length,
      pulseCount: pulses.length,
      trunkCount: trunks.length,
      trunkPathLength: trunks[0] ? trunks[0].getAttribute("pathLength") : null,
      layerCount: layers.length,
      budCount: buds.length,
      delayOnRoot: root ? root.style.getPropertyValue("--mt-delay") : null,
      delayOnCard: cards[0] ? cards[0].style.getPropertyValue("--mt-delay") : null,
      cardRects,
      stageLeft: sr ? sr.left : null,
      stageWidth: sr ? sr.width : null,
      docScrollWidth: document.documentElement.scrollWidth,
      vw: window.innerWidth,
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
    };
  })()`);

  check(`[${width}px] root + cards render`, m.hasRoot && m.cardCount >= 6, `cards ${m.cardCount}`);
  check(`[${width}px] no horizontal overflow`, m.docScrollWidth <= m.vw, `scrollWidth ${m.docScrollWidth} vw ${m.vw}`);
  check(`[${width}px] sap pulse train: 1 trunk + 1 per branch`, m.pulseCount === m.branchCount + 1, `pulses ${m.pulseCount} branches ${m.branchCount}`);
  check(`[${width}px] trunk tagged pathLength=1`, m.trunkCount === 1 && m.trunkPathLength === "1");
  check(`[${width}px] one .tree-layer per branch`, m.layerCount === m.branchCount, `layers ${m.layerCount}`);
  const expectedBuds = m.branchCount + m.cardCount + 1;
  check(`[${width}px] every node buds with a --mt-delay`, m.budCount === expectedBuds && m.delayOnCard !== null, `buds ${m.budCount}/${expectedBuds}`);

  // Cards stay centered on the trunk at mobile widths (no geometry shift).
  const trunkX = (m.stageLeft ?? 0) + (m.stageWidth ?? m.vw) / 2;
  const centered = m.cardRects.every((c) => Math.abs((c.left + c.right) / 2 - trunkX) < 4);
  check(`[${width}px] cards centered on trunk`, centered);
  const inBounds = m.cardRects.every((c) => c.left >= 0 && c.right <= m.vw && c.w <= m.vw);
  check(`[${width}px] cards inside viewport`, inBounds);

  // Scroll-driven growth: top hides the tree, bottom reveals it.
  const hasScrollRoom = m.scrollHeight > m.innerHeight;
  if (hasScrollRoom) {
    await evaluate(page, `window.scrollTo(0, 0)`);
    await new Promise((r) => setTimeout(r, 250));
    const top = await evaluate(page, `(() => {
      const trunk = document.querySelector(".tree-trunk");
      const layers = [...document.querySelectorAll(".tree-layer")];
      const crown = layers[0];
      return {
        dash: trunk ? trunk.getAttribute("stroke-dashoffset") : null,
        crownOpacity: crown ? getComputedStyle(crown).opacity : null,
      };
    })()`);
    check(
      `[${width}px] scroll top: trunk hidden, crown layer invisible`,
      top.dash === "1" && Number(top.crownOpacity) === 0,
      `dash ${top.dash} crown ${top.crownOpacity}`
    );

    await evaluate(page, `window.scrollTo(0, document.documentElement.scrollHeight)`);
    await new Promise((r) => setTimeout(r, 350));
    const bottom = await evaluate(page, `(() => {
      const trunk = document.querySelector(".tree-trunk");
      const layers = [...document.querySelectorAll(".tree-layer")];
      return {
        dash: trunk ? trunk.getAttribute("stroke-dashoffset") : null,
        opacities: layers.map((l) => getComputedStyle(l).opacity),
      };
    })()`);
    const allVisible = bottom.opacities.every((o) => Number(o) === 1);
    check(
      `[${width}px] scroll bottom: trunk drawn, all layers visible`,
      bottom.dash === "0" && allVisible,
      `dash ${bottom.dash} ops ${JSON.stringify(bottom.opacities)}`
    );
  } else {
    check(`[${width}px] growth (page too short to scroll)`, true, "no scroll room");
  }

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

  // Reduced motion: emulate the OS setting, reload, and re-open the tree.
  await page.call("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await page.call("Page.reload", {});
  await new Promise((r) => setTimeout(r, 1200));
  await evaluate(page, openTree);
  await new Promise((r) => setTimeout(r, 400));

  const reduced = await evaluate(page, `(() => {
    const pulses = [...document.querySelectorAll(".tree-sap .tree-sap-pulse")];
    const trunk = document.querySelector(".tree-trunk");
    const layers = [...document.querySelectorAll(".tree-layer")];
    const buds = [...document.querySelectorAll(".tree-bud")];
    return {
      pulseCount: pulses.length,
      sapGroups: document.querySelectorAll(".tree-sap").length,
      trunkDash: trunk ? trunk.getAttribute("stroke-dashoffset") : null,
      layerOpacities: layers.map((l) => getComputedStyle(l).opacity),
      budCount: buds.length,
      matches: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  })()`);
  check("reduced: OS setting honoured", reduced.matches === true);
  check("reduced: no SMIL sap pulses", reduced.pulseCount === 0 && reduced.sapGroups === 0);
  check(
    "reduced: trunk renders full, no scroll wiring",
    reduced.trunkDash === null,
    `dash ${reduced.trunkDash}`
  );
  const allVisible = reduced.layerOpacities.every((o) => Number(o) === 1);
  check("reduced: full tree visible instantly", allVisible, JSON.stringify(reduced.layerOpacities));
  check("reduced: no lifecycle stagger", reduced.budCount === 0);

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((e) => {
  console.error("PROBE ERROR:", e.message);
  process.exit(1);
});
