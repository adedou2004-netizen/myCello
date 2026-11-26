"use strict";
const http = require("node:http"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const Core = require("./core.js");
const ROOT = path.resolve(__dirname, "..");
const BUCKET = "man_vocabularyCard";
const STORAGE = "https://dbqrenlvinqheyjppxby.supabase.co/storage/v1";
function storageHeaders() {
 const key = process.env.MYCELLO_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
 if (!key) throw Error("Supabase connection not configured. Set MYCELLO_SUPABASE_KEY on the local server.");
 return {apikey:key, ...(key.startsWith("eyJ") ? {Authorization:"Bearer " + key} : {})};
}
async function storageRequest(route, options = {}) {
 const response = await fetch(STORAGE + route, {...options, headers:{...storageHeaders(), ...options.headers}, redirect:"error", signal:AbortSignal.timeout(20000)});
 if (!response.ok) throw Error("Supabase Storage request failed (HTTP " + response.status + "). Check local credentials and permissions.");
 return response;
}
async function listCardObjects() {
 const objects = [];
 for(let offset=0;;offset+=100) {
 const batch = await (await storageRequest("/object/list/" + BUCKET,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prefix:"",limit:100,offset,sortBy:{column:"name",order:"asc"}})})).json();
 if (!Array.isArray(batch)) throw Error("Invalid storage inventory.");
 objects.push(...batch.filter(x => x.id && /\\.(png|webp|jpe?g)$/i.test(x.name)).map(x=>({bucket_id:BUCKET,name:x.name})));
 if(batch.length<100) return objects;
 }
}
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
      if (url.pathname === "/api/sync-cards" && req.method === "POST") {
        const objects = await listCardObjects();
        const operation = queue.then(async () => {
          const raw = await fs.readFile(file,"utf8"), snapshot = Core.validate(JSON.parse(raw));
          snapshot.objects = snapshot.objects.filter(o=>o.bucket_id !== BUCKET).concat(objects);
          const result = Core.applyMatches(snapshot);
          const tag = await write(result.next, etag(raw));
          return {etag:tag, data:result.next, changed:result.changed, report:Core.reconcile(result.next), objects:objects.length};
        });
        queue = operation.catch(()=>{});
        const result = await operation;
        res.setHeader("Content-Type","application/json");
        return res.end(JSON.stringify(result));
      }
      if (url.pathname === "/api/card-image" && req.method === "GET") {
        const snapshot = await read();
        const card = snapshot.cards.find(c => c.id === url.searchParams.get("id"));
        if (!card) return fail(404, "Card record not found.");
        const objectPath = card.vocabulary_card_path || "";
        const parts = objectPath.split("/");
        const ext = path.extname(objectPath).toLowerCase();
        const types = { ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };
        if (!types[ext] || parts.some(p => !p || p === "." || p === ".." || p.includes("\\"))) return fail(404, "No supported image path.");
        const imageRoot = path.resolve(dataDir, "cards");
        const local = path.resolve(imageRoot, ...parts);
        if (!local.startsWith(imageRoot + path.sep)) return fail(404, "Invalid card path.");
        try {
          const actual = await fs.realpath(local);
          if (!actual.startsWith(await fs.realpath(imageRoot) + path.sep)) return fail(404, "Invalid local image path.");
          const bytes = await fs.readFile(actual);
          res.setHeader("Content-Type", types[ext]);
          return res.end(bytes);
        } catch (e) { if (e.code !== "ENOENT") throw e; }
        if (card.storage_bucket !== BUCKET) return fail(404, "Image not available locally.");
        const remote = await storageRequest("/object/authenticated/" + BUCKET + "/" + parts.map(encodeURIComponent).join("/"));
        const bytes = Buffer.from(await remote.arrayBuffer());
        if (bytes.length > 20 * 1024 * 1024) return fail(413,"Card image too large.");
        res.setHeader("Content-Type",types[ext]);
        return res.end(bytes);
      }
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
