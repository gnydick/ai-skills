#!/usr/bin/env node
// eval-results.mjs — render a skill-creator eval iteration as one readable page.
//
//   node scripts/eval-results.mjs <iteration-dir> [--skill <name>] [--open]
//
// Reads <iteration-dir>/eval-*/<config>/{grading.json,timing.json,outputs/*}
// plus benchmark.json when present, and writes results.html and results.md
// beside them. Everything is read and written as UTF-8 — the stock
// skill-creator viewer used the platform codepage, which on Windows turned
// every em dash and arrow into mojibake — and the page uses a 17px base font
// with the two configurations side by side. No server, no dependencies: open
// the file, or send it through /send-results.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const dir = path.resolve(args.find((a) => !a.startsWith("--")) || ".");
const skill = args.includes("--skill") ? args[args.indexOf("--skill") + 1] : path.basename(path.dirname(dir)).replace(/-workspace$/, "");
const open = args.includes("--open");

const rd = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null);
const js = (p) => { const t = rd(p); if (t === null) return null; try { return JSON.parse(t); } catch { return null; } };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Small markdown renderer: enough for replies and overviews (headings, fences,
// lists, bold, inline code, links, paragraphs). Anything else stays as text.
function md(src) {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  let out = [], i = 0, list = null;
  const inline = (t) => esc(t)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>');
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  while (i < lines.length) {
    const l = lines[i];
    const fence = /^\s*```(\w*)/.exec(l);
    if (fence) { closeList(); const buf = []; i++; while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]); i++; out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`); continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h) { closeList(); out.push(`<h${h[1].length + 2}>${inline(h[2])}</h${h[1].length + 2}>`); i++; continue; }
    const li = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(l);
    if (li) { const kind = /^\s*\d/.test(l) ? "ol" : "ul"; if (list !== kind) { closeList(); out.push(`<${kind}>`); list = kind; } out.push(`<li>${inline(li[1])}</li>`); i++; continue; }
    if (/^\s*$/.test(l)) { closeList(); i++; continue; }
    if (/^\s*\|/.test(l)) { closeList(); const rows = []; while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]); const cells = rows.filter((r) => !/^\s*\|[\s:|-]+\|\s*$/.test(r)).map((r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim()))); out.push(`<table><thead><tr>${cells[0].map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${cells.slice(1).map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`); continue; }
    closeList(); const para = []; while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6}\s|\s*```|\s*(?:[-*]|\d+\.)\s|\s*\|)/.test(lines[i])) para.push(lines[i++]); out.push(`<p>${inline(para.join(" "))}</p>`);
  }
  closeList();
  return out.join("\n");
}

// ---------- collect ----------
const evals = fs.readdirSync(dir).filter((f) => f.startsWith("eval-") && fs.statSync(path.join(dir, f)).isDirectory()).sort().map((ev) => {
  const meta = js(path.join(dir, ev, "eval_metadata.json")) || { eval_name: ev, prompt: "" };
  const configs = fs.readdirSync(path.join(dir, ev)).filter((c) => fs.statSync(path.join(dir, ev, c)).isDirectory() && fs.existsSync(path.join(dir, ev, c, "outputs"))).sort((a, b) => (a.startsWith("with") ? -1 : 1) - (b.startsWith("with") ? -1 : 1)).map((cfg) => {
    const base = path.join(dir, ev, cfg);
    const outputs = fs.existsSync(path.join(base, "outputs")) ? fs.readdirSync(path.join(base, "outputs")).filter((f) => fs.statSync(path.join(base, "outputs", f)).isFile()).map((f) => ({ name: f, text: rd(path.join(base, "outputs", f)) })) : [];
    return { cfg, grading: js(path.join(base, "grading.json")), timing: js(path.join(base, "timing.json")), outputs };
  });
  return { ev, meta, configs };
});
const bench = js(path.join(dir, "benchmark.json"));

// ---------- results.md ----------
const mdOut = [`# ${skill} — eval results, ${path.basename(dir)}`, ""];
if (bench?.summary) {
  const cfgs = Object.keys(bench.summary);
  mdOut.push("| Metric | " + cfgs.join(" | ") + " |", "|---|" + cfgs.map(() => "---:").join("|") + "|");
  for (const [label, key, fmt] of [["Pass rate", "pass_rate", (v) => `${Math.round(v * 100)}%`], ["Time", "time_seconds", (v) => `${Math.round(v)}s`], ["Tokens", "tokens", (v) => `${Math.round(v / 1000)}K`]]) mdOut.push(`| ${label} | ` + cfgs.map((c) => fmt(bench.summary[c]?.[key]?.mean ?? 0)).join(" | ") + " |");
  mdOut.push("");
}
for (const { meta, configs } of evals) {
  mdOut.push(`## ${meta.eval_name}`, "", `Prompt: \`${meta.prompt}\``, "");
  for (const c of configs) {
    const s = c.grading?.summary; mdOut.push(`### ${c.cfg.replace(/_/g, " ")}${s ? ` — ${s.passed}/${s.total}` : ""}${c.timing ? `, ${Math.round(c.timing.total_duration_seconds)}s, ${Math.round((c.timing.total_tokens || 0) / 1000)}K tokens` : ""}`, "");
    if (c.grading) { mdOut.push("| | Assertion | Evidence |", "|---|---|---|"); for (const e of c.grading.expectations) mdOut.push(`| ${e.passed ? "pass" : "**FAIL**"} | ${e.text} | ${String(e.evidence).replace(/\|/g, "\\|").replace(/\n/g, " ")} |`); mdOut.push(""); }
  }
}
fs.writeFileSync(path.join(dir, "results.md"), mdOut.join("\n"));

