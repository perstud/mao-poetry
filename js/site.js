/* 普通脚本直接读取 poems.js，无需服务器或网络请求。 */
(() => {
  "use strict";
  const page = document.body.dataset.page, params = new URLSearchParams(location.search);
  const byId = id => document.getElementById(id);
  const input = byId("search");
  const periods = new Map(PERIODS.map(p => [p.key, p]));
  const collections = new Map(COLLECTIONS.map(c => [c.key, c]));
  const node = (tag, value, cls) => {
    const el = document.createElement(tag);
    if (value != null) el.textContent = value;
    if (cls) el.className = cls;
    return el;
  };
  const link = (text, href, cls) => Object.assign(node("a", text, cls), {href});
  // 少量异体字沿用底本字形，避免系统字体缺字。
  function rich(tag, value, cls, query = "", highlights) {
    const el = node(tag, null, cls);
    const append = (parent, text) => String(text).split(/(\{\{glyph:\d+\}\})/g).forEach(part => {
      const match = part.match(/^\{\{glyph:(\d+)\}\}$/);
      if (!match) { parent.append(document.createTextNode(part)); return; }
      const glyph = GLYPHS[match[1]], image = node("img", null, "source-glyph");
      image.src = glyph.src; image.alt = glyph.alt; parent.append(image);
    });
    let offset = 0;
    (highlights || (query ? matchRanges(indexText(value), query) : [])).forEach(([start, end]) => {
      append(el, value.slice(offset, start));
      const mark = node("mark");
      append(mark, value.slice(start, end)); el.append(mark); offset = end;
    });
    append(el, value.slice(offset));
    return el;
  }
  const normalize = s => s.replace(/\{\{glyph:(\d+)\}\}/g, (_, key) => GLYPHS[key].alt)
    .normalize("NFKC").toLowerCase().replace(/[\s\p{P}]+/gu, "");
  // 保留检索字符到原文的映射，高亮时不改动标点、空格或底本字形。
  function indexText(value) {
    let text = "";
    const starts = [], ends = [];
    for (const token of value.matchAll(/\{\{glyph:\d+\}\}|[\s\S]/gu)) {
      const normalized = normalize(token[0]);
      text += normalized;
      for (let i = 0; i < normalized.length; i++) {
        starts.push(token.index); ends.push(token.index + token[0].length);
      }
    }
    return {value, text, starts, ends};
  }
  function matchRanges(index, query) {
    const ranges = [];
    if (!query) return ranges;
    let pos = index.text.indexOf(query);
    while (pos !== -1) {
      const start = index.starts[pos], end = index.ends[pos + query.length - 1];
      const last = ranges[ranges.length - 1];
      if (last && start <= last[1]) last[1] = end;
      else ranges.push([start, end]);
      pos = index.text.indexOf(query, pos + query.length);
    }
    return ranges;
  }
  const searchIndex = new Map(POEMS.map(p => {
    const fields = [
      ["诗题", "poem-title", p.title],
      ["原文", "poem-text", p.parts.flatMap(part => part.lines).join("\n")],
      ...p.preface.map((t, i) => ["作者题记", "preface-" + i, t]),
      ...p.authorNotes.map((t, i) => ["作者原注", "note-" + i, t]),
      ...p.research.map((t, i) => ["编者考辨", "research-" + i, t])
    ];
    return [p.id, fields.map(([label, target, value]) => ({label, target, ...indexText(value)}))];
  }));
  const firstMatch = (p, query) => query && searchIndex.get(p.id).find(field => field.text.includes(query));
  function excerpt(field, query) {
    const at = field.text.indexOf(query);
    const start = field.starts[Math.max(0, at - 24)];
    const end = field.ends[Math.min(field.text.length - 1, at + query.length + 44)];
    return (start > 0 ? "…" : "") + field.value.slice(start, end) + (end < field.value.length ? "…" : "");
  }
  let period = periods.has(params.get("period")) ? params.get("period") : "";
  let collection = collections.has(params.get("collection")) ? params.get("collection") : "";
  if (input) input.value = params.get("q") || "";
  function url(file, values) {
    const query = new URLSearchParams(Object.entries(values).filter(([,v]) => v)).toString();
    return file + ".html" + (query ? "?" + query : "");
  }
  const filters = () => ({q:input.value.trim(), period, collection});
  const poemURL = p => {
    const hit = firstMatch(p, normalize(input.value));
    return url("detail", {id:p.id, ...filters()}) + (hit ? "#" + hit.target : "");
  };
  const matches = () => {
    const q = normalize(input.value);
    return POEMS.filter(p => (!period || p.period === period) && (!collection || p.collection === collection) &&
      (!q || firstMatch(p, q)));
  };
  const count = poems => poems.length + " 篇 · " + poems.reduce((total, p) => total + p.count, 0) + " 首";
  function renderIndex() {
    const q = normalize(input.value);
    if (page === "index") {
      byId("home-results").hidden = !input.value.trim();
      if (byId("home-results").hidden) return;
    }
    const hits = matches();
    byId("summary").textContent = "共 " + count(hits) + (period ? " · " + periods.get(period).name : "");
    const list = byId("list");
    list.replaceChildren();
    if (!hits.length) {
      const empty = node("div", null, "empty");
      empty.append(node("h3","未找到对应篇目"));
      const reset = node("button", "查看全部篇目", "secondary");
      reset.onclick = () => { if (page === "index") location.href = "library.html"; else { input.value = ""; collection = ""; setPeriod(""); input.focus(); } };
      empty.append(reset); list.append(empty); return;
    }
    for (const era of COLLECTIONS) {
      const group = hits.filter(p => p.collection === era.key);
      if (!group.length) continue;
      const section = node("section", null, "group");
      section.append(node("h2",era.name), node("small",count(group)));
      group.forEach(p => {
        const row = link("", poemURL(p), "poem-row");
        const hit = firstMatch(p, q), preview = node("span", null, "search-preview");
        if (hit) preview.append(node("small", hit.label, "match-source"), rich("span", excerpt(hit, q), "match-excerpt", q));
        else preview.append(rich("span", p.lines[0]));
        row.append(rich("strong",p.title,null,q), preview, node("small", p.date), node("b","→"));
        section.append(row);
      });
      list.append(section);
    }
  }
  // 同步地址栏便于分享或返回；连续输入不产生一串历史记录。
  function syncLibrary() {
    const target = url("library", filters());
    try { history.replaceState(null, "", target); } catch { /* 部分浏览器限制 file: 历史 API；筛选仍然生效。 */ }
  }
  function setPeriod(key) {
    period = key;
    byId("filters").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.key === key)));
    byId("collections").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.key === collection)));
    syncLibrary(); renderIndex();
  }
  if (page === "index") {
    PERIODS.filter(p => p.key !== "undated").forEach((p,i) => {
      const item = link("",url("library",{period:p.key}),"era");
      item.append(node("small",String(i+1).padStart(2,"0")),node("strong",p.name),node("span",p.years));
      byId("timeline").append(item);
    });
    [["changsha","river","问苍茫大地，谁主沉浮？"],["loushanguan","peaks","雄关漫道真如铁，而今迈步从头越。"],["xue","valley","江山如此多娇，引无数英雄竞折腰。"]].forEach(([id,art,quote],i) => {
      const p = POEMS.find(x => x.id === id);
      if (!p) return;
      const card = link("",url("detail",{id}),"quote");
      const pic = node("div", null, "picture " + art);
      pic.append(node("span","选句 / 0" + (i+1)));
      const body = node("div",null,"caption");
      body.append(node("small",p.date + " · " + periods.get(p.period).name),node("h3",quote),node("span",p.title + "　→"));
      card.append(pic,body); byId("quotes").append(card);
    });
    const works = new Map(POEMS.map(p => [p.id,p]));
    let quoteTotal = byId("quotes").childElementCount;
    QUOTE_SECTIONS.forEach(([theme, worksInTheme], i) => {
      const section = node("section",null,"quote-section");
      section.id = "quote-theme-" + (i+1);
      byId("quote-topics").append(link(theme,"#" + section.id));
      const head = node("div",null,"section-head");
      head.append(node("h3",theme),link("回到主题目录 ↑","#quote-topics"));
      const list = node("ul",null,"quote-lines");
      worksInTheme.forEach(([id,...excerpts]) => {
        const p = works.get(id);
        excerpts.forEach(excerpt => {
          const item = node("li"), row = link("",url("detail",{id}));
          const part = p.parts.length > 1 && p.parts.find(part =>
            part.lines.join("").replaceAll("（原注）","").includes(excerpt));
          row.append(rich("span",excerpt),node("small","《" + p.title + "》" + (part ? part.label : "") + "　→"));
          item.append(row); list.append(item);
        });
      });
      section.append(head,list); byId("quote-sections").append(section);
      quoteTotal += list.childElementCount;
    });
    byId("quote-total").textContent = "共 " + quoteTotal + " 则";
  } else if (page === "library") {
    [{key:"",name:"全编"},...COLLECTIONS].forEach(c => {
      const b = node("button",c.name);
      b.type = "button"; b.dataset.key = c.key;
      b.setAttribute("aria-pressed",String(collection === c.key));
      b.onclick = () => { collection = c.key; setPeriod(period); };
      byId("collections").append(b);
    });
    [{key:"",name:"全部时期"},...PERIODS].forEach(p => {
      const b = node("button",p.name);
      b.dataset.key = p.key; b.setAttribute("aria-pressed",String(period === p.key));
      b.onclick = () => setPeriod(p.key); byId("filters").append(b);
    });
  } else if (page === "detail") {
    const p = POEMS.find(x => x.id === params.get("id"));
    const article = byId("reading");
    const back = link("← 返回诗词文库",url("library",filters()),"back");
    if (!p) article.append(node("h1","未找到该篇目"),back);
    else {
      const query = normalize(params.get("q") || "");
      const marked = (tag, value, cls) => rich(tag, value, cls, query);
      document.title = p.title + " · 教员诗词学习网";
      const title = marked("h1",p.title); title.id = "poem-title";
      article.append(node("div",collections.get(p.collection).name + " · 原文" + (p.count > 1 ? " · " + p.count + "首" : ""),"kicker"),
        title,node("p","教员","author"),node("p",p.originalDate,"metadata"));
      if (p.preface.length) {
        const preface = node("div",null,"preface");
        preface.setAttribute("aria-label","作者题记");
        p.preface.forEach((t,i) => {
          const paragraph = marked("p",t); paragraph.id = "preface-" + i; preface.append(paragraph);
        }); article.append(preface);
      }
      const text = node("div",null,"verse");
      text.id = "poem-text";
      const verseRanges = matchRanges(searchIndex.get(p.id)[1], query);
      let verseOffset = 0;
      p.parts.forEach(part => {
        const section = node("section",null,"poem-part");
        if (part.label) section.append(node("h2",part.label,"part-title"));
        part.lines.forEach(l => {
          const ranges = verseRanges.filter(([start,end]) => start < verseOffset + l.length && end > verseOffset)
            .map(([start,end]) => [Math.max(0,start - verseOffset),Math.min(l.length,end - verseOffset)]);
          section.append(rich("p",l,l ? "" : "break",query,ranges));
          verseOffset += l.length + 1;
        });
        text.append(section);
      });
      article.append(text);
      if (p.authorNotes.length) {
        const notes = node("section",null,"author-notes");
        notes.append(node("h2","作者原注"));
        p.authorNotes.forEach((t,i) => {
          const paragraph = marked("p",t); paragraph.id = "note-" + i; notes.append(paragraph);
        }); article.append(notes);
      }
      const context = node("details",null,"context research");
      context.append(node("summary","编者考辨"),node("p","选自《毛泽东诗词全编鉴赏》（增订本）","research-credit"));
      p.research.forEach((t,i) => {
        const paragraph = marked("p",t); paragraph.id = "research-" + i; context.append(paragraph);
      });
      context.open = !!context.querySelector("mark"); article.append(context);
      const sequence = matches(), index = sequence.findIndex(x => x.id === p.id);
      const adjacent = node("nav",null,"adjacent");
      adjacent.setAttribute("aria-label","相邻篇目");
      if (index > 0) adjacent.append(link("← " + sequence[index-1].title,poemURL(sequence[index-1]),"previous"));
      if (index >= 0 && index < sequence.length-1) adjacent.append(link(sequence[index+1].title + " →",poemURL(sequence[index+1]),"next"));
      article.append(adjacent,back);
      const hit = firstMatch(p, query);
      const requested = byId(location.hash.slice(1));
      const target = requested && article.contains(requested) ? requested : hit && byId(hit.target);
      if (target) {
        const details = target.closest("details");
        if (details) details.open = true;
        requestAnimationFrame(() => {
          const focus = target.querySelector("mark") || target;
          focus.tabIndex = -1; focus.focus({preventScroll:true}); focus.scrollIntoView({block:"center"});
        });
      }
    }
  }
  if (page === "library" || page === "index") {
    renderIndex();
    input.addEventListener("input",() => { if (page === "library") syncLibrary(); renderIndex(); });
    if (page === "library") input.form.onsubmit = e => { e.preventDefault(); syncLibrary(); renderIndex(); };
  }
})();
