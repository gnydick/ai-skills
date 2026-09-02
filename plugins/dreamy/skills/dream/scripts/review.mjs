#!/usr/bin/env node
// review.mjs — the Memory Improvement Overview as a live form.
//
//   node review.mjs render --home <dir> [--out <file>]
//       Parse <home>/improve-memory/Memory Improvement Overview.md and write a
//       self-contained page (default <home>/dream/review.html) whose flagged
//       items are real checkboxes. Published as a claude.ai artifact with the
//       `artifact` capability, the page saves ticks by republishing itself
//       with the ticks embedded in its data block; opened from disk it still
//       renders, read-only.
//
//   node review.mjs sync --home <dir> --page <downloaded html>
//       Read the ticks out of a published page (the data block the page
//       embeds) and set `[x]` on the matching open items in the overview
//       file. Additive only: a tick made in the file stays, so a stale page
//       cannot undo an approval. Prints what changed as JSON.
//
// The overview file stays the source of truth; the page is a front end that
// syncs into it. Item keys are `F<n>@run<N>`, the same as runlog.mjs uses.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = { home: path.join(os.homedir(), ".claude"), out: null, page: null };
for (let i = 1; i < argv.length; i++) {
  const a = argv[i], next = () => { if (i + 1 >= argv.length) die(`${a} needs a value`); return argv[++i]; };
  if (a === "--home") opt.home = path.resolve(next());
  else if (a === "--out") opt.out = path.resolve(next());
  else if (a === "--page") opt.page = path.resolve(next());
  else die(`unknown option ${a}`);
}
function die(m) { console.error(`review: ${m}`); process.exit(2); }

const OVERVIEW = path.join(opt.home, "improve-memory", "Memory Improvement Overview.md");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- markdown (the subset the overview uses) ----------
function md(src) {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  let out = [], i = 0, list = null;
  const inline = (t) => esc(t).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*\w])_([^_\n]+)_(?!\w)/g, "$1<em>$2</em>").replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>');
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*```/.test(l)) { closeList(); const buf = []; i++; while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]); i++; out.push(`<pre>${esc(buf.join("\n"))}</pre>`); continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h) { closeList(); const lv = Math.min(h[1].length + 2, 6); out.push(`<h${lv}>${inline(h[2])}</h${lv}>`); i++; continue; }
    const li = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(l);
    if (li) { const kind = /^\s*\d/.test(l) ? "ol" : "ul"; if (list !== kind) { closeList(); out.push(`<${kind}>`); list = kind; } let item = li[1]; while (i + 1 < lines.length && /^\s{2,}\S/.test(lines[i + 1]) && !/^\s*(?:[-*]|\d+\.)\s/.test(lines[i + 1])) item += " " + lines[++i].trim(); out.push(`<li>${inline(item)}</li>`); i++; continue; }
    if (/^\s*$/.test(l)) { closeList(); i++; continue; }
    closeList(); const para = []; while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6}\s|\s*```|\s*(?:[-*]|\d+\.)\s)/.test(lines[i])) para.push(lines[i++]); out.push(`<p>${inline(para.join(" "))}</p>`);
  }
  closeList();
  return out.join("\n");
}

// ---------- overview → model ----------
function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text); const fm = {};
  if (m) for (const l of m[1].split("\n")) { const k = /^([\w-]+):\s*(.*)$/.exec(l); if (k) fm[k[1]] = k[2]; }
  return { fm, body: m ? text.slice(m[0].length) : text };
}

