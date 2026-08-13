import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve("src");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };
http.createServer((req, res) => {
  let p = req.url.split("?")[0];
  if (p === "/" || p === "") p = "/index.html";
  const f = path.join(root, p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end("nf"); return; }
    res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" });
    res.end(d);
  });
}).listen(8787, () => console.log("serving"));
