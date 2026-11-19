"use strict";

const byId = id => document.getElementById(id);
const fields = byId("card-fields");
const wordInput = byId("word");
const image = byId("preview-image");
const stage = byId("stage");
const editor = byId("mnemonic-dialog");
const localAddress = location.protocol === "http:" && ["localhost", "127.0.0.1"].includes(location.hostname);
let connected = false;
let engineSession = null;
let busy = false;
let options = [];
let preview = null;
let imageUrl = null;
let singleAuto = true;
let singleResearched = false;
let singleIllustrated = false;

function step(id, state, message) {
  const status = byId(id + "-state");
  status.closest(".step").dataset.state = state;
  status.textContent = message;
}

function feedback(state, message) {
  byId("message").dataset.state = state;
  byId("message").textContent = message;
}

function formValues() {
  return Object.fromEntries(new FormData(fields));
}

function currentPreview() {
  return Boolean(preview && JSON.stringify(formValues()) === preview.fields);
}

function buttons() {
  document.querySelectorAll('[name="research-mode"]').forEach(radio => { radio.disabled = busy; });
  byId("create").disabled = busy || !connected;
  byId("research-only").disabled = busy || !connected;
  byId("manual-create").disabled = busy || !connected;
  byId("regenerate").disabled = busy || !connected || !fields.elements.namedItem("scene").value.trim();
  byId("edit-mnemonic").disabled = busy || !fields.elements.namedItem("mnemonic").value.trim();
  byId("approve").disabled = busy || !connected || !currentPreview();
  byId("senses").disabled = busy;
  fields.toggleAttribute("inert", busy);
  byId("reconnect").disabled = busy;
  byId("generate-approved").hidden = !singleResearched || Boolean(imageUrl && !byId("jump-preview").hidden);
  byId("generate-approved").disabled = busy || !connected;
  byId("regenerate").hidden = singleResearched && !singleIllustrated;
  if (typeof updateLessonButtons === "function") updateLessonButtons();
}

function connection(state, label) {
  connected = state === "success";
  byId("connection").dataset.state = state;
  byId("connection-label").textContent = label;
  byId("launch").hidden = state !== "error";
  byId("reconnect").hidden = state !== "error" || !localAddress;
  buttons();
}

async function checkConnection() {
  if (!localAddress) {
    connection("error", "Open on this PC");
    feedback("error", "Open the studio from Start Generator.cmd to create a card.");
    return;
  }
  connection("idle", "Checking local engine");
  try {
    const response = await fetch("/health", {signal: AbortSignal.timeout(4000)});
    const health = await response.json();
    if (!response.ok || health.service !== "mylexigo-card-studio") throw new Error("Unexpected local service");
    if (engineSession && engineSession !== health.session && preview) {
      preview = null;
      markDraft();
      step("illustration", "idle", "Regenerate preview after restart");
    }
    engineSession = health.session;
    connection("success", "Local engine connected");
    if (typeof loadLessons === "function") void loadLessons();
    const message = health.research ? "Research a word to create your own preview."
      : "Research data is missing. Restart with Start Generator.cmd while connected, or use Manual card details.";
    feedback(health.research ? "idle" : "error", message);
    if (!health.research) step("research", "error", "Research setup required");
  } catch {
    connection("error", "Local engine disconnected");
    feedback("error", "Start the local generator, keep its window open, and select Reconnect.");
  }
}

async function post(path, payload) {
  let response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload),
    });
  } catch {
    connection("error", "Local engine disconnected");
    throw new Error("Connection lost. Keep Start Generator.cmd open and select Reconnect.");
  }
  if (!response.ok) {
    const fallback = `The local engine returned HTTP ${response.status}. Check the generator window and retry.`;
    const problem = await response.json().catch(() => ({}));
    throw new Error(problem.error || fallback);
  }
  return response;
}

async function task(operation) {
  if (busy || !connected) return;
  busy = true;
  buttons();
  try {
    await operation();
  } finally {
    busy = false;
    buttons();
  }
}

function markDraft() {
  step("saving", "idle", "Waiting for approval");
  if (imageUrl) {
    stage.dataset.state = "stale";
    byId("preview-kind").textContent = "Previous preview";
  }
}

