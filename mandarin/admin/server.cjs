"use strict";
const http = require("node:http"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const Core = require("./core.js");
const ROOT = path.resolve(__dirname, "..");
function createAdminServer(dataDir = path.join(__dirname, ".data")) {
  const file = path.join(dataDir, "dictionary.json");
  let queue = Promise.resolve();
  const read = async () =>
    Core.validate(JSON.parse(await fs.readFile(file, "utf8")));
  const etag = (raw) => crypto.createHash("sha256").update(raw).digest("hex");
  async function write(next, expected) {
    const before = await fs.readFile(file, "utf8");
    if (etag(before) !== expected)
      throw Object.assign(
        Error("Data changed in another window. Reload before saving."),
        { status: 409 },
      );
    await fs
      .copyFile(
        file,
        path.join(dataDir, "original-backup.json"),
        fs.constants.COPYFILE_EXCL,
      )
      .catch((e) => {
        if (e.code !== "EEXIST") throw e;
      });
    const raw = JSON.stringify(Core.validate(next), null, 2);
    await fs.writeFile(file + ".tmp", raw, { mode: 0o600 });
    await fs.rename(file + ".tmp", file);
    return etag(raw);
  }
  return http.createServer(async (req, res) => {
    const fail = (code, msg) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: msg }));
    };
    const host = req.headers.host;
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host || ""))
      return fail(403, "Local access only.");
    if (req.headers.origin && req.headers.origin !== `http://${host}`)
      return fail(403, "Same-origin access required.");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      const url = new URL(req.url, `http://${host}`);
      if (url.pathname === "/api/data" && req.method === "GET") {
        const raw = await fs.readFile(file, "utf8");
        Core.validate(JSON.parse(raw));
        res.setHeader("Content-Type", "application/json");
        res.setHeader("ETag", etag(raw));
        return res.end(raw);
      }
      if (url.pathname === "/api/data" && req.method === "PUT") {
        let size = 0,
          chunks = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 32 * 1024 * 1024)
            return fail(413, "Backup exceeds 32 MB.");
          chunks.push(chunk);
        }
        const next = Core.validate(
          JSON.parse(Buffer.concat(chunks).toString()),
        );
        const operation = queue.then(() =>
          write(next, req.headers["if-match"]),
        );
        queue = operation.catch(() => {});
        const tag = await operation;
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ saved: true, etag: tag }));
      }
      if (url.pathname === "/api/backup" && req.method === "GET") {
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="myCello-admin-backup.json"',
        );
        return res.end(JSON.stringify(await read(), null, 2));
      }
      if (req.method !== "GET") return fail(405, "Method not allowed.");
      const requested =
        url.pathname === "/"
          ? "/admin/index.html"
          : decodeURIComponent(url.pathname);
      const target = path.resolve(ROOT, "." + requested);
      if (
        !target.startsWith(ROOT + path.sep) ||
        requested.split("/").some((x) => x.startsWith(".")) ||
        ![".html", ".css", ".js", ".svg"].includes(path.extname(target))
      )
        return fail(404, "Not found.");
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".svg": "image/svg+xml",
        }[path.extname(target)],
      );
      res.end(await fs.readFile(target));
    } catch (e) {
      fail(
        e.status || (e.code === "ENOENT" ? 404 : 400),
        e.code === "ENOENT"
          ? "Local dictionary not installed. Put your administration backup in mandarin/admin/.data/dictionary.json."
          : e.message,
      );
    }
  });
}
if (require.main === module) {
  const port = Number(process.env.MYCELLO_ADMIN_PORT || 8765);
  createAdminServer().listen(port, "127.0.0.1", () =>
    console.log(`Administration: http://127.0.0.1:${port}/ — local data only`),
  );
}
module.exports = { createAdminServer };