// ---------- results.html ----------
const pct = (v) => `${Math.round((v ?? 0) * 100)}%`;
const benchHtml = bench?.summary ? (() => {
  const cfgs = Object.keys(bench.summary);
  const row = (label, key, fmt) => `<tr><th>${label}</th>${cfgs.map((c) => `<td>${fmt(bench.summary[c]?.[key]?.mean ?? 0)} <small>± ${fmt(bench.summary[c]?.[key]?.stddev ?? 0)}</small></td>`).join("")}</tr>`;
  return `<table class="bench"><thead><tr><th></th>${cfgs.map((c) => `<th>${esc(c.replace(/_/g, " "))}</th>`).join("")}</tr></thead><tbody>
${row("Pass rate", "pass_rate", pct)}${row("Time", "time_seconds", (v) => `${Math.round(v)}s`)}${row("Tokens", "tokens", (v) => `${Math.round(v / 1000)}K`)}</tbody></table>`;
})() : "";

const evalHtml = evals.map(({ ev, meta, configs }) => `
<section id="${esc(ev)}">
<h2>${esc(meta.eval_name)}</h2>
<p class="prompt"><code>${esc(meta.prompt)}</code></p>
<div class="cols">
${configs.map((c) => {
  const s = c.grading?.summary; const ok = s && s.passed === s.total;
  return `<article class="${c.cfg.startsWith("with") ? "primary" : "baseline"}">
<h3>${esc(c.cfg.replace(/_/g, " "))} ${s ? `<span class="score ${ok ? "ok" : "bad"}">${s.passed}/${s.total}</span>` : ""}${c.timing ? `<small>${Math.round(c.timing.total_duration_seconds)}s · ${Math.round((c.timing.total_tokens || 0) / 1000)}K tokens</small>` : ""}</h3>
${c.grading ? `<details open><summary>Grades</summary><table class="grades">${c.grading.expectations.map((e) => `<tr class="${e.passed ? "pass" : "fail"}"><td class="mark">${e.passed ? "✓" : "✗"}</td><td>${esc(e.text)}<div class="evidence">${esc(e.evidence)}</div></td></tr>`).join("")}</table></details>` : "<p><em>not graded</em></p>"}
${c.outputs.map((o) => `<details ${/^reply/.test(o.name) ? "open" : ""}><summary>${esc(o.name)}</summary><div class="output">${/\.md$/.test(o.name) ? md(o.text) : `<pre>${esc(o.text)}</pre>`}</div></details>`).join("\n")}
</article>`;
}).join("\n")}
</div>
</section>`).join("\n");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(skill)} evals — ${esc(path.basename(dir))}</title>
<style>
:root{--bg:#fafaf8;--fg:#1c1c1a;--muted:#6b6b66;--line:#e2e1dc;--card:#fff;--ok:#1a7f37;--bad:#c62828;--code:#f1f0ec}
@media(prefers-color-scheme:dark){:root{--bg:#161615;--fg:#e8e6e1;--muted:#9a9891;--line:#33322f;--card:#1f1f1d;--ok:#5fcf7a;--bad:#ff7b72;--code:#2a2a27}}
html{font-size:17px}body{margin:0;background:var(--bg);color:var(--fg);font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.5}
main{max-width:1500px;margin:0 auto;padding:1.5rem 2rem 4rem}
h1{font-size:1.9rem;margin:.2rem 0 1rem}h2{font-size:1.5rem;margin:2.5rem 0 .5rem;padding-top:1rem;border-top:2px solid var(--line)}h3{font-size:1.15rem;margin:0 0 .6rem;display:flex;gap:.6rem;align-items:baseline}h3 small{color:var(--muted);font-weight:normal;font-size:.85rem}
nav{display:flex;flex-wrap:wrap;gap:.5rem 1.2rem;margin:.5rem 0 1.5rem;font-size:.95rem}nav a{color:var(--muted);text-decoration:none}nav a:hover{color:var(--fg)}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:1.2rem}@media(max-width:1000px){.cols{grid-template-columns:1fr}}
article{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:1rem 1.2rem;min-width:0}article.baseline{opacity:.92}
.prompt code{font-size:1rem;white-space:pre-wrap;word-break:break-all}
.score{font-weight:700;padding:.05rem .5rem;border-radius:6px;font-size:.95rem}.score.ok{background:color-mix(in srgb,var(--ok) 15%,transparent);color:var(--ok)}.score.bad{background:color-mix(in srgb,var(--bad) 15%,transparent);color:var(--bad)}
details{margin:.6rem 0;border-top:1px solid var(--line);padding-top:.4rem}summary{cursor:pointer;font-weight:600;color:var(--muted)}details[open] summary{color:var(--fg)}
table{border-collapse:collapse;width:100%;margin:.5rem 0;font-size:.98rem}td,th{text-align:left;vertical-align:top;padding:.45rem .6rem;border-bottom:1px solid var(--line)}th{color:var(--muted);font-weight:600}
.bench td{font-variant-numeric:tabular-nums}.bench small{color:var(--muted)}
.grades .mark{width:1.5rem;font-weight:700;font-size:1.1rem}.grades tr.pass .mark{color:var(--ok)}.grades tr.fail .mark{color:var(--bad)}.grades tr.fail td{background:color-mix(in srgb,var(--bad) 7%,transparent)}
.evidence{color:var(--muted);font-size:.9rem;margin-top:.15rem;white-space:pre-wrap}
.output{overflow-x:auto}.output h3,.output h4,.output h5{margin:.8rem 0 .3rem;font-size:1.05rem;display:block}
code{font-family:ui-monospace,"Cascadia Code",Consolas,monospace;font-size:.92em;background:var(--code);padding:.05rem .3rem;border-radius:4px}pre{background:var(--code);padding:.8rem 1rem;border-radius:8px;overflow-x:auto;font-size:.9rem;line-height:1.45}pre code{background:none;padding:0}
</style></head><body><main>
<h1>${esc(skill)} — eval results, ${esc(path.basename(dir))}</h1>
<p style="color:var(--muted)">${evals.length} test case${evals.length === 1 ? "" : "s"} · generated ${new Date().toLocaleString()} · <code>${esc(dir)}</code></p>
${benchHtml}
<nav>${evals.map((e) => `<a href="#${esc(e.ev)}">${esc(e.meta.eval_name)}</a>`).join("")}</nav>
${evalHtml}
</main></body></html>`;
fs.writeFileSync(path.join(dir, "results.html"), html);
console.log(`${path.join(dir, "results.html")}\n${path.join(dir, "results.md")}\n${evals.length} evals, ${evals.reduce((n, e) => n + e.configs.length, 0)} runs`);
if (open) { try { execFileSync(process.platform === "win32" ? "cmd" : "open", process.platform === "win32" ? ["/c", "start", "", path.join(dir, "results.html")] : [path.join(dir, "results.html")]); } catch {} }
