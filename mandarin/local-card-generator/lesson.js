"use strict";

const modeKey = "mylexigo.studio.mode";
const lessonKey = "mylexigo.studio.lesson";
const itemKey = "mylexigo.studio.lesson-word";
let lesson = null;
let selectedItem = localStorage.getItem(itemKey);
let lessonRequest = false;
let lessonPoll;
let lessonEpoch = 0;
let activeSignature = "";
let renderedList = "";

const statuses = {
  pending: "Pending", researching: "Researching", researched: "Awaiting approval",
  queued: "Image queued", generating: "Generating illustration", ready: "Image generated · Awaiting save",
  existing: "Already exists", saved: "Saved", failed: "Failed",
};

function isLessonMode() {
  return document.querySelector('[name="research-mode"]:checked').value === "lesson";
}

function lessonItem() {
  return lesson?.items.find(item => item.id === selectedItem);
}

function listInput() {
  const raw = byId("lesson-words").value.replace(/^\s*(?:[-•*]|\d+[.、)])\s*/gm, "");
  const terms = raw.split(/[\s,，、;；]+/u).filter(Boolean);
  const count = new Set(terms).size;
  const invalid = terms.find(word => !/^\p{Unified_Ideograph}{1,12}$/u.test(word));
  return {count, message: invalid ? `“${invalid}” is invalid. Enter Chinese characters only.`
    : count > 20 ? "A lesson can contain at most 20 distinct words." : ""};
}

function updateLessonButtons() {
  if (lessonRequest) document.querySelectorAll('[name="research-mode"]').forEach(radio => { radio.disabled = true; });
  const {count, message} = listInput();
  const counter = byId("word-count");
  counter.textContent = message || `${count} / 20 words`;
  counter.toggleAttribute("data-invalid", Boolean(message));
  byId("lesson-words").setCustomValidity(message);
  const allowSubmit = connected && !lessonRequest && count > 0 && !message;
  byId("lesson-create").disabled = !allowSubmit;
  byId("lesson-research").disabled = !allowSubmit;
  if (!isLessonMode()) return;

  const item = lessonItem();
  const changing = !item || ["pending", "researching", "queued", "generating"].includes(item.state);
  const locked = changing || lessonRequest || !connected || !item?.fields;
  const needsArt = item?.state === "researched";
  const hasImage = Boolean(item?.draft || item?.card);
  byId("generate-approved").hidden = !needsArt;
  byId("generate-approved").disabled = locked;
  byId("regenerate").hidden = !hasImage;
  byId("regenerate").disabled = locked;
  byId("edit-mnemonic").disabled = locked;
  byId("manual-create").disabled = locked;
  byId("approve").disabled = locked || item.state !== "ready"
    || !Object.entries(formValues()).every(([name, value]) => value === (item.fields[name] || ""));
  byId("senses").disabled = locked;
  fields.toggleAttribute("inert", locked);
  byId("saved-lessons").disabled = lessonRequest || !connected;
  byId("resume-lesson").disabled = lessonRequest || !connected;
  document.querySelectorAll("#lesson-items button[data-retry]").forEach(button => {
    button.disabled = lessonRequest || !connected;
  });
}

function lessonMessage(message, error = false) {
  const status = byId("lesson-feedback");
  status.hidden = !message;
  status.textContent = message || "";
  status.dataset.state = error ? "error" : "idle";
}

async function lessonGet(path) {
  const response = await fetch(path, {signal: AbortSignal.timeout(6000)});
  if (!response.ok) throw new Error("Could not load the saved lesson.");
  return response.json();
}

