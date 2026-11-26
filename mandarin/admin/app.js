"use strict";
const A = AdminCore,
  $ = (id) => document.getElementById(id),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let data,
  tag,
  page = "words",
  selected = null,
  filter = "",
  query = "",
  checked = new Set(),
  previewURL = null;
function message(s, error = false) {
  $("message").textContent = s;
  $("message").className = error ? "error" : "";
}
async function load() {
  const r = await fetch("/api/data");
  if (!r.ok) throw Error((await r.json()).error);
  data = A.validate(await r.json());
  tag = r.headers.get("ETag");
  selected = data.entries[0]?.id;
  render();
  message(`${data.entries.length} words loaded · saved on this computer.`);
}
async function commit(next) {
  const r = await fetch("/api/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "If-Match": tag },
      body: JSON.stringify(next),
    }),
    result = await r.json();
  if (!r.ok) throw Error(result.error);
  tag = result.etag;
  data = next;
  message("Saved on this computer.");
}
const act = (fn) => async () => {
  try {
    await fn();
  } catch (e) {
    message(e.message, true);
  }
};
function download(text, name, type = "application/json") {
  const u = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function cardsFor(id) {
  return data.cards.filter((c) => c.entry_id === id);
}
function cardStatus(id) {
  const cards = cardsFor(id);
  return cards.some((c) => c.review_status === "approved")
    ? "Approved"
    : cards.length
      ? "Draft"
      : "Missing";
}
function setPage(p) {
  page = p;
  render();
}
function render() {
  document
    .querySelectorAll("[data-page]")
    .forEach((b) => b.classList.toggle("active", b.dataset.page === page));
  $("heading").textContent = {
    words: "Vocabulary Management",
    cards: "Vocabulary Card Studio",
    transfer: "Import / Export",
    settings: "Settings",
  }[page];
  $("intro").textContent =
    page === "cards"
      ? "Research a word, prepare an illustration, and save a vocabulary card."
      : "Search, verify, and create vocabulary cards";
  ({ words: words, cards: studio, transfer: transfer, settings: settings })[
    page
  ]();
}
function words() {
  const verified = data.entries.filter(
      (e) => e.verification_status === "verified",
    ).length,
    approved = data.cards.filter((c) => c.review_status === "approved").length,
    drafts = data.cards.filter((c) => c.review_status === "pending").length;
  const list = A.search(data.entries, query).filter(
    (e) =>
      !filter ||
      (filter === "verified"
        ? e.verification_status === "verified"
        : filter === "missing"
          ? cardStatus(e.id) === "Missing"
          : filter === "draft"
            ? cardStatus(e.id) === "Draft"
            : true),
  );
  $("content").innerHTML =
    `<div class="counts"><button data-filter="">All Words (${data.entries.length})</button><button data-filter="verified">Verified (${verified})</button><button disabled>Cards Approved (${approved})</button><button data-filter="missing">Cards Missing (${data.entries.filter((e) => cardStatus(e.id) === "Missing").length})</button><button data-filter="draft">Drafts (${drafts})</button></div><div class="toolbar"><input id="search" aria-label="Search vocabulary" placeholder="Search Chinese, Pinyin, English or French…" value="${esc(query)}"><button id="addWord" class="primary">＋ Add Word</button></div><div class="row"><span>${checked.size} selected</span><button id="bulkReview">Mark needs review</button><button id="bulkPrompt">Export card prompts</button><button id="bulkLesson">Create lesson</button><button id="bulkImport">Bulk import JSON</button><input type="file" accept="application/json,.json" id="bulkFile" hidden></div><div class="split" style="margin-top:20px"><div class="panel"><table><thead><tr><th><input id="checkAll" type="checkbox" aria-label="Select visible words"></th><th>Chinese</th><th>Pinyin</th><th>Meaning</th><th>Card Status</th></tr></thead><tbody>${list.map((e) => `<tr class="${e.id === selected ? "selected" : ""}"><td><input type="checkbox" data-check="${esc(e.id)}" ${checked.has(e.id) ? "checked" : ""} aria-label="Select ${esc(e.hanzi)}"></td><td><button class="word" data-word="${esc(e.id)}" lang="zh-Hans">${esc(e.hanzi)}</button></td><td>${esc(e.pinyin)}</td><td>${esc(e.meaning_en)}</td><td>${cardStatus(e.id)}</td></tr>`).join("")}</tbody></table><p>${list.length} words</p></div><div class="panel" id="details"></div></div>`;
  $("search").oninput = (e) => {
    const position = e.target.selectionStart;
    query = e.target.value;
    words();
    $("search").focus();
    $("search").setSelectionRange(position, position);
  };
  document.querySelectorAll("[data-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        filter = b.dataset.filter;
        words();
      }),
  );
  document.querySelectorAll("[data-word]").forEach(
    (b) =>
      (b.onclick = () => {
        selected = b.dataset.word;
        words();
      }),
  );
  document.querySelectorAll("[data-check]").forEach(
    (b) =>
      (b.onchange = () => {
        b.checked
          ? checked.add(b.dataset.check)
          : checked.delete(b.dataset.check);
        words();
      }),
  );
  $("checkAll").onchange = (e) => {
    list.forEach((x) =>
      e.target.checked ? checked.add(x.id) : checked.delete(x.id),
    );
    words();
  };
  $("addWord").onclick = () => {
    selected = null;
    details();
  };
  $("bulkReview").onclick = act(async () => {
    if (!checked.size) throw Error("Select words first.");
    const n = structuredClone(data);
    n.entries
      .filter((e) => checked.has(e.id))
      .forEach((e) => (e.verification_status = "needs_review"));
    await commit(n);
    words();
  });
  $("bulkPrompt").onclick = act(() => {
    if (!checked.size) throw Error("Select words first.");
    download(
      [...checked].map((id) => A.prompt(data, id)).join("\n\n---\n\n"),
      "vocabulary_card_prompts.md",
      "text/markdown",
    );
  });
  $("bulkLesson").onclick = act(async () => {
    if (!checked.size) throw Error("Select words first.");
    const title = prompt("Lesson title (for example Le Petit Prince 1)");
    if (!title?.trim()) return;
    const n = structuredClone(data);
    n.lessons ??= [];
    n.lessons.push({
      id: crypto.randomUUID(),
      title: title.trim(),
      kind: "book",
      items: [...checked],
    });
    await commit(n);
    message(
      "Lesson saved locally. Export the learning bundle to transfer it to the app.",
    );
  });
  $("bulkImport").onclick = () => $("bulkFile").click();
  $("bulkFile").onchange = act(async () => {
    const rows = JSON.parse(await $("bulkFile").files[0].text());
    if (!Array.isArray(rows) || !rows.length)
      throw Error("Import a JSON array of vocabulary records.");
    const n = structuredClone(data);
    for (const row of rows) {
      if (!A.norm(row.hanzi) || !A.norm(row.pinyin) || !A.norm(row.meaning_en))
        throw Error("Every row requires hanzi, pinyin and meaning_en.");
      A.numbered(row.pinyin);
      if (
        n.entries.some(
          (e) =>
            A.norm(e.hanzi) === A.norm(row.hanzi) &&
            A.pinyinKey(e.pinyin) === A.pinyinKey(row.pinyin) &&
            A.norm(e.meaning_en) === A.norm(row.meaning_en),
        )
      )
        continue;
      n.entries.push({
        id: crypto.randomUUID(),
        hanzi: A.norm(row.hanzi),
        pinyin: A.norm(row.pinyin),
        meaning_en: A.norm(row.meaning_en),
        entry_type: row.entry_type || "expression",
        verification_status: "unverified",
      });
    }
    await commit(n);
    words();
  });
  details();
}
function details() {
  const e = data.entries.find((x) => x.id === selected) || {
    hanzi: "",
    pinyin: "",
    meaning_en: "",
    entry_type: "character",
  };
  $("details").innerHTML =
    `<div class="hanzi" lang="zh-Hans">${esc(e.hanzi)}</div><h2>${selected ? "Word Details" : "Add Word"}</h2><form id="wordForm"><label>Chinese<input name="hanzi" value="${esc(e.hanzi)}" required></label><label>Pinyin<input name="pinyin" value="${esc(e.pinyin)}" required></label><label>English<input name="meaning_en" value="${esc(e.meaning_en)}" required></label><label>French (optional)<input name="meaning_fr" value="${esc(e.meaning_fr)}"></label><label>Type<select name="entry_type">${["character", "expression", "radical", "sentence"].map((t) => `<option ${e.entry_type === t ? "selected" : ""}>${t}</option>`).join("")}</select></label><label>HSK (optional)<input name="hsk_level" type="number" min="1" value="${esc(e.hsk_level)}"></label><label>Notes<textarea name="admin_notes">${esc(e.admin_notes)}</textarea></label><button class="primary">Save Word</button></form><div class="actions"><button id="openStudio" ${selected ? "" : "disabled"}>Create / Edit Card</button></div>`;
  $("wordForm").onsubmit = async (event) => {
    event.preventDefault();
    try {
      const values = Object.fromEntries(new FormData(event.target));
      A.numbered(values.pinyin);
      const n = structuredClone(data);
      let target = n.entries.find((x) => x.id === selected);
      if (!target) {
        target = { id: crypto.randomUUID(), verification_status: "unverified" };
        n.entries.push(target);
      } else if (
        target.hanzi !== values.hanzi ||
        target.pinyin !== values.pinyin ||
        target.meaning_en !== values.meaning_en
      ) {
        target.verification_status = "needs_review";
        const r = n.research.find((x) => x.entry_id === target.id);
        if (r) r.verification_status = "needs_review";
      }
      Object.assign(target, values, {
        hsk_level: values.hsk_level ? +values.hsk_level : null,
      });
      await commit(n);
      selected = target.id;
      words();
    } catch (e) {
      message(e.message, true);
    }
  };
  $("openStudio").onclick = () => setPage("cards");
}
function studio() {
  const e = data.entries.find((x) => x.id === selected);
  if (!e) {
    $("content").innerHTML = "<p>Select or add a word in Vocabulary first.</p>";
    return;
  }
  const r = data.research.find((x) => x.entry_id === e.id) || {},
    components = data.components.filter((c) => c.entry_id === e.id);
  $("content").innerHTML =
    `<div class="split"><div><section class="panel"><h2>Word research</h2><div class="hanzi">${esc(e.hanzi)}</div><p>${esc(e.pinyin)} · ${esc(e.meaning_en)}</p><p class="muted">Local dictionary · no AI service connected</p><form id="researchForm"><label>Verified history<textarea id="origin">${esc(r.verified_origin_en)}</textarea></label><label>Sources (one URL or reference per line)<textarea id="sources">${esc((r.sources || []).map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join("\n"))}</textarea></label><label><input id="verified" type="checkbox" ${r.verification_status === "verified" ? "checked" : ""}> I have checked this history against these sources</label><h3>Components</h3>${components
      .map((c) => {
        const p = data.entries.find((x) => x.id === c.component_entry_id);
        return `<div class="component-row" data-component="${esc(c.id)}"><strong class="component">${esc(p?.hanzi)}</strong> ${esc(p?.pinyin)} · ${esc(p?.meaning_en)}<label>Role<select data-role>${["", "semantic", "phonetic", "both", "visual_mnemonic"].map((v) => `<option value="${v}" ${c.role === v ? "selected" : ""}>${v || "Unverified"}</option>`).join("")}</select></label><label>Explanation<textarea data-explanation>${esc(c.explanation_en)}</textarea></label><label><input data-verified type="checkbox" ${c.verification_status === "verified" ? "checked" : ""}> Component verified</label></div>`;
      })
      .join(
        "",
      )}<label>Add component from dictionary<select id="componentSelect"><option value="">Choose a component…</option>${data.entries
      .filter((x) => x.id !== selected)
      .map(
        (x) =>
          `<option value="${esc(x.id)}">${esc(x.hanzi + " · " + x.pinyin + " · " + x.meaning_en)}</option>`,
      )
      .join(
        "",
      )}</select></label><button type="button" id="addComponent">Add Component</button><h3>Proposed mnemonic — invented</h3><textarea id="mnemonic">${esc(e.mnemonic)}</textarea><label>One English word for filename<input id="filenameMeaning" value="${esc(e.filenameMeaning || e.meaning_en.split(/[;,/]/)[0].replace(/^to /, ""))}"></label><label>Import illustration<input id="illustration" type="file" accept="image/png,image/jpeg,image/webp"></label><p class="muted">Use your existing art or a locally generated illustration. Importing keeps it local and does not approve it.</p><button class="primary">Save Research and Details</button></form></section><section class="panel" style="margin-top:20px"><h2>Generation requirements</h2><p>Large Hanzi, official pinyin, meaning, verified history, component roles and a clearly identified invented mnemonic. Example sentences remain optional for this MVP.</p><button id="prompt">Export Image Prompt</button></section></div><section class="panel"><h2>Card preview</h2><button id="generate" class="primary">Create Draft Card</button><p id="cardErrors" class="warning"></p><img id="preview" class="preview" alt="Generated vocabulary card draft" hidden><div class="actions"><button id="exportPNG" disabled>Export PNG</button><button id="approve" disabled>Approve Draft</button><button id="reject" disabled>Reject Draft</button></div><p>Drafts remain unapproved until you explicitly accept them.</p><h3>Existing card records</h3>${
      cardsFor(e.id)
        .map(
          (c) =>
            `<p>${esc(c.vocabulary_card_path)} · ${esc(c.review_status === "pending" ? "Draft" : c.review_status)} ${c.local_svg ? `<button data-draft="${esc(c.id)}">Open saved card</button>` : ""}</p>`,
        )
        .join("") || "<p>No card linked yet.</p>"
    }</section></div>`;
  $("researchForm").onsubmit = async (event) => {
    event.preventDefault();
    try {
      const n = structuredClone(data),
        word = n.entries.find((x) => x.id === selected);
      let research = n.research.find((x) => x.entry_id === selected);
      if (!research) {
        research = { id: crypto.randomUUID(), entry_id: selected };
        n.research.push(research);
      }
      Object.assign(research, {
        verified_origin_en: $("origin").value.trim(),
        sources: $("sources")
          .value.split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
        verification_status: $("verified").checked
          ? "verified"
          : "needs_review",
      });
      Object.assign(word, {
        mnemonic: $("mnemonic").value.trim(),
        filenameMeaning: $("filenameMeaning").value.trim(),
      });
      for (const row of document.querySelectorAll("[data-component]")) {
        const c = n.components.find((x) => x.id === row.dataset.component);
        c.role = row.querySelector("[data-role]").value || null;
        c.explanation_en = row.querySelector("[data-explanation]").value;
        c.verification_status = row.querySelector("[data-verified]").checked
          ? "verified"
          : "needs_review";
      }
      const image = $("illustration").files[0];
      if (image) {
        if (image.size > 6 * 1024 * 1024)
          throw Error("Illustration must be under 6 MB.");
        word.illustration = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(image);
        });
      }
      await commit(n);
      studio();
    } catch (err) {
      message(err.message, true);
    }
  };
  $("addComponent").onclick = act(async () => {
    const id = $("componentSelect").value;
    if (!id) throw Error("Choose a component.");
    if (components.some((c) => c.component_entry_id === id))
      throw Error("Component already linked.");
    const n = structuredClone(data);
    n.components.push({
      id: crypto.randomUUID(),
      entry_id: selected,
      component_entry_id: id,
      position: components.length + 1,
      role: null,
      verification_status: "needs_review",
    });
    await commit(n);
    studio();
  });
  $("prompt").onclick = act(() =>
    download(
      A.prompt(data, selected),
      "vocabulary_card_prompt.md",
      "text/markdown",
    ),
  );
  let draft = null,
    svg = null;
  function showDraft(c) {
    draft = c;
    svg = c.local_svg;
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml" }),
    );
    $("preview").src = previewURL;
    $("preview").hidden = false;
    $("cardErrors").textContent =
      c.review_status === "pending" ? "Draft · not approved." : c.review_status;
    for (const id of ["exportPNG", "approve", "reject"]) $(id).disabled = false;
  }
  document
    .querySelectorAll("[data-draft]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          showDraft(data.cards.find((c) => c.id === b.dataset.draft))),
    );
  $("generate").onclick = act(async () => {
    const errors = A.cardErrors(data, selected);
    if (errors.length) {
      $("cardErrors").textContent = errors.join(" ");
      return;
    }
    svg = A.renderCard(data, selected);
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml" }),
    );
    $("preview").src = previewURL;
    $("preview").hidden = false;
    $("cardErrors").textContent = "Draft · not approved.";
    draft = {
      id: crypto.randomUUID(),
      entry_id: selected,
      subject_text: e.hanzi,
      pinyin: e.pinyin,
      sense: e.filenameMeaning || e.meaning_en,
      storage_bucket: null,
      vocabulary_card_path: A.filename(
        e.filenameMeaning || e.meaning_en,
        e.pinyin,
        "svg",
      ),
      review_status: "pending",
      is_shared: false,
      local_svg: svg,
    };
    const n = structuredClone(data);
    n.cards.push(draft);
    await commit(n);
    for (const id of ["exportPNG", "approve", "reject"]) $(id).disabled = false;
  });
  $("exportPNG").onclick = act(async () => {
    if (!draft) return;
    const img = new Image();
    img.src = previewURL;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d").drawImage(img, 0, 0);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw Error("PNG export failed.");
    const u = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = u;
    a.download = A.filename(e.filenameMeaning || e.meaning_en, e.pinyin);
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  });
  for (const [id, status] of [
    ["approve", "approved"],
    ["reject", "rejected"],
  ])
    $(id).onclick = act(async () => {
      if (!draft) return;
      const n = structuredClone(data),
        c = n.cards.find((c) => c.id === draft.id);
      c.review_status = status;
      await commit(n);
      $("cardErrors").textContent =
        status === "approved"
          ? "Approved by you · saved locally."
          : "Rejected by you · retained locally.";
    });
}
function transfer() {
  const report = A.reconcile(data);
  $("content").innerHTML =
    `<section class="panel"><h2>Backup and restore</h2><p>Includes vocabulary, research, components, card metadata, local illustrations, generated cards and administration lessons. Learning progress belongs to the learning app’s backup.</p><div class="row"><a href="/api/backup" download>Download Administration Backup</a><button id="learningExport">Export Learning Bundle</button><label>Restore administration backup<input id="restore" type="file" accept="application/json,.json"></label></div></section><section class="panel" style="margin-top:20px"><h2>Vocabulary card connections</h2><p>${report.length} inventory results. Matching never approves cards or renames images.</p><button id="match">Apply Unambiguous Matches Locally</button><button id="report">Download Connection Report</button><table><thead><tr><th>File</th><th>Word</th><th>Connection</th></tr></thead><tbody>${report.map((r) => `<tr><td>${esc(r.path)}</td><td>${esc(r.hanzi)}</td><td>${esc(r.status)}</td></tr>`).join("")}</tbody></table></section>`;
  $("restore").onchange = act(async () => {
    const n = A.validate(JSON.parse(await $("restore").files[0].text()));
    if (
      !confirm(
        "Replace this computer’s administration data with this backup? The original backup will be retained.",
      )
    )
      return;
    await commit(n);
    selected = data.entries[0]?.id;
    checked.clear();
    render();
  });
  $("match").onclick = act(async () => {
    const result = A.applyMatches(data);
    await commit(result.next);
    transfer();
    message(
      `${result.changed} local card connections updated. Approval statuses preserved.`,
    );
  });
  $("report").onclick = () =>
    download(JSON.stringify(report, null, 2), "card_connections.json");
  $("learningExport").onclick = () => {
    const entries = data.entries.map((e) => ({
      id: e.id,
      simplified: e.hanzi,
      traditional: e.traditional_hanzi || "",
      pinyin: e.pinyin || "",
      meaning: e.meaning_en,
      meaning_fr: e.meaning_fr || "",
      type: e.entry_type,
      status: "new",
      source: "admin",
      srsEligible: false,
    }));
    const lessons = data.lessons || [];
    download(
      JSON.stringify(
        { format: "myCello-vocabulary-bundle", version: 1, entries, lessons },
        null,
        2,
      ),
      "myCello-learning-bundle.json",
    );
  };
}
function settings() {
  $("content").innerHTML =
    '<section class="panel"><h2>Local Administration</h2><p>Dictionary, research and card drafts: local administration data file.</p><p>Learning progress and SRS: IndexedDB on the device running the learning app, with a compatibility copy in localStorage.</p><p>Supabase is the source of the imported snapshot. This studio uses no external dictionary, AI, or image API calls. Transfer changes explicitly with backups.</p><p>Run <code>npm run admin</code> from the repository and open <code>http://127.0.0.1:8765/</code>.</p></section>';
}
$("help").onclick = () => $("helpDialog").showModal();
$("helpClose").onclick = () => $("helpDialog").close();
document
  .querySelectorAll("[data-page]")
  .forEach((b) => (b.onclick = () => setPage(b.dataset.page)));
load().catch((e) => message(e.message, true));
