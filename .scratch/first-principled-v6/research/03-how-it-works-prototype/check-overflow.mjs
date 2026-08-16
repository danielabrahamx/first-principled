/**
 * Viewport overflow check for the how-it-works prototype.
 * Loads each variant at 320 and 375 and fails if scrollWidth > innerWidth.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4174);
const require = createRequire(import.meta.url);

function findBrowser() {
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function loadPuppeteer() {
  try {
    return require("puppeteer-core");
  } catch {
    return null;
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(dir, "serve.mjs")], {
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => reject(new Error("serve start timeout")), 8000);
    const onData = (buf) => {
      if (String(buf).includes("http://")) {
        clearTimeout(timer);
        child.stdout.off("data", onData);
        resolve(child);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", (buf) => process.stderr.write(buf));
    child.on("exit", (code) => reject(new Error("serve exited " + code)));
  });
}

function sourceScan() {
  const js = fs.readFileSync(path.join(dir, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  const css = fs.readFileSync(path.join(dir, "styles.css"), "utf8");
  const blob = html + "\n" + js + "\n" + css;
  const problems = [];
  if (/\bTutor\b/.test(blob)) problems.push("source contains Tutor");
  if (/atomic facts|atomic principles/i.test(blob)) {
    problems.push("source contains atomic-facts language");
  }
  const required = [
    "A thing in reality (laptop, photosynthesis)",
    "Type the thing you want to understand from its foundations.",
    "How it works",
    "not designed to replace reading",
    "relationships between layers",
    "rabbit holes",
  ];
  for (const s of required) {
    if (!blob.includes(s)) problems.push("missing copy: " + s);
  }
  return problems;
}

const sourceProblems = sourceScan();
if (sourceProblems.length) {
  console.error(sourceProblems.join("\n"));
  process.exit(1);
}
console.log("source scan: locked copy present, no Tutor, no atomic-facts language");

const puppeteer = loadPuppeteer();
const browserPath = findBrowser();
if (!puppeteer || !browserPath) {
  console.log(
    "layout check skipped (need puppeteer-core + Edge/Chrome). source scan passed."
  );
  process.exit(0);
}

const server = await startServer();
const browser = await puppeteer.launch({
  executablePath: browserPath,
  headless: true,
  args: ["--disable-gpu"],
});

const failures = [];
try {
  for (const width of [320, 375]) {
    for (const variant of ["A", "B", "C"]) {
      for (const hash of ["", "#how"]) {
        const page = await browser.newPage();
        await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
        const url = `http://127.0.0.1:${port}/?variant=${variant}${hash}`;
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
        const metrics = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          bodyText: document.body.innerText,
        }));
        await page.close();
        if (metrics.scrollWidth > metrics.innerWidth + 1) {
          failures.push(
            `${width}px ${variant}${hash || "#tree"} overflow ${metrics.scrollWidth}>${metrics.innerWidth}`
          );
        }
        if (/\bTutor\b/.test(metrics.bodyText)) {
          failures.push(`${width}px ${variant}${hash || "#tree"} shows Tutor`);
        }
      }
    }
  }
} finally {
  await browser.close();
  server.kill();
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("layout check: 320 and 375, variants A-C, tree and how pages: no overflow");