function parseOverview(text) {
  const { fm, body } = frontmatter(text.replace(/\r\n/g, "\n"));
  const lines = body.split("\n");
  const model = { title: "", fm, intro: "", applied: [], groups: [], notActed: "", notes: "", ticked: [], savedAt: null };
  let section = null, group = null, block = [], item = null, appliedHead = null;
  const flushBlock = () => {
    const text = block.join("\n").trim(); block = [];
    if (!text) return;
    if (section === "intro") model.intro += md(text);
    else if (section === "applied") { if (appliedHead) model.applied.push({ heading: appliedHead, html: md(text) }); else model.intro += md(text); }
    else if (section === "approval") { if (group) group.intro += md(text); }
    else if (section === "notActed") model.notActed += md(text);
    else if (section === "notes") model.notes += md(text);
  };
  const flushItem = () => { if (!item) return; finishItem(item); group.items.push(item); item = null; };
  for (const raw of lines) {
    const l = raw;
    if (!model.title && /^# /.test(l)) { model.title = l.slice(2).trim(); section = "intro"; continue; }
    const h2 = /^## (.*)$/.exec(l);
    if (h2) { flushItem(); flushBlock(); const t = h2[1].trim(); section = /^Applied/i.test(t) ? "applied" : /^Needs your approval/i.test(t) ? "approval" : /^Not acted/i.test(t) ? "notActed" : /^(Pass notes|Notes)/i.test(t) ? "notes" : /^Dropped/i.test(t) ? "notActed" : "other"; appliedHead = null; group = null; if (section === "notActed" && /^Dropped/i.test(t)) block.push(`### ${t}`); continue; }
    const h3 = /^### (.*)$/.exec(l);
    if (h3) { flushItem(); flushBlock(); if (section === "applied") appliedHead = h3[1].trim(); else if (section === "approval") { group = { title: h3[1].trim(), intro: "", items: [] }; model.groups.push(group); } else block.push(l); continue; }
    const it = /^- \[([ xX])\] \*\*(F\d+)\*\*(.*)$/.exec(l);
    if (it && section === "approval") {
      flushItem(); flushBlock();
      if (!group) { group = { title: "Items", intro: "", items: [] }; model.groups.push(group); }
      const since = /since run (\d+)/i.exec(it[3]);
      item = { id: it[2], key: `${it[2]}@run${since ? since[1] : fm.run || "?"}`, meta: it[3].replace(/^\s*·\s*/, "").trim(), ticked: it[1] !== " ", lines: [], action: null, inAction: false };
      continue;
    }
    if (item) {
      if (/^\s*```action/.test(l)) { item.inAction = true; item.action = []; continue; }
      if (item.inAction) { if (/^\s*```\s*$/.test(l)) { item.inAction = false; continue; } item.action.push(l.replace(/^  /, "")); continue; }
      if (/^\s*$/.test(l) && item.lines.length && item.action) { flushItem(); continue; }
      item.lines.push(l.replace(/^  /, ""));
      continue;
    }
    block.push(l);
  }
  flushItem(); flushBlock();
  model.ticked = model.groups.flatMap((g) => g.items.filter((i) => i.ticked).map((i) => i.key));
  return model;
}
function finishItem(item) {
  item.body = md(item.lines.join("\n"));
  item.action = item.action ? item.action.join("\n").trim() : "";
  const kindM = /·\s*(decision|reversal|promote|edit|cut|cross-duplicate|proposal)\b/i.exec(item.meta);
  item.kind = kindM ? kindM[1].toLowerCase() : "item";
  const parts = item.meta.split("·").map((s) => s.trim()).filter(Boolean);
  item.project = parts[0] || "";
  delete item.lines; delete item.inAction;
}

