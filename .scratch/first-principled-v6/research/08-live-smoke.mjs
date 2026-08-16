// CDP live smoke for v6 ticket 08 against the unique deploy URL.
// Prints no secrets. Screenshots land next to this file.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const LIVE = process.argv[2] || "https://first-principled.netlify.app/";

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

  const chrome = await evaluate(
    page,
    `(() => {
      const buttons = [...document.querySelectorAll("button, a, [role='tab']")].map((n) => n.textContent.trim());
      const input = document.querySelector(".map-entry-input");
      const empty = document.querySelector(".map-empty-invite");
      const dock = document.querySelector(".map-dock-wrap");
      const sheet = document.getElementById("tutor-sheet");
      return {
        buttons,
        hasAsk: buttons.includes("Ask"),
        hasChat: buttons.includes("Chat"),
        hasMapTab: buttons.includes("Map"),
        hasReality: buttons.includes("Reality"),
        hasTutor: buttons.includes("Tutor") || !!document.querySelector(".tutor-toggle"),
        hasHow: buttons.includes("How it works"),
        placeholder: input ? input.getAttribute("placeholder") : null,
        emptyLine: empty ? empty.textContent.trim() : null,
        dockPresent: !!dock,
        sheetPresent: !!sheet,
      };
    })()`
  );

  check("375px live page loads", true);
  check(
    "no Ask / Chat / Map / Reality / Tutor chrome",
    !chrome.hasAsk && !chrome.hasChat && !chrome.hasMapTab && !chrome.hasReality && !chrome.hasTutor,
    JSON.stringify(chrome.buttons)
  );
  check("How it works is in the header", chrome.hasHow);
  check(
    "foundations word box",
    chrome.placeholder === "A thing in reality (laptop, photosynthesis)",
    String(chrome.placeholder)
  );
  check(
    "empty-Tree sentence",
    chrome.emptyLine === "Type the thing you want to understand from its foundations.",
    String(chrome.emptyLine)
  );
  check("Tutor sheet unmounted", chrome.dockPresent === false && chrome.sheetPresent === false);
  await shot(page, "08-375-empty.png");

  await evaluate(page, `document.querySelector(".how-link").click()`);
  await new Promise((r) => setTimeout(r, 400));
  const how = await evaluate(
    page,
    `(() => {
      const pageEl = document.querySelector(".how-page");
      const paras = pageEl ? [...pageEl.querySelectorAll("p")].map((p) => p.textContent.trim()) : [];
      return {
        visible: pageEl && pageEl.hidden === false,
        title: pageEl ? pageEl.querySelector("h1")?.textContent : null,
        paras,
      };
    })()`
  );
  check("How it works page opens", how.visible === true && how.title === "How it works");
  check(
    "How it works locked copy",
    how.paras[0] === "This is not designed to replace reading." &&
      /relationships between layers/.test(how.paras[1] || "") &&
      /rabbit holes/.test(how.paras[2] || ""),
    JSON.stringify(how.paras)
  );
  await shot(page, "08-375-how.png");

  await page.call("Page.navigate", { url: `${LIVE.replace(/\/?$/, "/")}?demo=1` });
  await waitLoad(page);
  await evaluate(
    page,
    `new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const cards = document.querySelectorAll(".tree-branch-card, .tree-root-card");
        if (cards.length > 0 || Date.now() - start > 5000) resolve(cards.length);
        else requestAnimationFrame(tick);
      };
      tick();
    })`
  );

  const tree = await evaluate(
    page,
    `(() => {
      const cards = [...document.querySelectorAll(".tree-branch-card, .tree-root-card")];
      return {
        cardCount: cards.length,
        hasRoot: !!document.querySelector(".tree-root-card"),
        hasTutor: !!document.querySelector(".tutor-toggle") ||
          [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Tutor"),
      };
    })()`
  );
  check("demo Tree lands", tree.hasRoot && tree.cardCount > 0, `cards ${tree.cardCount}`);
  check("Tutor still absent after Tree", tree.hasTutor === false);
  await shot(page, "08-375-tree.png");

  await evaluate(
    page,
    `(() => {
      const card = document.querySelector(".tree-branch-card") || document.querySelector(".tree-root-card");
      if (card) card.click();
      return true;
    })()`
  );
  await new Promise((r) => setTimeout(r, 400));
  const panel = await evaluate(
    page,
    `(() => {
      const panelEl = document.querySelector(".node-panel");
      const body = panelEl ? panelEl.innerText : "";
      return {
        open: panelEl && panelEl.hidden === false,
        invite: document.querySelector(".node-panel-invite")?.textContent || "",
        hasLearnerChange: /How your model changed/.test(body),
        hasYourWords: /Your words/.test(body),
        hasNotEngaged: /You haven't engaged this node yet/.test(body),
        hasBuildFrom: /Build from this node/.test(body),
        bodyHead: body.slice(0, 240).replace(/\\s+/g, " "),
      };
    })()`
  );
  check("node panel opens", panel.open === true, panel.bodyHead);
  check(
    "invitation card, no learner-state chrome",
    /rabbit hole/.test(panel.invite) &&
      !panel.hasLearnerChange &&
      !panel.hasYourWords &&
      !panel.hasNotEngaged &&
      !panel.hasBuildFrom,
    panel.invite.slice(0, 120)
  );
  await shot(page, "08-375-panel.png");

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\\n${results.length - failed}/${results.length} checks passed`);
  child.kill();
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((e) => {
  console.error("PROBE ERROR:", e.message);
  process.exit(1);
});
