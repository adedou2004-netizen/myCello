(function (root) {
  "use strict";
  const norm = (v) =>
    String(v ?? "")
      .normalize("NFC")
      .trim();
  const fold = (v) =>
    norm(v)
      .toLowerCase()
      .replace(/u:|ü|ǖ|ǘ|ǚ|ǜ/g, "v")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[1-5\s'’_-]/g, "");
  const syllables = new Set(
    "a ai an ang ao ba bai ban bang bao bei ben beng bi bian biao bie bin bing bo bu ca cai can cang cao ce cen ceng cha chai chan chang chao che chen cheng chi chong chou chu chua chuai chuan chuang chui chun chuo ci cong cou cu cuan cui cun cuo da dai dan dang dao de dei den deng di dia dian diao die ding diu dong dou du duan dui dun duo e ei en eng er fa fan fang fei fen feng fo fou fu ga gai gan gang gao ge gei gen geng gong gou gu gua guai guan guang gui gun guo ha hai han hang hao he hei hen heng hong hou hu hua huai huan huang hui hun huo ji jia jian jiang jiao jie jin jing jiong jiu ju juan jue jun ka kai kan kang kao ke kei ken keng kong kou ku kua kuai kuan kuang kui kun kuo la lai lan lang lao le lei leng li lia lian liang liao lie lin ling liu lo long lou lu luan lun luo lv lve ma mai man mang mao me mei men meng mi mian miao mie min ming miu mo mou mu na nai nan nang nao ne nei nen neng ni nian niang niao nie nin ning niu nong nou nu nuan nuo nv nve o ou pa pai pan pang pao pei pen peng pi pian piao pie pin ping po pou pu qi qia qian qiang qiao qie qin qing qiong qiu qu quan que qun ran rang rao re ren reng ri rong rou ru ruan rui run ruo sa sai san sang sao se sen seng sha shai shan shang shao she shei shen sheng shi shou shu shua shuai shuan shuang shui shun shuo si song sou su suan sui sun suo ta tai tan tang tao te teng ti tian tiao tie ting tong tou tu tuan tui tun tuo wa wai wan wang wei wen weng wo wu xi xia xian xiang xiao xie xin xing xiong xiu xu xuan xue xun ya yan yang yao ye yi yin ying yo yong you yu yuan yue yun za zai zan zang zao ze zei zen zeng zha zhai zhan zhang zhao zhe zhei zhen zheng zhi zhong zhou zhu zhua zhuai zhuan zhuang zhui zhun zhuo zi zong zou zu zuan zui zun zuo m n ng".split(
      " ",
    ),
  );
  function numbered(py) {
    const marks = "āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ";
    const source = norm(py)
      .toLowerCase()
      .replace(/u:/g, "ü")
      .replace(/’/g, "'");
    if (!source || /[^a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ1-5\s'-]/.test(source))
      throw Error("Use Hanyu Pinyin, with tone marks or tone numbers.");
    const results = [];
    for (const chunk of source.split(/[\s'-]+/).filter(Boolean)) {
      function parse(at) {
        if (at === chunk.length) return [];
        for (let end = Math.min(chunk.length, at + 7); end > at; end--) {
          const part = chunk.slice(at, end);
          if (/[1-5]./.test(part)) continue;
          const base = fold(part);
          if (!syllables.has(base)) continue;
          const tones = [...part]
            .filter((c) => marks.includes(c))
            .map((c) => (marks.indexOf(c) % 4) + 1);
          const digit = part.match(/[1-5]$/)?.[0];
          if (
            tones.length > 1 ||
            (digit && tones.length && +digit !== tones[0])
          )
            continue;
          const tail = parse(end);
          if (tail) return [base + (digit || tones[0] || ""), ...tail];
        }
        return null;
      }
      const found = parse(0);
      if (!found)
        throw Error(
          "Cannot split this pinyin into syllables. Add spaces between syllables.",
        );
      results.push(...found);
    }
    return results.join("-");
  }
  const pinyinKey = (py) => {
    try {
      return numbered(py)
        .replace(/-/g, "")
        .replace(/5(?=[a-z]|$)/g, "");
    } catch {
      return null;
    }
  };
  function filename(meaning, py, ext = "png") {
    if (!/^[a-z]+$/i.test(norm(meaning)))
      throw Error("Choose one English word for the filename.");
    if (!["png", "webp", "svg"].includes(ext))
      throw Error("Unsupported image format.");
    return norm(meaning).toLowerCase() + "_" + numbered(py) + "." + ext;
  }
  function search(entries, q) {
    const query = fold(q);
    return entries.filter((e) =>
      [e.hanzi, e.traditional_hanzi, e.pinyin, e.meaning_en, e.meaning_fr].some(
        (v) => fold(v).includes(query),
      ),
    );
  }
  function validate(s) {
    if (!s || s.format !== "myCello-admin" || s.version !== 1)
      throw Error("Unsupported administration backup.");
    for (const k of [
      "entries",
      "research",
      "components",
      "cards",
      "objects",
      "buckets",
    ])
      if (!Array.isArray(s[k])) throw Error("Missing " + k);
    const ids = new Set();
    for (const e of s.entries) {
      if (!e.id || ids.has(e.id) || !norm(e.hanzi) || !norm(e.meaning_en))
        throw Error("Invalid or duplicate vocabulary entry.");
      ids.add(e.id);
    }
    for (const c of s.components)
      if (!ids.has(c.entry_id) || !ids.has(c.component_entry_id))
        throw Error("Component refers to a missing word.");
    for (const c of s.cards)
      if (c.entry_id && !ids.has(c.entry_id))
        throw Error("Card refers to a missing word.");
    for (const r of s.research)
      if (!ids.has(r.entry_id))
        throw Error("Research refers to a missing word.");
    return s;
  }
  function reconcile(s) {
    const report = [];
    const used = new Set();
    for (const object of s.objects.filter(
      (o) =>
        o.bucket_id === "man_vocabularyCard" && /\.(png|webp)$/i.test(o.name),
    )) {
      const path = object.name;
      const known = s.cards.filter(
        (c) =>
          c.storage_bucket === object.bucket_id &&
          c.vocabulary_card_path === path,
      );
      const parsed = path.match(/^([a-z]+)[_+]([a-züv1-5-]+)\.(png|webp)$/i);
      let matches =
        parsed && pinyinKey(parsed[2])
          ? s.entries.filter(
              (e) =>
                pinyinKey(e.pinyin) === pinyinKey(parsed[2]) &&
                norm(e.meaning_en)
                  .toLowerCase()
                  .split(/[;,/]/)
                  .some(
                    (m) =>
                      m.trim().replace(/^to /, "") === parsed[1].toLowerCase(),
                  ),
            )
          : [];
      if (known.length) {
        matches = s.entries.filter((e) =>
          known.some((c) => c.entry_id === e.id),
        );
        known.forEach((c) => used.add(c.id));
      }
      const compact = s.cards.filter(
        (c) =>
          c.storage_bucket === object.bucket_id &&
          norm(c.vocabulary_card_path).replace(/-/g, "") === path.replace(/-/g, ""),
      );
      const status = known.length
        ? matches.length === 1
          ? "linked"
          : matches.length > 1 ? "ambiguous" : "entry missing"
        : compact.length === 1
          ? "path mismatch"
          : matches.length === 1
            ? "match available"
            : matches.length > 1
              ? "ambiguous"
              : "needs review";
      report.push({
        path,
        status,
        entryId: matches.length === 1 ? matches[0].id : null,
        cardId: known[0]?.id || compact[0]?.id || null,
        hanzi: matches.map((e) => e.hanzi).join(" / "),
        suggestedName: parsed
          ? (() => {
              try {
                return filename(parsed[1], parsed[2], parsed[3]);
              } catch {
                return null;
              }
            })()
          : null,
      });
    }
    for (const c of s.cards.filter(
      (c) =>
        c.storage_bucket === "man_vocabularyCard" &&
        !used.has(c.id) &&
        !s.objects.some(
          (o) =>
            o.bucket_id === c.storage_bucket &&
            o.name === c.vocabulary_card_path,
        ),
    ))
      if (!report.some((r) => r.cardId === c.id))
        report.push({
          path: c.vocabulary_card_path,
          status: "file missing",
          cardId: c.id,
          entryId: c.entry_id,
        });
    return report;
  }
  function applyMatches(s, id = () => crypto.randomUUID()) {
    const next = structuredClone(s);
    let changed = 0;
    for (const r of reconcile(next)) {
      if (r.status === "path mismatch") {
        const c = next.cards.find((c) => c.id === r.cardId);
        c.vocabulary_card_path = r.path;
        changed++;
      }
      if (r.status === "entry missing") {
        const object = next.objects.find(o => o.bucket_id === "man_vocabularyCard" && o.name === r.path);
        const parsed = object?.name.match(/^([a-z]+)[_+]([a-züv1-5-]+)\.(png|webp)$/i);
        const candidates = parsed && pinyinKey(parsed[2]) ? next.entries.filter(e => pinyinKey(e.pinyin) === pinyinKey(parsed[2]) && norm(e.meaning_en).toLowerCase().split(/[;,/]/).some(m=>m.trim().replace(/^to /,"")===parsed[1].toLowerCase())) : [];
        const records = next.cards.filter(c=>c.storage_bucket === "man_vocabularyCard" && c.vocabulary_card_path === r.path);
        if(candidates.length===1 && records.length===1 && !records[0].entry_id) { records[0].entry_id=candidates[0].id; changed++; }
      }
      if (r.status === "match available") {
        const e = next.entries.find((e) => e.id === r.entryId);
        next.cards.push({
          id: id(),
          entry_id: e.id,
          subject_text: e.hanzi,
          pinyin: e.pinyin,
          sense: r.path.split("_")[0],
          storage_bucket: "man_vocabularyCard",
          vocabulary_card_path: r.path,
          review_status: "pending",
          is_shared: false,
        });
        changed++;
      }
    }
    return { next, changed };
  }
  function cardErrors(s, entryId) {
    const e = s.entries.find((x) => x.id === entryId);
    if (!e) return ["Choose a word."];
    const r = s.research.find((x) => x.entry_id === e.id);
    const errors = [];
    if (!norm(e.pinyin) || !norm(e.meaning_en))
      errors.push("Pinyin and English meaning are required.");
    if (
      r?.verification_status !== "verified" ||
      !norm(r.verified_origin_en) ||
      !r.sources?.length
    )
      errors.push("Verified history and at least one source are required.");
    const components = s.components.filter((c) => c.entry_id === e.id);
    for (const c of components) {
      const part = s.entries.find((e) => e.id === c.component_entry_id);
      if (
        c.verification_status !== "verified" ||
        !c.role ||
        !part?.pinyin ||
        !part.meaning_en
      )
        errors.push("Each component needs verified role, pinyin and meaning.");
    }
    if (!norm(e.mnemonic))
      errors.push("Add an invented mnemonic, separate from history.");
    if (
      !e.illustration ||
      !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(
        e.illustration,
      )
    )
      errors.push("Import a PNG, JPEG or WebP illustration.");
    try {
      filename(e.filenameMeaning || e.meaning_en, e.pinyin);
    } catch (err) {
      errors.push(err.message);
    }
    return errors;
  }
  const xml = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&apos;",
        })[c],
    );
  function lines(text, width = 58) {
    const words = norm(text).split(/\s+/),
      out = [];
    for (const word of words) {
      if (!out.length || out[out.length - 1].length + word.length + 1 > width)
        out.push(word);
      else out[out.length - 1] += " " + word;
    }
    return out;
  }
  function renderCard(s, entryId) {
    const errors = cardErrors(s, entryId);
    if (errors.length) throw Error(errors.join("\n"));
    const e = s.entries.find((x) => x.id === entryId),
      r = s.research.find((x) => x.entry_id === entryId);
    let y = 580;
    const paragraphs = [];
    function paragraph(label, text) {
      paragraphs.push(
        `<text x="54" y="${y}" font-size="24" font-weight="bold">${xml(label)}</text>`,
      );
      y += 34;
      for (const line of lines(text)) {
        paragraphs.push(
          `<text x="54" y="${y}" font-size="22">${xml(line)}</text>`,
        );
        y += 32;
      }
      y += 22;
    }
    for (const c of s.components
      .filter((x) => x.entry_id === entryId)
      .sort((a, b) => a.position - b.position)) {
      const p = s.entries.find((x) => x.id === c.component_entry_id);
      paragraph(
        "Component: " + p.hanzi + " · " + p.pinyin + " · " + p.meaning_en,
        c.role + ": " + (c.explanation_en || "Verified component."),
      );
    }
    paragraph("History — verified", r.verified_origin_en);
    paragraph("Mnemonic — invented", e.mnemonic);
    if (e.example?.hanzi) {
      paragraph(
        "Example",
        e.example.hanzi + " · " + e.example.pinyin + " · " + e.example.meaning,
      );
    }
    paragraph(
      "Sources",
      r.sources
        .map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
        .join("; "),
    );
    return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="${y + 25}" viewBox="0 0 960 ${y + 25}"><rect width="960" height="100%" rx="30" fill="#fff7f0"/><g fill="#15135d" font-family="sans-serif"><text x="54" y="180" font-size="${e.hanzi.length > 3 ? 90 : 140}">${xml(e.hanzi)}</text><text x="54" y="255" font-size="44">${xml(e.pinyin)}</text><text x="54" y="315" font-size="32">${xml(e.meaning_en)}</text><text x="54" y="355" font-size="26">${xml(e.meaning_fr || "")}</text><image x="540" y="35" width="380" height="470" href="${e.illustration}"/>${paragraphs.join("")}</g></svg>`;
  }
  function promptErrors(s, entryId) {
    const e = s.entries.find((x) => x.id === entryId);
    if (!e) return ["Choose a word."];
    const r = s.research.find((x) => x.entry_id === entryId);
    const complete = (v) => !!norm(v) && !/^(unverified|to be written|tbd|unknown|null|n\/a)\b/i.test(norm(v));
    const errors = [];
    if (![e.hanzi, e.pinyin, e.meaning_en].every(complete)) errors.push("Hanzi, pinyin and English meaning are required.");
    const domains = new Set();
    for (const source of r?.sources || []) {
      let v = source;
      if (typeof v === "string" && v.startsWith("{")) {
        try { v = JSON.parse(v); } catch { continue; }
      }
      if (typeof v === "object" && v?.verified === false) continue;
      try {
        const u = new URL(typeof v === "string" ? v : v?.url || v?.reference);
        if (["http:", "https:"].includes(u.protocol)) domains.add(u.hostname.replace(/^www\./, ""));
      } catch {}
    }
    if (r?.verification_status !== "verified" || !complete(r.verified_origin_en) || domains.size < 2)
      errors.push("Verified history and two independent source URLs are required.");
    if (!complete(r?.formation_type)) errors.push("Record the character formation type.");
    if (!complete(e.mnemonic) || !["historical", "component", "invented"].includes(e.mnemonic_type))
      errors.push("Add a concrete memory trick and select its type.");
    const components = s.components.filter((x) => x.entry_id === entryId);
    if (!components.length && !r?.components_not_applicable) errors.push("Add verified components or explicitly mark decomposition not applicable.");
    for (const c of components) {
      const p = s.entries.find((x) => x.id === c.component_entry_id);
      if (c.verification_status !== "verified" || !["semantic","phonetic","both","visual_mnemonic"].includes(c.role) || ![p?.hanzi,p?.pinyin,p?.meaning_en,c.explanation_en].every(complete))
        errors.push("Each component needs verified role, Hanzi, pinyin, meaning and explanation.");
    }
    if (![e.example?.hanzi,e.example?.pinyin,e.example?.meaning].every(complete)) errors.push("Add a checked example sentence, pinyin and English translation.");
    return errors;
  }
  function researchPrompt(s, entryId) {
    const e = s.entries.find((x) => x.id === entryId);
    if (!e) throw Error("Choose a word.");
    return [
      "Research request ONLY — do not generate an image.",
      "Word: " + e.hanzi + " · " + e.pinyin + " · " + e.meaning_en,
      "Verify simplified/traditional forms, reading, meaning, formation type, historical origin, ancient forms and actual component roles. Cross-check at least two independent sources, prioritizing Outlier, CUHK, Dong Chinese, Chinese Etymology and Wiktionary. Give actual URLs and document uncertainty.",
      "Provide a vivid memory trick and label its type historical, component or invented; never confuse invention with history. Include a checked example sentence with pinyin and English. State explicitly when component decomposition is not applicable. Return research for manual review and entry in the local administration."
    ].join("\n");
  }
  function prompt(s, entryId) {
    const errors = promptErrors(s, entryId);
    if (errors.length) throw Error("Research Required: " + errors.join(" "));
    const e = s.entries.find((x) => x.id === entryId);
    const r = s.research.find((x) => x.entry_id === entryId);
    const components = s.components.filter((x) => x.entry_id === entryId).map(c => {
      const p = s.entries.find(x => x.id === c.component_entry_id);
      return { hanzi: p.hanzi, pinyin: p.pinyin, meaning: p.meaning_en, role: c.role, explanation: c.explanation_en };
    });
    return [
      "Create a DRAFT vocabulary card for " + e.hanzi + " (" + e.pinyin + "), meaning " + e.meaning_en + (e.meaning_fr ? "; French: " + e.meaning_fr : "") + ".",
      "Mandatory portrait orientation, 2:3 aspect ratio, target 1024 × 1536 pixels. Smartphone-readable vertical layout, very large correct Hanzi, tone-marked pinyin and meaning, generous margins and high contrast. No square or landscape cards.",
      "Formation type: " + r.formation_type,
      "Verified history: " + r.verified_origin_en,
      "Sources (research reference only; do not print lengthy URLs on artwork): " + JSON.stringify(r.sources),
      "Components: " + (components.length ? JSON.stringify(components) : "Decomposition not applicable."),
      "Memory trick (" + e.mnemonic_type + "; clearly separate from historical facts): " + e.mnemonic,
      "Example: " + e.example.hanzi + " · " + e.example.pinyin + " · " + e.example.meaning,
      "Vivid consistent watercolor illustration showing the memory trick. Use large component Hanzi, pinyin and meanings where relevant. Do not invent historical claims. Keep as Draft until explicit approval; never upload or publish automatically."
    ].join("\n");
  }
  const api = {
    norm,
    fold,
    numbered,
    pinyinKey,
    filename,
    search,
    validate,
    reconcile,
    applyMatches,
    cardErrors,
    renderCard,
    prompt,
    promptErrors,
    researchPrompt,
  };
  if (typeof module !== "undefined") module.exports = api;
  else root.AdminCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