function showResearch(option) {
  fields.reset();
  for (const [name, value] of Object.entries(option.fields)) fields.elements.namedItem(name).value = value;
  byId("results").hidden = false;
  byId("research-empty").hidden = true;
  byId("result-word").textContent = option.fields.headword;
  byId("result-pinyin").textContent = option.pinyin;
  byId("result-meaning").textContent = [option.fields["English meaning"], option.fields["French meaning"]].filter(Boolean).join(" · ");
  byId("result-traditional").textContent = option.traditional !== option.fields.headword ? "Traditional: " + option.traditional : "";
  byId("history").textContent = option.fields.history || "No historical note is available in the local source.";
  byId("research-example").textContent = [option.fields["example Chinese"], option.fields["example pinyin"], option.fields["example English"]]
    .filter(Boolean).join(" · ") || "No matching example. Add one in Manual card details before creating the image.";
  byId("mnemonic-copy").textContent = option.fields.mnemonic;
  byId("mnemonic-kind").textContent = option.mnemonicKind || "Invented memory aid";
  const list = byId("characters");
  list.replaceChildren(...option.characters.map(character => {
    const row = document.createElement("div");
    row.className = "character";
    const glyph = document.createElement("strong");
    glyph.className = "glyph";
    glyph.lang = "zh-Hans";
    glyph.textContent = character.glyph;
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = [character.reading, character.definition].filter(Boolean).join(" · ");
    const info = document.createElement("span");
    info.textContent = [character.layout, ...character.roles].filter(Boolean).join(" · ") || "No component breakdown in the local source.";
    copy.append(title, info);
    if (character.evidence) {
      const evidence = document.createElement("span");
      evidence.textContent = character.evidence;
      copy.append(evidence);
    }
    row.append(glyph, copy);
    return row;
  }));
}

function showSources(sources) {
  byId("sources").replaceChildren(...Object.entries(sources).map(([name, url]) => {
    const source = document.createElement("a");
    source.href = url;
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    source.textContent = name;
    return source;
  }));
}

function clearResearch() {
  fields.reset();
  byId("results").hidden = true;
  byId("research-empty").hidden = false;
  byId("mnemonic-copy").textContent = "Research a word to draft a memory cue and illustration scene.";
  byId("mnemonic-kind").textContent = "";
}

function showCardImage(url, title) {
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = url.startsWith("blob:") ? url : null;
  image.src = url;
  image.alt = title;
  byId("full-size").href = url;
}

async function illustrate(reuse = false) {
  const data = formValues();
  const previous = preview;
  singleIllustrated = true;
  markDraft();
  step("illustration", "running", reuse ? "Updating card text" : "Generating locally");
  stage.dataset.state = "running";
  byId("preview-kind").textContent = reuse ? "Updating preview" : "Generating illustration";
  feedback("idle", reuse ? "Applying your mnemonic to the preview." : "Generating on this PC. The first preview may take longer.");
  try {
    const response = await post(reuse ? "/revise" : "/preview", reuse ? {...data, token: previous.token} : data);
    const png = await response.blob();
    const token = response.headers.get("X-Card-Token");
    const filename = response.headers.get("X-Card-Filename");
    if (png.type !== "image/png" || !token || !filename) throw new Error("The local engine returned an incomplete preview. Regenerate to retry.");
    const nextUrl = URL.createObjectURL(png);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = nextUrl;
    image.src = nextUrl;
    byId("full-size").href = nextUrl;
    image.alt = "Vocabulary card for " + data.headword;
    preview = {token, filename, scene: data.scene, fields: JSON.stringify(data)};
    stage.dataset.state = "ready";
    byId("jump-preview").hidden = false;
    byId("preview-kind").textContent = "Review before saving";
    byId("filename").textContent = filename;
    byId("destination").textContent = "Downloads / Mandarin-Cards";
    step("illustration", "success", "Preview ready");
    feedback("success", "Check the illustration, characters, and pinyin before approving.");
  } catch (error) {
    preview = null;
    stage.dataset.state = "stale";
    byId("preview-kind").textContent = imageUrl ? "Previous preview" : "Sample card";
    step("illustration", "error", "Preview failed");
    feedback("error", error.message);
  }
}

byId("research-form").addEventListener("submit", event => {
  event.preventDefault();
  const word = wordInput.value.trim();
  singleAuto = event.submitter?.id !== "research-only";
  void task(async () => {
    markDraft();
    preview = null;
    options = [];
    singleResearched = false;
    singleIllustrated = false;
    byId("jump-preview").hidden = true;
    clearResearch();
    byId("research-error").hidden = true;
    step("research", "running", "Looking up word");
    step("illustration", "idle", "Waiting for research");
    try {
      const result = await (await post("/research", {word})).json();
      options = result.options;
      byId("senses").replaceChildren(...options.map((option, index) =>
        new Option(`${option.pinyin} — ${option.sense}`, index)));
      byId("senses-wrap").hidden = options.length < 2;
      showSources(options[0].sources || result.sources);
      showResearch(options[0]);
      singleResearched = true;
      step("research", "success", "Research ready");
    } catch (error) {
      step("research", "error", "Research failed");
      byId("research-error").textContent = error.message;
      byId("research-error").hidden = false;
      feedback("error", error.message);
      return;
    }
    if (singleAuto) await illustrate();
    else {
      step("illustration", "idle", "Awaiting approval");
      feedback("idle", "Review the research, then select Approve & Generate.");
    }
  });
});

