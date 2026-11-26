const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  os = require("node:os"),
  path = require("node:path");
const A = require("../admin/core.js"),
  { createAdminServer } = require("../admin/server.cjs");
const { IDBFactory } = require("fake-indexeddb"),
  { create } = require("../progress-store.js");
const fixture = () => ({
  format: "myCello-admin",
  version: 1,
  entries: [
    { id: "apple", hanzi: "苹果", pinyin: "píngguǒ", meaning_en: "apple" },
    { id: "rest", hanzi: "休", pinyin: "xiū", meaning_en: "rest" },
  ],
  research: [],
  components: [],
  cards: [
    {
      id: "card",
      entry_id: "apple",
      subject_text: "苹果",
      storage_bucket: "man_vocabularyCard",
      vocabulary_card_path: "apple_ping2-guo3.png",
      review_status: "approved",
    },
  ],
  buckets: [],
  objects: [
    { bucket_id: "man_vocabularyCard", name: "apple_ping2guo3.png" },
    { bucket_id: "man_vocabularyCard", name: "rest_xiu1.png" },
    { bucket_id: "man_vocabularyCard", name: ".emptyFolderPlaceholder" },
    { bucket_id: "man_vocabularyCard", name: "mystery_xiang1.png" },
  ],
});
test("search matches marked, numbered, spaced and compact pinyin plus Hanzi and English", () => {
  for (const q of [
    "苹果",
    "apple",
    "píngguǒ",
    "ping2-guo3",
    "ping guo",
    "ping2guo3",
  ])
    assert.equal(A.search(fixture().entries, q)[0].id, "apple");
  assert.equal(A.numbered("píngguǒ"), "ping2-guo3");
  assert.equal(A.filename("strawberry", "cǎoméi"), "strawberry_cao3-mei2.png");
  assert.equal(A.filename("green", "lǜ"), "green_lv4.png");
  assert.throws(() => A.filename("to be", "shì"));
});
test("reconciliation repairs compact path, links exact sense, preserves approval and leaves unknowns alone", () => {
  const s = fixture(),
    { next, changed } = A.applyMatches(s, () => "new-card");
  assert.equal(changed, 2);
  assert.equal(next.cards[0].review_status, "approved");
  assert.equal(next.cards[0].vocabulary_card_path, "apple_ping2guo3.png");
  assert.equal(next.cards[1].review_status, "pending");
  assert.equal(next.cards[1].entry_id, "rest");
  assert.equal(s.cards.length, 1);
  assert.equal(A.applyMatches(next).changed, 0);
  assert.equal(
    A.reconcile(next).find((r) => r.path.startsWith("mystery")).status,
    "needs review",
  );
});
test("ambiguous reading and sense never link automatically", () => {
  const s = fixture();
  s.entries.push({ ...s.entries[1], id: "other" });
  assert.equal(
    A.reconcile(s).find((r) => r.path === "rest_xiu1.png").status,
    "ambiguous",
  );
  assert.equal(
    A.applyMatches(s).next.cards.filter((c) => c.entry_id === "rest").length,
    0,
  );
});
test("card generation refuses missing verification, sources, component roles or illustration; renders complete escaped card", () => {
  const s = fixture();
  assert.throws(() => A.renderCard(s, "apple"), /Verified history/);
  s.research.push({
    entry_id: "apple",
    verification_status: "verified",
    verified_origin_en: "A sourced account <test>",
    sources: ["Reference"],
  });
  s.entries[0].mnemonic = "Invented apple scene";
  s.entries[0].illustration = "data:image/png;base64,aGVsbG8=";
  s.components.push({
    id: "component",
    entry_id: "apple",
    component_entry_id: "rest",
    position: 1,
  });
  assert.throws(() => A.renderCard(s, "apple"), /component/);
  Object.assign(s.components[0], {
    role: "visual_mnemonic",
    verification_status: "verified",
  });
  const svg = A.renderCard(s, "apple");
  assert.match(svg, /History — verified/);
  assert.match(svg, /Mnemonic — invented/);
  assert.match(svg, /&lt;test&gt;/);
  assert.match(svg, /píngguǒ/);
});
test("local server persists complete transactions, refuses stale edits and cross-origin writes, retains original backup", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mycello-admin-")),
    file = path.join(dir, "dictionary.json");
  const original = JSON.stringify(fixture());
  await fs.writeFile(file, original);
  const server = createAdminServer(dir);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const read = await fetch(base + "/api/data"),
      tag = read.headers.get("etag"),
      next = fixture();
    next.entries[0].meaning_en = "changed";
    const write = await fetch(base + "/api/data", {
      method: "PUT",
      headers: { "If-Match": tag },
      body: JSON.stringify(next),
    });
    assert.equal(write.status, 200);
    assert.equal(
      JSON.parse(await fs.readFile(file, "utf8")).entries[0].meaning_en,
      "changed",
    );
    assert.equal(
      await fs.readFile(path.join(dir, "original-backup.json"), "utf8"),
      original,
    );
    assert.equal(
      (
        await fetch(base + "/api/data", {
          method: "PUT",
          headers: { "If-Match": tag },
          body: JSON.stringify(fixture()),
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await fetch(base + "/api/data", {
          method: "PUT",
          headers: { Origin: "https://evil.test" },
          body: original,
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetch(base + "/admin/.data/dictionary.json")).status,
      404,
    );
    const bad = fixture();
    bad.components.push({ entry_id: "apple", component_entry_id: "missing" });
    const latest = await fetch(base + "/api/data");
    assert.equal(
      (
        await fetch(base + "/api/data", {
          method: "PUT",
          headers: { "If-Match": latest.headers.get("etag") },
          body: JSON.stringify(bad),
        })
      ).status,
      400,
    );
  } finally {
    await new Promise((r) => server.close(r));
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("IndexedDB retains SRS and lesson passes across store instances and serializes writes", async () => {
  const indexedDB = new IDBFactory(),
    a = create(indexedDB),
    state = {
      entries: [{ id: "a" }],
      reviews: { a: { streak: 2, next: 123 } },
      lessonPractice: { a: { passes: 2 } },
    };
  const first = a.write(state);
  state.reviews.a.streak = 3;
  state.lessonPractice.a.passes = 3;
  const second = a.write(state);
  await Promise.all([first, second]);
  const restored = await create(indexedDB).read();
  assert.equal(restored.database.reviews.a.streak, 3);
  assert.equal(restored.database.lessonPractice.a.passes, 3);
});
test("administration UI searches, blocks incomplete cards, persists drafts and requires an explicit approval click", async () => {
  const { JSDOM } = require("jsdom"),
    vm = require("node:vm");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mycello-studio-")),
    s = fixture();
  Object.assign(s.entries[0], {
    mnemonic: "Invented scene",
    filenameMeaning: "apple",
    illustration:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
  });
  s.research.push({
    entry_id: "apple",
    verification_status: "verified",
    verified_origin_en: "Test-only verified-history fixture",
    sources: ["Test-only reference"],
  });
  await fs.writeFile(path.join(dir, "dictionary.json"), JSON.stringify(s));
  const server = createAdminServer(dir);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}`;
  let dom;
  try {
    dom = new JSDOM(
      await fs.readFile(path.join(__dirname, "../admin/index.html"), "utf8"),
      { url, runScripts: "outside-only" },
    );
    const w = dom.window;
    w.structuredClone = structuredClone;
    w.fetch = (u, o) => fetch(new URL(u, url), o);
    w.URL.createObjectURL = () => "blob:preview";
    w.URL.revokeObjectURL = () => {};
    const run = (c) => vm.runInContext(c, dom.getInternalVMContext());
    run(await fs.readFile(path.join(__dirname, "../admin/core.js"), "utf8"));
    run(await fs.readFile(path.join(__dirname, "../admin/app.js"), "utf8"));
    const until = async (check) => {
      for (let i = 0; i < 100; i++) {
        if (check()) return;
        await new Promise((r) => setTimeout(r, 10));
      }
      throw Error("UI update timed out");
    };
    await until(() => w.document.getElementById("search"));
    const q = w.document.getElementById("search");
    q.value = "ping2guo3";
    q.dispatchEvent(new w.Event("input"));
    assert.equal(w.document.querySelectorAll("tbody tr").length, 1);
    w.document.querySelector("#openStudio").click();
    w.document.querySelector("#generate").click();
    await until(() => !w.document.querySelector("#approve").disabled);
    let saved = JSON.parse(
      await fs.readFile(path.join(dir, "dictionary.json"), "utf8"),
    );
    assert.equal(saved.cards.at(-1).review_status, "pending");
    w.document.querySelector("#approve").click();
    await until(() =>
      w.document
        .querySelector("#cardErrors")
        .textContent.includes("Approved by you"),
    );
    saved = JSON.parse(
      await fs.readFile(path.join(dir, "dictionary.json"), "utf8"),
    );
    assert.equal(saved.cards.at(-1).review_status, "approved");
    w.document.querySelector('[data-page="words"]').click();
    const reset = w.document.querySelector("#search");
    reset.value = "";
    reset.dispatchEvent(new w.Event("input"));
    w.document.querySelector('[data-word="rest"]').click();
    w.document.querySelector("#openStudio").click();
    w.document.querySelector("#generate").click();
    await until(() =>
      w.document
        .querySelector("#cardErrors")
        .textContent.includes("Verified history"),
    );
    assert.equal(w.document.querySelector("#approve").disabled, true);
  } finally {
    dom?.window.close();
    await new Promise((r) => server.close(r));
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("actual learning app restores IndexedDB when compatibility JSON is absent and persists grading", async () => {
  const { JSDOM } = require("jsdom"),
    vm = require("node:vm");
  const indexedDB = new IDBFactory();
  const state = {
    entries: [
      {
        id: "saved",
        simplified: "木",
        pinyin: "mù",
        meaning: "wood",
        srsEligible: true,
      },
    ],
    lessons: [],
    examples: [],
    palace: {},
    reviews: { saved: { next: 1, streak: 2, interval: 1, strength: 2.5 } },
  };
  await create(indexedDB).write(state);
  const html = (
    await fs.readFile(path.join(__dirname, "../index.html"), "utf8")
  ).replace(/<script[^>]*src=[^>]*><\/script>/g, "");
  const dom = new JSDOM(html, {
      url: "https://learning.test/",
      runScripts: "outside-only",
    }),
    w = dom.window;
  w.indexedDB = indexedDB;
  w.fetch = async () => ({ ok: false });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  const run = (c) => vm.runInContext(c, dom.getInternalVMContext());
  try {
    for (const f of ["capture-core.js", "admin/core.js", "progress-store.js"])
      run(await fs.readFile(path.join(__dirname, "..", f), "utf8"));
    run(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
    run(await fs.readFile(path.join(__dirname, "../capture.js"), "utf8"));
    await run("learningReady");
    assert.equal(run("db.entries[0].id"), "saved");
    run("grade('saved',true)");
    await run("learningStore.flush()");
    assert.equal(
      (await create(indexedDB).read()).database.reviews.saved.streak,
      3,
    );
    const before = run("JSON.stringify(db.reviews)");
    run(
      "captureImportBundle({format:'myCello-vocabulary-bundle',version:1,entries:[{id:'new',simplified:'林',pinyin:'lín',meaning:'woods'}],lessons:[{id:'book',title:'Test',items:['new']}]})",
    );
    assert.equal(run("JSON.stringify(db.reviews)"), before);
    assert.equal(run("entry('new').srsEligible"), false);
    run(
      "captureImportBundle({format:'myCello-vocabulary-bundle',version:1,entries:[{id:'new',simplified:'林',pinyin:'lín',meaning:'woods'}],lessons:[{id:'book',title:'Test',items:['new']}]})",
    );
    assert.equal(run("db.entries.filter(e=>e.id==='new').length"), 1);
  } finally {
    await run("learningStore.flush()");
    dom.window.close();
  }
});
test("matching preserves tones even when search ignores them", () => {
  const s = fixture();
  s.objects = [{ bucket_id: "man_vocabularyCard", name: "rest_xiu4.png" }];
  assert.equal(A.reconcile(s)[0].status, "needs review");
});