// ---------- page ----------
const FONTS = "https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";
const CSS = `
:root{--bg:#F5F7F4;--card:#FCFDFB;--ink:#1B211E;--muted:#5F6A65;--line:#D9DFDA;--accent:#0E6B67;--accent-ink:#FFFFFF;--ok:#2E7D4F;--warn:#9A6A00;--code:#EDF1EC;--tick:#0E6B67}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#141917;--card:#1B221F;--ink:#E4EAE6;--muted:#97A39D;--line:#2C3531;--accent:#5BB8B2;--accent-ink:#0F1A19;--ok:#6CC38E;--warn:#E0B24D;--code:#222B27;--tick:#5BB8B2}}
:root[data-theme="dark"]{--bg:#141917;--card:#1B221F;--ink:#E4EAE6;--muted:#97A39D;--line:#2C3531;--accent:#5BB8B2;--accent-ink:#0F1A19;--ok:#6CC38E;--warn:#E0B24D;--code:#222B27;--tick:#5BB8B2}
*{box-sizing:border-box}html{font-size:17px}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"IBM Plex Sans",-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.5}
a{color:var(--accent)}code,pre,.mono{font-family:"IBM Plex Mono",ui-monospace,Consolas,monospace}
code{font-size:.9em;background:var(--code);padding:.05rem .3rem;border-radius:3px;overflow-wrap:anywhere}pre{background:var(--code);padding:.7rem .9rem;border-radius:6px;overflow-x:auto;font-size:.86rem;line-height:1.45;margin:.5rem 0}
h1,h2{font-family:"Source Serif 4",Georgia,"Times New Roman",serif;font-weight:600;text-wrap:balance;letter-spacing:-.01em}
h1{font-size:1.75rem;margin:0 0 .3rem}h2{font-size:1.35rem;margin:2.2rem 0 .4rem}h3,h4,h5,h6{font-size:1.05rem;margin:1.2rem 0 .3rem}
.layout{display:grid;grid-template-columns:230px minmax(0,1fr);gap:2.5rem;max-width:1180px;margin:0 auto;padding:1.5rem 1.5rem 7rem}
@media (max-width:900px){.layout{grid-template-columns:1fr;gap:1rem}.rail{position:static}}
.rail{position:sticky;top:1rem;align-self:start;font-size:.92rem}
.rail .counts{display:grid;grid-template-columns:auto 1fr;gap:.2rem .7rem;margin:.8rem 0 1.2rem;font-variant-numeric:tabular-nums}.rail .counts b{font-size:1.35rem;font-family:"Source Serif 4",serif;font-weight:600;line-height:1.1}.rail .counts span{color:var(--muted);align-self:end;padding-bottom:.15rem}
.rail nav a{display:block;color:var(--muted);text-decoration:none;padding:.18rem 0;border-left:2px solid transparent;padding-left:.6rem}.rail nav a:hover,.rail nav a:focus-visible{color:var(--ink);border-left-color:var(--accent);outline:none}
.rail .filters{display:flex;gap:.3rem;margin:1rem 0}.rail .filters button{font:inherit;font-size:.85rem;padding:.2rem .6rem;border:1px solid var(--line);background:var(--card);color:var(--muted);border-radius:999px;cursor:pointer}.rail .filters button[aria-pressed="true"]{color:var(--accent-ink);background:var(--accent);border-color:var(--accent)}
.rail .filters button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.eyebrow{font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.intro{color:var(--muted);max-width:72ch}.intro p{margin:.4rem 0}
main{max-width:72ch;min-width:0}
details.applied{border-top:1px solid var(--line);padding:.5rem 0}details.applied summary{cursor:pointer;font-weight:500;color:var(--ok)}details.applied summary::marker{color:var(--muted)}details.applied ul{padding-left:1.2rem}
.group-intro{color:var(--muted);font-size:.95rem}
.item{display:grid;grid-template-columns:2rem minmax(0,1fr);gap:.2rem .9rem;padding:1rem 0;border-top:1px solid var(--line)}.item:last-child{border-bottom:1px solid var(--line)}
.item.hide{display:none}
.item input[type=checkbox]{width:1.45rem;height:1.45rem;margin:.15rem 0 0;accent-color:var(--tick);cursor:pointer}.item input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.item .head{display:flex;flex-wrap:wrap;gap:.35rem .6rem;align-items:baseline}.item .id{font-family:"IBM Plex Mono",monospace;font-weight:500;color:var(--accent)}
.chip{font-size:.78rem;padding:.05rem .5rem;border-radius:999px;border:1px solid var(--line);color:var(--muted);white-space:nowrap}.chip.decision{color:var(--warn);border-color:var(--warn)}.chip.reversal{color:var(--warn);border-color:var(--warn)}
.item .body{grid-column:2}.item .body p{margin:.3rem 0}.item.ticked .body{opacity:.75}
.item details{grid-column:2;margin-top:.3rem}.item summary{cursor:pointer;color:var(--muted);font-size:.9rem}.item details[open] summary{color:var(--ink)}
.item .saved{grid-column:2;font-size:.82rem;color:var(--ok)}
.savebar{position:fixed;left:0;right:0;bottom:0;display:flex;justify-content:center;pointer-events:none;padding:1rem}.savebar[hidden]{display:none}
.savebar div{pointer-events:auto;display:flex;gap:.8rem;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:.6rem .6rem .6rem 1.1rem;box-shadow:0 8px 30px rgba(0,0,0,.12)}
.savebar button{font:inherit;font-weight:600;padding:.45rem 1rem;border-radius:7px;border:0;background:var(--accent);color:var(--accent-ink);cursor:pointer}.savebar button:disabled{opacity:.6;cursor:default}.savebar button:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.savebar .status{color:var(--muted);font-size:.9rem}
.notice{margin:.8rem 0;padding:.6rem .9rem;border:1px solid var(--line);border-radius:7px;background:var(--card);color:var(--muted);font-size:.92rem}.notice[hidden]{display:none}
section.misc{color:var(--muted);font-size:.93rem}section.misc h3{color:var(--ink)}
@media (prefers-reduced-motion: no-preference){.savebar div{animation:rise .18s ease-out}@keyframes rise{from{transform:translateY(6px);opacity:0}}}
`;