byId("senses").addEventListener("change", event => {
  if (typeof isLessonMode === "function" && isLessonMode()) {
    void lessonAction("select", {choice: Number(event.target.value)});
    return;
  }
  void task(async () => {
    const draft = options[Number(event.target.value)];
    showResearch(draft);
    showSources(draft.sources || {});
    if (!singleAuto) {
      preview = null;
      singleIllustrated = false;
      byId("jump-preview").hidden = true;
      markDraft();
    }
    if (singleAuto) await illustrate();
  });
});

document.querySelectorAll("[data-word]").forEach(button => button.addEventListener("click", () => {
  wordInput.value = button.dataset.word;
  wordInput.focus();
}));

fields.addEventListener("input", event => {
  if (["mnemonic", "scene"].includes(event.target.name)) {
    fields.elements.namedItem("mnemonic kind").value = "Invented memory aid";
    byId("mnemonic-kind").textContent = "Invented memory aid";
  }
  markDraft();
  byId("mnemonic-copy").textContent = fields.elements.namedItem("mnemonic").value;
  if (preview) feedback("idle", "Update the preview to apply the new details.");
  buttons();
});

fields.addEventListener("submit", event => {
  event.preventDefault();
  if (typeof isLessonMode === "function" && isLessonMode()) {
    void lessonAction("generate", {fields: formValues()});
    return;
  }
  void task(async () => {
    step("research", "success", "Manual details entered");
    await illustrate(Boolean(preview && !currentPreview() && preview.scene === formValues().scene));
  });
});

byId("generate-approved").addEventListener("click", () => {
  if (typeof isLessonMode === "function" && isLessonMode()) void lessonAction("generate", {fields: formValues()});
  else void task(() => illustrate());
});
byId("regenerate").addEventListener("click", () => {
  if (typeof isLessonMode === "function" && isLessonMode()) void lessonAction("regenerate", {fields: formValues()});
  else void task(() => illustrate());
});
byId("reconnect").addEventListener("click", () => { void checkConnection(); });

byId("edit-mnemonic").addEventListener("click", () => {
  const data = formValues();
  byId("editor-mnemonic").value = data.mnemonic;
  byId("editor-scene").value = data.scene;
  editor.showModal();
});
for (const id of ["cancel-editor", "close-editor"]) byId(id).addEventListener("click", () => editor.close());
byId("mnemonic-form").addEventListener("submit", event => {
  event.preventDefault();
  const mnemonic = byId("editor-mnemonic").value.trim();
  const scene = byId("editor-scene").value.trim();
  if (!mnemonic || !scene || !connected) return;
  editor.close();
  fields.elements.namedItem("mnemonic").value = mnemonic;
  fields.elements.namedItem("scene").value = scene;
  fields.elements.namedItem("mnemonic kind").value = "Invented memory aid";
  byId("mnemonic-kind").textContent = "Invented memory aid";
  byId("mnemonic-copy").textContent = mnemonic;
  if (typeof isLessonMode === "function" && isLessonMode()) {
    void lessonAction("edit", {fields: formValues()});
  } else if (preview) {
    void task(() => illustrate(preview.scene === scene));
  } else {
    feedback("idle", "Mnemonic updated. Select Approve & Generate when ready.");
    buttons();
  }
});

byId("approve").addEventListener("click", () => {
  if (typeof isLessonMode === "function" && isLessonMode()) {
    void lessonAction("save");
    return;
  }
  if (!currentPreview()) return;
  void task(async () => {
    step("saving", "running", "Writing PNG");
    try {
      const {path} = await (await post("/save", {token: preview.token})).json();
      preview = null;
      byId("preview-kind").textContent = "Approved card";
      byId("filename").textContent = path.split(/[\\/]/).at(-1);
      step("saving", "success", "PNG saved");
      feedback("success", "Saved to " + path);
    } catch (error) {
      step("saving", "error", "Save failed");
      feedback("error", error.message);
    }
  });
});

void checkConnection();
