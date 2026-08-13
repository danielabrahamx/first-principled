// CDP probe for ticket 11: map word entry + shared generation + progressive
// skeleton. Drives headless Edge against a local static server (11-serve.mjs,
// port 8787) and audits, at 375px and 320px:
//  - the map page hosts a full-width word input in the sticky header
//  - submitting a word shows the progressive skeleton and lights its layer
//    bands bottom-up (foundation first) while the request is in flight
//  - fulfilling the init turn lands the reality tree ON the map (Reality tab
//    active, root card present) without visiting chat, and the skeleton hides
//  - no horizontal overflow at any point (input, skeleton, tree)
//
// The /api/agent request is intercepted and fulfilled with the laptop
// fixture reality map, so the run needs no backend and no API key.
//
// Usage: node .scratch/first-principled-v3/research/11-cdp-probe.mjs
const { spawn } = await import("node:child_process");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
import http from "node:http";

import { laptopRealityMap } from "../../../src/lib/mmg/fixtures.js";

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

/** A valid init-turn response: the fixture reality map plus an opening turn. */
const initResponse = {
  reply: "What have you noticed about electricity?",
  learnerMap: { nodes: [], edges: [] },
  diff: { added: [], flipped: [], updated: [] },
  phase: "active",
  failedAttempts: {},
  realityMap: laptopRealityMap,
};