// The page's script. Captured verbatim into the republished document, so
// everything the page needs to rebuild itself lives in here plus the model.
const PAGE_JS = String.raw`
const SRC = document.currentScript.textContent;
const FONTS = ${JSON.stringify(FONTS)};
const model = JSON.parse(document.getElementById("model").textContent);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ticked = new Set(model.ticked);
const initial = new Set(model.ticked);
const open = model.groups.flatMap((g) => g.items);
const fmtWhen = (iso) => iso ? new Date(iso).toLocaleString() : null;

function itemHtml(it) {
  const on = ticked.has(it.key);
  return '<div class="item' + (on ? " ticked" : "") + '" data-key="' + esc(it.key) + '">' +
    '<input type="checkbox" id="cb-' + esc(it.id) + '" aria-label="Approve ' + esc(it.id) + '"' + (on ? " checked" : "") + '>' +
    '<div class="head"><label class="id" for="cb-' + esc(it.id) + '">' + esc(it.id) + '</label>' +
    '<span class="chip ' + esc(it.kind) + '">' + esc(it.kind) + '</span>' +
    (it.project ? '<span class="chip">' + esc(it.project) + '</span>' : "") +
    '<span class="chip">' + esc(it.meta.split("·").slice(1).map((s) => s.trim()).filter((s) => s && !/^(decision|reversal|promote|edit|cut|cross-duplicate|proposal)$/i.test(s)).join(" · ")) + '</span></div>' +
    '<div class="body">' + it.body + '</div>' +
    (it.action ? '<details><summary>What approving does</summary><pre>' + esc(it.action) + '</pre></details>' : "") +
    (initial.has(it.key) ? '<div class="saved">approved</div>' : "") +
    '</div>';
}

function render() {
  const counts = { open: open.length, ticked: ticked.size, applied: model.applied.reduce((n, a) => n + (a.html.match(/<li>/g) || []).length, 0) };
  // Render into a container, never over the body: the style and data blocks
  // beside it are what buildDoc regenerates the page from on save.
  const app = document.getElementById("app") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "app" }));
  app.innerHTML =
    '<div class="layout"><aside class="rail"><div class="eyebrow">Memory improvement</div>' +
    '<div class="counts"><b>' + counts.applied + '</b><span>changes applied</span><b>' + counts.open + '</b><span>need you</span><b id="tickedCount">' + counts.ticked + '</b><span>approved</span></div>' +
    '<div class="filters" role="group" aria-label="Show"><button aria-pressed="true" data-f="all">All</button><button aria-pressed="false" data-f="open">Unticked</button><button aria-pressed="false" data-f="ticked">Ticked</button></div>' +
    '<nav>' + model.groups.map((g, i) => '<a href="#g' + i + '">' + esc(g.title) + ' <span class="mono">' + g.items.length + '</span></a>').join("") + '<a href="#applied">Applied</a><a href="#notes">Notes</a></nav>' +
    (model.savedAt ? '<p class="eyebrow" style="margin-top:1.2rem">Saved ' + esc(fmtWhen(model.savedAt)) + '</p>' : "") +
    '</aside><main>' +
    '<h1>' + esc(model.title) + '</h1><div class="intro">' + model.intro + '</div>' +
    '<div class="notice" id="notice" hidden></div>' +
    model.groups.map((g, i) => '<section id="g' + i + '"><h2>' + esc(g.title) + '</h2>' + (g.intro ? '<div class="group-intro">' + g.intro + '</div>' : "") + g.items.map(itemHtml).join("") + '</section>').join("") +
    '<section id="applied"><h2>Applied this run</h2>' + model.applied.map((a) => '<details class="applied"><summary>' + esc(a.heading.replace(/\s*\(\x60.*$/, "")) + '</summary>' + a.html + '</details>').join("") + '</section>' +
    '<section id="notes" class="misc"><h2>Not acted on</h2>' + model.notActed + '<h2>Pass notes</h2>' + model.notes + '</section>' +
    '</main></div>' +
    '<div class="savebar" id="savebar" hidden><div><span class="status" id="savestatus"></span><button id="save">Save approvals</button></div></div>';
  document.querySelectorAll(".item input").forEach((cb) => cb.addEventListener("change", onToggle));
  document.querySelectorAll(".filters button").forEach((b) => b.addEventListener("click", () => setFilter(b.dataset.f)));
  document.getElementById("save").addEventListener("click", save);
  updateBar();
}

let filter = "all";
function setFilter(f) { filter = f; document.querySelectorAll(".filters button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.f === f))); document.querySelectorAll(".item").forEach((el) => { const on = ticked.has(el.dataset.key); el.classList.toggle("hide", filter === "open" ? on : filter === "ticked" ? !on : false); }); }
function onToggle(e) { const el = e.target.closest(".item"); if (e.target.checked) ticked.add(el.dataset.key); else ticked.delete(el.dataset.key); el.classList.toggle("ticked", e.target.checked); document.getElementById("tickedCount").textContent = ticked.size; updateBar(); }
function dirty() { if (ticked.size !== initial.size) return true; for (const k of ticked) if (!initial.has(k)) return true; return false; }
function updateBar() { const bar = document.getElementById("savebar"); const d = dirty(); bar.hidden = !d; if (d) { const added = [...ticked].filter((k) => !initial.has(k)).length, removed = [...initial].filter((k) => !ticked.has(k)).length; document.getElementById("savestatus").textContent = (added ? added + " new approval" + (added === 1 ? "" : "s") : "") + (added && removed ? ", " : "") + (removed ? removed + " withdrawn" : ""); } }

function buildDoc(m) {
  const json = JSON.stringify(m).replace(/<\//g, "<\\/");
  const css = document.getElementById("css").textContent;
  return "<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" + esc(m.title) + "</title><link rel=\"stylesheet\" href=\"" + FONTS + "\"><style id=\"css\">" + css + "</style></head><body>" +
    "<div id=\"app\"></div><script id=\"model\" type=\"application/json\">" + json + "<\/script><script>" + SRC + "<\/script></body></html>";
}

let artifact = null, artifactState = "pending";
window.claude?.use?.("artifact").then((a) => { artifact = a; artifactState = a ? "ready" : "none"; if (!a) showNotice("This copy cannot save. Open the page from your claude.ai account to tick boxes here, or tick the [ ] in the overview file directly."); }).catch(() => { artifactState = "none"; });

function showNotice(text) { const n = document.getElementById("notice"); n.textContent = text; n.hidden = !text; }

async function save() {
  const btn = document.getElementById("save"); btn.disabled = true; btn.textContent = "Saving…";
  if (!artifact) { btn.disabled = false; btn.textContent = "Save approvals"; showNotice(artifactState === "pending" ? "Still connecting to claude.ai — try again in a moment." : "This copy cannot save. Open the page from your claude.ai account, or tick the [ ] in the overview file directly."); return; }
  const next = Object.assign({}, model, { ticked: [...ticked], savedAt: new Date().toISOString() });
  try { sessionStorage.setItem("dream-review-pending", JSON.stringify(next.ticked)); } catch {}
  try {
    await artifact.publish(buildDoc(next));
    btn.textContent = "Saved";
  } catch (e) {
    btn.disabled = false; btn.textContent = "Save approvals";
    const code = e && e.code;
    if (code === "conflict") showNotice("Someone saved a newer version first; reloading to it. Your ticks are kept in this tab — re-apply them if they are missing.");
    else if (code === "not_writer" || code === "not_granted" || code === "not_declared") { showNotice("This view is read-only, so ticks cannot be saved here. Tick the [ ] in the overview file instead."); document.querySelectorAll(".item input").forEach((cb) => (cb.disabled = true)); }
    else if (code === "rate_limited") showNotice("Saving too often; wait a few seconds and save once.");
    else showNotice("Could not save (" + (code || "error") + "). Try once more; if it fails again, tick the [ ] in the overview file.");
  }
}

render();
try { const pend = JSON.parse(sessionStorage.getItem("dream-review-pending") || "null"); if (pend && !dirty()) { for (const k of pend) if (open.some((i) => i.key === k) && !ticked.has(k)) { ticked.add(k); const el = document.querySelector('.item[data-key="' + k.replace(/"/g, '\\"') + '"]'); if (el) { el.querySelector("input").checked = true; el.classList.add("ticked"); } } document.getElementById("tickedCount").textContent = ticked.size; updateBar(); } sessionStorage.removeItem("dream-review-pending"); } catch {}
`;