function paintLesson() {
  byId("lesson-summary").hidden = !lesson;
  byId("resume-lesson").hidden = !lesson || lesson.running || !lesson.items.some(
    item => item.state === "pending" || item.state === "queued");
  if (!lesson) {
    buttons();
    return;
  }
  const items = lesson.items;
  const tally = match => items.filter(match).length;
  const researched = tally(item => item.research);
  const generated = tally(item => item.draft);
  const awaiting = tally(item => ["researched", "ready"].includes(item.state));
  const failed = tally(item => item.state === "failed");
  const existing = tally(item => item.state === "existing");
  const saved = tally(item => item.state === "saved");
  byId("active-lesson-title").textContent = `${lesson.title} — ${items.length} words`;
  const counts = `Research complete ${researched} · Images generated ${generated} · Awaiting approval ${awaiting} · Failed ${failed} · Already existed ${existing} · Saved ${saved}`;
  if (byId("lesson-counts").textContent !== counts) byId("lesson-counts").textContent = counts;
  byId("lesson-progress").max = items.length;
  byId("lesson-progress").value = tally(item => !["pending", "researching", "queued", "generating"].includes(item.state));
  const signature = JSON.stringify(items.map(item => [item.id, item.state, item.error, item.id === selectedItem]));
  if (signature !== renderedList) {
    renderedList = signature;
    byId("lesson-items").replaceChildren(...items.map(item => {
      const row = document.createElement("li");
      row.className = "lesson-item";
      row.dataset.state = item.state;
      const open = document.createElement("button");
      open.type = "button";
      open.className = "item-select";
      open.setAttribute("aria-current", item.id === selectedItem ? "true" : "false");
      const title = document.createElement("strong");
      title.textContent = item.fields?.headword || item.word;
      title.lang = "zh-Hans";
      const state = document.createElement("span");
      state.textContent = statuses[item.state];
      open.append(title, state);
      open.onclick = () => { selectLessonItem(item.id); };
      row.append(open);
      if (item.state === "failed") {
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "button outline compact";
        retry.dataset.retry = item.id;
        retry.setAttribute("aria-label", `Retry ${item.word}`);
        retry.textContent = "Retry";
        retry.onclick = () => { void lessonAction("retry", {}, item.id); };
        row.append(retry);
      }
      return row;
    }));
  }
  paintLessonItem();
  buttons();
}

function selectLessonItem(id) {
  selectedItem = id;
  localStorage.setItem(itemKey, id);
  paintLesson();
  byId("lesson-items").querySelector('[aria-current="true"]')?.focus();
}

function paintLessonItem() {
  const item = lessonItem();
  const signature = JSON.stringify(item || null);
  if (signature === activeSignature) return;
  activeSignature = signature;
  if (!item) return;
  if (item.research) {
    const selected = item.research.options[item.choice || 0];
    showResearch({...selected, pinyin: item.pinyin || selected.pinyin, fields: item.fields, mnemonicKind: item.fields["mnemonic kind"]});
    byId("senses").replaceChildren(...item.research.options.map((option, index) =>
      new Option(`${option.pinyin} — ${option.sense}`, index)));
    byId("senses").value = String(item.choice ?? 0);
    byId("senses-wrap").hidden = item.research.options.length < 2;
    showSources(selected.sources || item.research.sources);
  } else {
    clearResearch();
  }
  step("research", item.research ? "success" : item.failure === "research" ? "error" : "idle",
    item.research ? "Research ready" : statuses[item.state]);
  step("illustration", item.state === "generating" ? "running" : item.failure === "image" ? "error"
    : item.draft || item.card ? "success" : "idle", statuses[item.state]);
  step("saving", item.state === "saved" || item.state === "existing" ? "success" : item.failure === "save" ? "error" : "idle",
    item.state === "saved" || item.state === "existing" ? "Approved PNG" : item.failure === "save" ? "Save failed" : "Waiting for approval");
  const hasCard = !!(item.card || item.draft);
  const src = hasCard ? `/lesson/${lesson.id}/image/${item.id}?rev=${encodeURIComponent(item.card || item.draft)}` : "./assets/example-card.webp";
  showCardImage(src, hasCard ? `Vocabulary card for ${item.word}` : "Sample vocabulary card for 苹果");
  stage.dataset.state = item.state === "generating" ? "running" : hasCard ? "ready" : "sample";
  byId("preview-kind").textContent = item.state === "existing" ? "Existing approved card"
    : item.state === "saved" ? "Approved card" : hasCard ? "Review before saving" : "Sample card";
  byId("jump-preview").hidden = !hasCard;
  byId("filename").textContent = item.card || (hasCard ? item.filename : "PNG export");
  feedback(item.state === "failed" ? "error" : hasCard ? "success" : "idle",
    item.error || (item.state === "researched" ? "Review the research, then select Approve & Generate."
      : item.state === "ready" ? "Review the illustration before approving the PNG." : statuses[item.state]));
}

function acceptLesson(result) {
  const changed = lesson?.id !== result.id;
  lesson = result;
  localStorage.setItem(lessonKey, result.id);
  if (!result.items.some(item => item.id === selectedItem)) selectedItem = result.items[0]?.id || null;
  if (changed) activeSignature = "";
  paintLesson();
  scheduleLessonPoll();
}