const run = async () => {
  // Static server for src/.
  const server = spawn(process.execPath, [".scratch/first-principled-v3/research/11-serve.mjs"]);
  await new Promise((r) => setTimeout(r, 800));

  const { child, port } = await launch();
  const page = await connect(port);
  await page.call("Page.enable", {});
  await page.call("Runtime.enable", {});

  // Intercept the generation call; non-api requests flow through. Match the
  // endpoint exactly - "/api/agent" - not the agent.js module script.
  let pendingApi = null;
  page.events["Fetch.requestPaused"] = (params) => {
    const url = params.request.url;
    if (url.endsWith("/api/agent")) {
      pendingApi = params.requestId;
    } else {
      page.call("Fetch.continueRequest", { requestId: params.requestId }).catch(() => {});
    }
  };
  await page.call("Fetch.enable", { patterns: [{ urlPattern: "*" }] });

  await page.call("Page.navigate", { url: "https://first-principled.netlify.app/" });
  await new Promise((r) => setTimeout(r, 1500));

  async function waitForHeader() {
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      const ok = await evaluate(
        page,
        `!!document.querySelector(".map-header")`
      );
      if (ok) return true;
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  }

  async function auditViewport(width, height) {
    await page.call("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: true,
    });
    pendingApi = null;
    await page.call("Page.reload", {});
    const booted = await waitForHeader();
    check(`[${width}px] map page boots after reload`, booted);
    if (!booted) return;

    const initial = await evaluate(page, `(() => {
      const entry = document.querySelector(".map-entry");
      const input = document.querySelector(".map-entry-input");
      const button = document.querySelector(".map-entry-button");
      const er = entry ? entry.getBoundingClientRect() : null;
      const hasStartForm = !!document.querySelector("#start-form");
      return {
        hasEntry: !!entry,
        hasInput: !!input,
        hasButton: !!button,
        entryWidth: er ? Math.round(er.width) : null,
        entryLeft: er ? Math.round(er.left) : null,
        vw: document.documentElement.clientWidth,
        docScrollWidth: document.documentElement.scrollWidth,
        headerSticky: getComputedStyle(document.querySelector(".map-header")).position,
        chatHasStartForm: hasStartForm,
      };
    })()`);

    check(`[${width}px] word input in the map header`, initial.hasEntry && initial.hasInput && initial.hasButton);
    check(
      `[${width}px] input full-width (${initial.entryWidth} of ${initial.vw})`,
      initial.hasEntry &&
        initial.entryWidth !== null &&
        initial.entryWidth >= initial.vw - 48 &&
        initial.entryLeft !== null &&
        initial.entryLeft >= 0
    );
    check(`[${width}px] header sticky`, initial.headerSticky === "sticky");
    check(
      `[${width}px] no overflow with input`,
      initial.docScrollWidth <= initial.vw,
      `scrollWidth ${initial.docScrollWidth} vw ${initial.vw}`
    );

    // Submit a word; the intercepted /api/agent request stays paused, so the
    // skeleton must be up.
    await evaluate(page, `(() => {
      const input = document.querySelector(".map-entry-input");
      input.value = "laptop";
      document.querySelector(".map-entry").requestSubmit();
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 600));

    const early = await evaluate(page, `(() => {
      const sk = document.querySelector(".tree-skeleton");
      return {
        visible: sk ? !sk.hidden : false,
        lit: sk ? document.querySelectorAll(".tree-skeleton .sk-layer.lit").length : -1,
        total: sk ? document.querySelectorAll(".tree-skeleton .sk-layer").length : 0,
        caption: sk ? (sk.querySelector(".sk-caption")?.textContent ?? "") : "",
        docScrollWidth: document.documentElement.scrollWidth,
        vw: document.documentElement.clientWidth,
      };
    })()`);
    check(`[${width}px] skeleton visible during generation`, early.visible, early.caption);
    check(
      `[${width}px] skeleton reveals progressively (not all lit)`,
      early.visible && early.lit < early.total,
      `lit ${early.lit}/${early.total}`
    );
    check(
      `[${width}px] no overflow with skeleton`,
      early.docScrollWidth <= early.vw,
      `scrollWidth ${early.docScrollWidth} vw ${early.vw}`
    );

    // One reveal step later the foundation (last) band lights first.
    await new Promise((r) => setTimeout(r, 3700));
    const mid = await evaluate(page, `(() => {
      const sk = document.querySelector(".tree-skeleton");
      const layers = [...document.querySelectorAll(".tree-skeleton .sk-layer")];
      return {
        lit: sk ? document.querySelectorAll(".tree-skeleton .sk-layer.lit").length : -1,
        total: layers.length,
        foundationLit: layers.length > 0 ? layers[layers.length - 1].classList.contains("lit") : false,
        crownLit: layers.length > 0 ? layers[0].classList.contains("lit") : false,
      };
    })()`);
    check(
      `[${width}px] skeleton lights bottom-up (foundation first)`,
      mid.lit >= 1 && mid.foundationLit && !mid.crownLit,
      `lit ${mid.lit}/${mid.total} foundation ${mid.foundationLit} crown ${mid.crownLit}`
    );

    // Fulfill the generation with the fixture map; the tree must land on the
    // map without visiting chat, and the skeleton must go away.
    if (pendingApi === null) {
      check(`[${width}px] generation request was made`, false, "no paused request");
      return;
    }
    await page.call("Fetch.fulfillRequest", {
      requestId: pendingApi,
      responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      body: Buffer.from(JSON.stringify(initResponse)).toString("base64"),
    });
    pendingApi = null;
    await new Promise((r) => setTimeout(r, 1200));

    const landed = await evaluate(page, `(() => {
      const root = document.querySelector(".tree-root-card");
      const realityTab = document.querySelector('.seg-item[data-tab="reality"]');
      const sk = document.querySelector(".tree-skeleton");
      return {
        hasRoot: !!root,
        rootWord: root?.querySelector(".tree-root-word")?.textContent ?? null,
        realityActive: realityTab ? realityTab.classList.contains("active") : false,
        skeletonHidden: sk ? sk.hidden : true,
        onMap: location.hash === "" || location.hash === "#map",
        docScrollWidth: document.documentElement.scrollWidth,
        vw: document.documentElement.clientWidth,
      };
    })()`);
    check(
      `[${width}px] generated tree lands on the map`,
      landed.hasRoot && landed.realityActive && landed.onMap,
      `root ${landed.rootWord} reality ${landed.realityActive} onMap ${landed.onMap}`
    );
    check(`[${width}px] skeleton hides when the tree renders`, landed.skeletonHidden);
    check(
      `[${width}px] no overflow with tree`,
      landed.docScrollWidth <= landed.vw,
      `scrollWidth ${landed.docScrollWidth} vw ${landed.vw}`
    );
  }

  await auditViewport(375, 667);
  await auditViewport(320, 568);

  // The dock (on the map page) is follow-up-only: no composer until a tree
  // exists, and the composer appears once one does.
  await page.call("Emulation.setDeviceMetricsOverride", {
    width: 375,
    height: 667,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await page.call("Page.reload", {});
  const dockBooted = await waitForHeader();
  check("[375px] map boots for the dock check", dockBooted);
  await new Promise((r) => setTimeout(r, 600));
  const dockEmpty = await evaluate(page, `(() => {
    const composer = document.querySelector(".dock-composer");
    const hint = document.querySelector(".dock-start");
    return {
      composerHidden: composer ? composer.hidden : true,
      hintText: hint ? hint.textContent.replace(/\\s+/g, " ").trim() : "",
    };
  })()`);
  check("dock hides its composer when there is no tree", dockEmpty.composerHidden, dockEmpty.hintText);

  // Fulfill one generation so the dock has a tree to answer about.
  await evaluate(page, `(() => {
    document.querySelector(".map-entry-input").value = "laptop";
    document.querySelector(".map-entry").requestSubmit();
    return true;
  })()`);
  await new Promise((r) => setTimeout(r, 600));
  if (pendingApi !== null) {
    await page.call("Fetch.fulfillRequest", {
      requestId: pendingApi,
      responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      body: Buffer.from(JSON.stringify(initResponse)).toString("base64"),
    });
    pendingApi = null;
  }
  await new Promise((r) => setTimeout(r, 1200));
  const dockLive = await evaluate(page, `(() => {
    const composer = document.querySelector(".dock-composer");
    const hint = document.querySelector(".dock-start");
    return { composerHidden: composer ? composer.hidden : true, hintHidden: hint ? hint.hidden : true };
  })()`);
  check("dock shows its composer once a tree exists", !dockLive.composerHidden && dockLive.hintHidden);

  // Chat is follow-up-only: no start form anywhere in the document.
  const chatCheck = await evaluate(page, `(() => {
    document.querySelector(".chat-seg .seg-item[data-tab='chat']")?.click();
    return true;
  })()`);
  await new Promise((r) => setTimeout(r, 600));
  const chat = await evaluate(page, `(() => {
    const panel = document.querySelector("#start-panel");
    const noForm = !document.querySelector("#start-form, #word-input");
    return {
      panelText: panel ? panel.textContent.replace(/\\s+/g, " ").trim() : "",
      noForm,
      composerHidden: document.querySelector("#composer")?.hidden ?? true,
    };
  })()`);
  check("chat has no start form", chat.noForm);
  check("chat points to the map when no session", /Map page/.test(chat.panelText), chat.panelText);

  server.kill();
  child.kill();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((e) => {
  console.error("PROBE ERROR:", e.message);
  process.exit(1);
});
