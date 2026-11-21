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
  function rich(tag, value, cls) {
    const el = node(tag, null, cls);
    String(value).split(/(\{\{glyph:\d+\}\})/g).forEach(part => {
      const match = part.match(/^\{\{glyph:(\d+)\}\}$/);
      if (!match) { el.append(document.createTextNode(part)); return; }
      const glyph = GLYPHS[match[1]], image = node("img", null, "source-glyph");
      image.src = glyph.src; image.alt = glyph.alt; el.append(image);
    });
    return el;
  }
  const normalize = s => s.replace(/\{\{glyph:(\d+)\}\}/g, (_, key) => GLYPHS[key].alt)
    .normalize("NFKC").toLowerCase().replace(/[\s\p{P}]+/gu, "");
  let period = periods.has(params.get("period")) ? params.get("period") : "";
  let collection = collections.has(params.get("collection")) ? params.get("collection") : "";
  if (input) input.value = params.get("q") || "";
  function url(file, values) {
    const query = new URLSearchParams(Object.entries(values).filter(([,v]) => v)).toString();
    return file + ".html" + (query ? "?" + query : "");
  }
  const filters = () => ({q:input.value.trim(), period, collection});
  const poemURL = p => url("detail", {id:p.id, ...filters()});
  const matches = () => {
    const q = normalize(input.value);
    return POEMS.filter(p => (!period || p.period === period) && (!collection || p.collection === collection) &&
      (normalize(p.title).includes(q) || normalize(p.lines.join("")).includes(q)));
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
        row.append(rich("strong",p.title), rich("span",p.lines.find(l => l && normalize(l).includes(q)) || p.lines[0]), node("small", p.date), node("b","→"));
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
      document.title = p.title + " · 毛主席诗词学习网";
      article.append(node("div",collections.get(p.collection).name + " · 原文" + (p.count > 1 ? " · " + p.count + "首" : ""),"kicker"),
        rich("h1",p.title),node("p","毛泽东","author"),node("p",p.originalDate,"metadata"));
      if (p.preface.length) {
        const preface = node("div",null,"preface");
        preface.setAttribute("aria-label","作者题记");
        p.preface.forEach(t => preface.append(rich("p",t))); article.append(preface);
      }
      const text = node("div",null,"verse");
      p.parts.forEach(part => {
        const section = node("section",null,"poem-part");
        if (part.label) section.append(node("h2",part.label,"part-title"));
        part.lines.forEach(l => section.append(rich("p",l,l ? "" : "break")));
        text.append(section);
      });
      article.append(text);
      if (p.authorNotes.length) {
        const notes = node("section",null,"author-notes");
        notes.append(node("h2","作者原注"));
        p.authorNotes.forEach(t => notes.append(rich("p",t))); article.append(notes);
      }
      const context = node("details",null,"context research");
      context.append(node("summary","编者考辨"),node("p","选自《毛泽东诗词全编鉴赏》（增订本）","research-credit"));
      p.research.forEach(t => context.append(rich("p",t))); article.append(context);
      const sequence = matches(), index = sequence.findIndex(x => x.id === p.id);
      const adjacent = node("nav",null,"adjacent");
      adjacent.setAttribute("aria-label","相邻篇目");
      if (index > 0) adjacent.append(link("← " + sequence[index-1].title,poemURL(sequence[index-1]),"previous"));
      if (index >= 0 && index < sequence.length-1) adjacent.append(link(sequence[index+1].title + " →",poemURL(sequence[index+1]),"next"));
      article.append(adjacent,back);
    }
  }
  if (page === "library" || page === "index") {
    renderIndex();
    input.addEventListener("input",() => { if (page === "library") syncLibrary(); renderIndex(); });
    if (page === "library") input.form.onsubmit = e => { e.preventDefault(); syncLibrary(); renderIndex(); };
  }
})();