async function loadLessons(id = localStorage.getItem(lessonKey)) {
  if (!connected || !isLessonMode()) return;
  clearTimeout(lessonPoll);
  const epoch = ++lessonEpoch;
  try {
    const result = await lessonGet("/lessons");
    if (epoch !== lessonEpoch || !isLessonMode()) return;
    byId("saved-lessons").replaceChildren(new Option("Choose a lesson", ""), ...result.lessons.map(row =>
      new Option(`${row.title} (${row.count})`, row.id)));
    if (id && result.lessons.some(row => row.id === id)) {
      byId("saved-lessons").value = id;
      const record = await lessonGet(`/lesson/${id}`);
      if (epoch === lessonEpoch) acceptLesson(record);
    } else {
      lesson = null;
      clearResearch();
      showCardImage("./assets/example-card.webp", "Sample vocabulary card for 苹果");
      byId("preview-kind").textContent = "Sample card";
      byId("filename").textContent = "PNG export";
      byId("jump-preview").hidden = true;
      paintLesson();
    }
  } catch (error) {
    lessonMessage(error.message, true);
  }
}

function scheduleLessonPoll() {
  clearTimeout(lessonPoll);
  if (!lesson?.running || !isLessonMode()) return;
  const id = lesson.id;
  const epoch = lessonEpoch;
  lessonPoll = setTimeout(async () => {
    try {
      const result = await lessonGet(`/lesson/${id}`);
      if (epoch === lessonEpoch && isLessonMode() && !lessonRequest) acceptLesson(result);
    } catch {
      if (epoch === lessonEpoch) lessonMessage("Could not check progress. Open the saved lesson again to reconnect.", true);
    }
  }, 800);
}

async function lessonAction(action, extra = {}, item = selectedItem) {
  if (!lesson || !connected || lessonRequest) return;
  lessonRequest = true;
  ++lessonEpoch;
  clearTimeout(lessonPoll);
  buttons();
  try {
    const result = await (await post("/lesson", {action, lesson: lesson.id, item, ...extra})).json();
    if (isLessonMode()) acceptLesson(result);
    lessonMessage("");
  } catch (error) {
    lessonMessage(error.message, true);
    feedback("error", error.message);
  } finally {
    lessonRequest = false;
    buttons();
    scheduleLessonPoll();
  }
}

byId("lesson-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (lessonRequest || !connected) return;
  lessonRequest = true;
  ++lessonEpoch;
  clearTimeout(lessonPoll);
  buttons();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const result = await (await post("/lessons", {...data, auto: event.submitter?.id === "lesson-create"})).json();
    if (!isLessonMode()) return;
    await loadLessons(result.id);
    lessonMessage(result.duplicates ? `Skipped ${result.duplicates} duplicate entries.` : "");
  } catch (error) {
    lessonMessage(error.message, true);
  } finally {
    lessonRequest = false;
    buttons();
    scheduleLessonPoll();
  }
});

function switchMode() {
  const full = isLessonMode();
  localStorage.setItem(modeKey, full ? "lesson" : "single");
  ++lessonEpoch;
  clearTimeout(lessonPoll);
  byId("single-query").hidden = full;
  byId("lesson-form").hidden = !full;
  byId("lesson-panel").hidden = !full;
  clearResearch();
  preview = null;
  singleResearched = false;
  activeSignature = "";
  byId("regenerate").hidden = full;
  byId("jump-preview").hidden = true;
  byId("preview-kind").textContent = "Sample card";
  byId("filename").textContent = "PNG export";
  showCardImage("./assets/example-card.webp", "Sample vocabulary card for 苹果");
  step("research", "idle", "Waiting for a word");
  step("illustration", "idle", "Waiting for research");
  step("saving", "idle", "Waiting for approval");
  feedback("idle", full ? "Open a lesson and select a word to review." : "Research a word to create your own preview.");
  if (full) void loadLessons();
  buttons();
}

document.querySelectorAll('[name="research-mode"]').forEach(radio => radio.addEventListener("change", switchMode));
byId("lesson-words").addEventListener("input", updateLessonButtons);
byId("saved-lessons").addEventListener("change", event => {
  lessonMessage("");
  void loadLessons(event.target.value);
});
byId("resume-lesson").onclick = () => { void lessonAction("resume"); };
if (localStorage.getItem(modeKey) === "lesson") {
  document.querySelector('[name="research-mode"][value="lesson"]').checked = true;
  switchMode();
}