function renderPage(model) {
  const json = JSON.stringify(model).replace(/<\//g, "<\\/");
  // No doctype/html/head/body: the Artifact tool wraps this fragment on first
  // publish; the page's own republishes build the full document themselves.
  return `<title>${esc(model.title)}</title>\n<link rel="stylesheet" href="${FONTS}">\n<style id="css">${CSS}</style>\n<div id="app"></div>\n<script id="model" type="application/json">${json}</script>\n<script>${PAGE_JS}</script>\n`;
}

// ---------- commands ----------
function render() {
  const text = fs.readFileSync(OVERVIEW, "utf8");
  const model = parseOverview(text);
  model.title = model.title || "Memory Improvement Overview";
  const out = opt.out || path.join(opt.home, "dream", "review.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, renderPage(model));
  console.log(JSON.stringify({ out, title: model.title, groups: model.groups.map((g) => ({ title: g.title, items: g.items.length })), open: model.groups.reduce((n, g) => n + g.items.length, 0), ticked: model.ticked.length, applied: model.applied.length, bytes: fs.statSync(out).size }, null, 2));
}

function sync() {
  if (!opt.page) die("sync needs --page <downloaded html>");
  const html = fs.readFileSync(opt.page, "utf8");
  const m = /<script id="model" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) die("no data block in the page; is this a review page?");
  const page = JSON.parse(m[1].replace(/<\\\//g, "</"));
  const pageTicked = new Set(page.ticked || []);
  const text = fs.readFileSync(OVERVIEW, "utf8");
  const eol = /\r\n/.test(text) ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const run = frontmatter(text.replace(/\r\n/g, "\n")).fm.run;
  const synced = [], alreadyInFile = [], untickedOnPage = [];
  let inApproval = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^## /.test(l)) { inApproval = /^## Needs your approval/i.test(l); continue; }
    if (!inApproval) continue;
    const it = /^- \[([ xX])\] \*\*(F\d+)\*\*(.*)$/.exec(l);
    if (!it) continue;
    const since = /since run (\d+)/i.exec(it[3]);
    const key = `${it[2]}@run${since ? since[1] : run || "?"}`;
    const fileTicked = it[1] !== " ";
    if (pageTicked.has(key) && !fileTicked) { lines[i] = l.replace(/^- \[ \]/, "- [x]"); synced.push(key); }
    else if (pageTicked.has(key) && fileTicked) alreadyInFile.push(key);
    else if (!pageTicked.has(key) && fileTicked) untickedOnPage.push(key);
  }
  if (synced.length) fs.writeFileSync(OVERVIEW, lines.join(eol));
  console.log(JSON.stringify({ overview: OVERVIEW, pageSavedAt: page.savedAt || null, synced, alreadyInFile, tickedInFileNotOnPage: untickedOnPage }, null, 2));
}

switch (cmd) {
  case "render": render(); break;
  case "sync": sync(); break;
  case "--help": case "-h": case undefined:
    console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
    if (cmd === undefined) process.exit(2);
    break;
  default: die(`unknown command ${cmd}; try --help`);
}
