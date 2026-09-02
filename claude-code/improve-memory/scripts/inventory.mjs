#!/usr/bin/env node
// inventory.mjs — the extractor for /improve-memory.
//
// Reads, without modifying anything:
//   <home>/projects/*/memory/*.md      memory files (frontmatter, links, size)
//   <home>/projects/*/memory/MEMORY.md index (entries, dangling, unindexed)
//   <home>/projects/*/*.jsonl          only the head of the newest, for "cwd"
//   <cwd>/CLAUDE.md, CLAUDE.local.md, .claude/CLAUDE.md, .claude/rules/*.md
//   <home>/CLAUDE.md, <home>/rules/*.md
//   <home>/session-analysis/dream/latest.md (or --dream)
//   <home>/improve-memory/Memory Improvement Overview.md (for --ticked)
//
// Emits one JSON document (--out) and an optional markdown summary on stdout
// (--summary). Every judgement — is this pair really a duplicate, does this
// candidate really supersede that memory — is left to the reader; the script
// only finds the places worth looking.
//
// Usage:
//   node inventory.mjs [--home <dir>] [--dream <file>] [--project <substr>]...
//                      [--out <json>] [--summary] [--ticked] [--help]

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const opt = { home: path.join(os.homedir(), ".claude"), dream: null, projects: [], out: null, summary: false, ticked: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--home") opt.home = path.resolve(args[++i]);
  else if (a === "--dream") opt.dream = path.resolve(args[++i]);
  else if (a === "--project") opt.projects.push(args[++i]);
  else if (a === "--out") opt.out = path.resolve(args[++i]);
  else if (a === "--summary") opt.summary = true;
  else if (a === "--ticked") opt.ticked = true;
  else if (a === "--help" || a === "-h") {
    console.log(`inventory.mjs — read-only inventory for /improve-memory

  --home <dir>        directory standing in for ~/.claude (default: ~/.claude)
  --dream <file>      dream overview to parse (default: <home>/session-analysis/dream/latest.md)
  --project <substr>  only project folders whose name contains <substr>; repeatable
  --out <file>        write the JSON inventory here (default: stdout when --summary is absent)
  --summary           print a markdown summary to stdout
  --ticked            also list the ticked F-items in the standing overview
`);
    process.exit(0);
  } else {
    console.error(`unknown argument: ${a}`);
    process.exit(2);
  }
}
if (!opt.dream) opt.dream = path.join(opt.home, "session-analysis", "dream", "latest.md");

// ---------- helpers ----------

const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };
const readText = (p) => fs.readFileSync(p, "utf8");
const listDir = (p) => { try { return fs.readdirSync(p, { withFileTypes: true }); } catch { return []; } };
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

function parseFrontmatter(text) {
  if (!text.startsWith("---")) return { fm: null, body: text };
  const end = text.indexOf("\n---", 3);
  if (end < 0) return { fm: null, body: text };
  const raw = text.slice(3, end).replace(/^\r?\n/, "");
  const body = text.slice(end + 4).replace(/^\r?\n/, "");
  const fm = {};
  let section = null;
  for (const line of raw.split(/\r?\n/)) {
    const top = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    const nested = line.match(/^\s+([A-Za-z_][\w-]*):\s*(.*)$/);
    if (top) {
      section = top[2] === "" ? top[1] : null;
      fm[top[1]] = top[2] === "" ? {} : unquote(top[2]);
    } else if (nested && section && typeof fm[section] === "object") {
      fm[section][nested[1]] = unquote(nested[2]);
    }
  }
  return { fm, body };
}
const unquote = (s) => { s = s.trim(); if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1).replace(/\\"/g, '"'); return s; };

const STOP = new Set("the a an and or of to in on for is are be by with not no from at as it its this that vs via per into over than then when while".split(" "));
const tokens = (s) => new Set((s || "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOP.has(t)));
const jaccard = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; for (const t of a) if (b.has(t)) n++; return n / (a.size + b.size - n); };

const SUPERSEDE_RE = /\b(superseded|supersedes|no longer|reversed|replaced by|obsolete|deprecated)\b/i;

// ---------- memory directories ----------

const projectsRoot = path.join(opt.home, "projects");
const projectDirs = listDir(projectsRoot).filter((d) => d.isDirectory()).map((d) => d.name)
  .filter((name) => opt.projects.length === 0 || opt.projects.some((s) => name.includes(s)))
  .filter((name) => exists(path.join(projectsRoot, name, "memory")));

function resolveCwd(projectDir) {
  // The transcript records the working directory; the folder name only encodes it lossily.
  const jsonl = listDir(projectDir).filter((d) => d.isFile() && d.name.endsWith(".jsonl"))
    .map((d) => ({ p: path.join(projectDir, d.name), m: fs.statSync(path.join(projectDir, d.name)).mtimeMs }))
    .sort((a, b) => b.m - a.m).slice(0, 5);
  for (const { p } of jsonl) {
    let fd;
    try {
      fd = fs.openSync(p, "r");
      const buf = Buffer.alloc(256 * 1024);
      const n = fs.readSync(fd, buf, 0, buf.length, 0);
      const head = buf.toString("utf8", 0, n);
      const m = head.match(/"cwd"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (m) return JSON.parse('"' + m[1] + '"');
    } catch { /* try the next one */ } finally { if (fd !== undefined) fs.closeSync(fd); }
  }
  return null;
}

function readMemoryDir(memDir) {
  const files = listDir(memDir).filter((d) => d.isFile() && d.name.endsWith(".md") && d.name !== "MEMORY.md").map((d) => d.name).sort();
  const memories = files.map((file) => {
    const text = readText(path.join(memDir, file));
    const { fm, body } = parseFrontmatter(text);
    const links = [...body.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].trim());
    const meta = fm && typeof fm.metadata === "object" ? fm.metadata : {};
    return {
      file,
      name: fm?.name ?? null,
      description: typeof fm?.description === "string" ? fm.description : null,
      type: meta.type ?? (typeof fm?.type === "string" ? fm.type : null),
      originSessionId: meta.originSessionId ?? null,
      modified: meta.modified ?? null,
      bytes: Buffer.byteLength(text),
      hasFrontmatter: !!fm,
      links,
      supersessionMarked: SUPERSEDE_RE.test(fm?.description ?? "") || SUPERSEDE_RE.test(body.slice(0, 400)),
      firstLine: body.split(/\r?\n/).find((l) => l.trim())?.slice(0, 160) ?? "",
    };
  });
  const byName = new Map(memories.filter((m) => m.name).map((m) => [m.name, m]));
  const byStem = new Map(memories.map((m) => [m.file.replace(/\.md$/, ""), m]));

  // index
  const indexPath = path.join(memDir, "MEMORY.md");
  const index = { exists: exists(indexPath), bytes: 0, entries: [], dangling: [], unindexed: [], duplicateEntries: [] };
  if (index.exists) {
    const text = readText(indexPath);
    index.bytes = Buffer.byteLength(text);
    const seen = new Map();
    for (const m of text.matchAll(/^\s*-\s*\[([^\]]*)\]\(([^)]+)\)\s*(?:—|-|–)?\s*(.*)$/gm)) {
      const entry = { title: m[1], file: m[2].trim(), hook: m[3].trim() };
      index.entries.push(entry);
      seen.set(entry.file, (seen.get(entry.file) ?? 0) + 1);
      if (!files.includes(entry.file)) index.dangling.push(entry.file);
    }
    for (const [f, n] of seen) if (n > 1) index.duplicateEntries.push({ file: f, count: n });
    const indexed = new Set(index.entries.map((e) => e.file));
    index.unindexed = files.filter((f) => !indexed.has(f));
  } else {
    index.unindexed = files.slice();
  }

  // broken links
  const brokenLinks = [];
  for (const m of memories) for (const l of m.links) if (!byName.has(l) && !byStem.has(l)) brokenLinks.push({ file: m.file, link: l });

  // near duplicates within the project
  const nearDuplicates = [];
  for (let i = 0; i < memories.length; i++) {
    const a = memories[i], ta = tokens(a.file.replace(/\.md$/, "")), da = tokens(a.description);
    for (let j = i + 1; j < memories.length; j++) {
      const b = memories[j], tb = tokens(b.file.replace(/\.md$/, "")), db = tokens(b.description);
      const reasons = [];
      const jn = jaccard(ta, tb), jd = jaccard(da, db);
      if (jn >= 0.5) reasons.push(`name overlap ${jn.toFixed(2)}`);
      if (jd >= 0.5) reasons.push(`description overlap ${jd.toFixed(2)}`);
      const sa = a.file.replace(/\.md$/, ""), sb = b.file.replace(/\.md$/, "");
      if (sa !== sb && (sa.includes(sb) || sb.includes(sa))) reasons.push("one name contains the other");
      if (a.originSessionId && a.originSessionId === b.originSessionId) reasons.push("same originSessionId");
      if (reasons.length) nearDuplicates.push({ a: a.file, b: b.file, score: Math.max(jn, jd), reasons });
    }
  }
  nearDuplicates.sort((x, y) => y.score - x.score);

  return { memories, index, brokenLinks, nearDuplicates: nearDuplicates.slice(0, 60), nearDuplicatesTotal: nearDuplicates.length };
}

// ---------- instruction files ----------

function readInstructionFile(p) {
  if (!exists(p)) return null;
  const text = readText(p);
  const { fm, body } = parseFrontmatter(text);
  const headings = [...body.matchAll(/^(#{1,3})\s+(.+)$/gm)].map((m) => ({ level: m[1].length, text: m[2].trim() }));
  const imports = [...body.matchAll(/(?:^|\s)@([\w./\\-]+\.md)\b/gm)].map((m) => m[1]);
  const pointers = [...body.matchAll(/`([\w./\\-]+\.md)`/g)].map((m) => m[1]);
  let paths = null;
  if (fm && "paths" in fm) {
    // paths: is a YAML list; the flat parser saw only the key. Re-read the raw block.
    const raw = text.slice(3, text.indexOf("\n---", 3));
    paths = [...raw.matchAll(/^\s*-\s*["']?([^"'\n]+?)["']?\s*$/gm)].map((m) => m[1]);
  }
  return {
    path: p, bytes: Buffer.byteLength(text), lines: text.split(/\r?\n/).length, chars: text.length,
    sha256: sha256(Buffer.from(text)), headings, imports, pointers: [...new Set(pointers)], paths,
  };
}

function readRulesDir(dir) {
  return listDir(dir).filter((d) => d.isFile() && d.name.endsWith(".md")).map((d) => readInstructionFile(path.join(dir, d.name)));
}

function readProjectInstructionFiles(cwd) {
  if (!cwd || !exists(cwd)) return null;
  const topDirs = listDir(cwd).filter((d) => d.isDirectory() && !d.name.startsWith(".") && d.name !== "node_modules" && d.name !== "target").map((d) => d.name);
  return {
    cwd,
    claudeMd: readInstructionFile(path.join(cwd, "CLAUDE.md")),
    claudeLocalMd: readInstructionFile(path.join(cwd, "CLAUDE.local.md")),
    dotClaudeMd: readInstructionFile(path.join(cwd, ".claude", "CLAUDE.md")),
    rules: readRulesDir(path.join(cwd, ".claude", "rules")),
    nestedClaudeMd: topDirs.filter((d) => exists(path.join(cwd, d, "CLAUDE.md"))).map((d) => path.join(cwd, d, "CLAUDE.md")),
    archiveDirs: ["docs/rules", "docs/decisions", ".claude/design"].filter((d) => exists(path.join(cwd, d))).map((d) => ({ dir: d, files: listDir(path.join(cwd, d)).filter((e) => e.isFile()).length })),
    topLevelDirs: topDirs,
  };
}

// ---------- dream ----------

function parseDream(p) {
  if (!exists(p)) return null;
  const text = readText(p);
  const { fm, body } = parseFrontmatter(text);
  const sections = {};
  let current = "_preamble";
  for (const line of body.split(/\r?\n/)) {
    const h = line.match(/^##\s+(.+)$/);
    if (h) { current = h[1].trim(); sections[current] = []; continue; }
    (sections[current] ??= []).push(line);
  }
  const candidates = [];
  const candRe = /^\s*(\d+)\.\s+\*\*([^*]+)\*\*\s+\[([^\]]+)\]\s*$/;
  for (const [section, lines] of Object.entries(sections)) {
    if (/^(superseded|needs a decision|also seen)/i.test(section)) continue;
    let cur = null;
    for (const line of lines) {
      const m = line.match(candRe);
      if (m) {
        const parts = m[3].split("·").map((s) => s.trim());
        const statusRaw = parts.slice(3).join(" · ");
        const updates = statusRaw.startsWith("updates") ? statusRaw.replace(/^updates\s*/, "").split(/,\s*/).map((s) => s.replace(/\s*\([^)]*\)\s*$/, "").trim()).filter(Boolean) : [];
        cur = { n: Number(m[1]), name: m[2].trim(), section, type: parts[0] ?? null, project: parts[1] ?? null, confidence: parts[2] ?? null, status: updates.length ? "updates" : statusRaw || null, updates, text: "", why: "", seen: "", memoryDirHint: null };
        candidates.push(cur);
      } else if (cur) {
        const t = line.trim();
        if (!t) continue;
        if (t.startsWith("_Why:_")) cur.why += t.replace(/^_Why:_\s*/, "");
        else if (t.startsWith("_Seen:_")) cur.seen += t.replace(/^_Seen:_\s*/, "");
        else if (t.startsWith("(") && /memory dir/i.test(t)) { /* group note */ }
        else cur.text += (cur.text ? " " : "") + t;
      }
    }
  }
  const bullets = (name) => (sections[Object.keys(sections).find((k) => k.toLowerCase().startsWith(name)) ?? ""] ?? []).filter((l) => /^\s*-\s+/.test(l)).map((l) => l.replace(/^\s*-\s+/, "").trim());
  return {
    path: p, frontmatter: fm, candidates,
    superseded: bullets("superseded"),
    needsDecision: bullets("needs a decision"),
    alsoSeen: bullets("also seen"),
  };
}

// ---------- ticked items ----------

function readTicked() {
  const p = path.join(opt.home, "improve-memory", "Memory Improvement Overview.md");
  if (!exists(p)) return { path: p, exists: false, ticked: [], open: [] };
  const text = readText(p);
  const ticked = [], open = [];
  for (const m of text.matchAll(/^\s*-\s*\[( |x|X)\]\s*\*\*(F\d+)\*\*/gm)) (m[1].trim() ? ticked : open).push(m[2]);
  return { path: p, exists: true, ticked, open };
}

// ---------- assemble ----------

const projects = projectDirs.map((slug) => {
  const projectDir = path.join(projectsRoot, slug);
  const memDir = path.join(projectDir, "memory");
  const cwd = resolveCwd(projectDir);
  return { slug, memoryDir: memDir, cwd, instructionFiles: readProjectInstructionFiles(cwd), ...readMemoryDir(memDir) };
});

// cross-project duplicates
const byName = new Map(), byOrigin = new Map();
for (const p of projects) for (const m of p.memories) {
  const key = m.name ?? m.file.replace(/\.md$/, "");
  (byName.get(key) ?? byName.set(key, []).get(key)).push({ project: p.slug, file: m.file, bytes: m.bytes });
  if (m.originSessionId) (byOrigin.get(m.originSessionId) ?? byOrigin.set(m.originSessionId, []).get(m.originSessionId)).push({ project: p.slug, file: m.file });
}
const crossProject = {
  sameName: [...byName].filter(([, v]) => new Set(v.map((x) => x.project)).size > 1).map(([name, files]) => ({ name, files })),
  sameOriginSession: [...byOrigin].filter(([, v]) => new Set(v.map((x) => x.project)).size > 1).map(([originSessionId, files]) => ({ originSessionId, files })),
};

const user = {
  claudeMd: readInstructionFile(path.join(opt.home, "CLAUDE.md")),
  rules: readRulesDir(path.join(opt.home, "rules")),
};

const dream = parseDream(opt.dream);
const statePath = path.join(opt.home, "improve-memory", "state.json");
const state = exists(statePath) ? JSON.parse(readText(statePath)) : null;

const inventory = {
  generatedAt: new Date().toISOString(),
  home: opt.home,
  projectFilter: opt.projects,
  state,
  dream,
  projects,
  crossProject,
  user,
  totals: {
    projects: projects.length,
    memories: projects.reduce((n, p) => n + p.memories.length, 0),
    dangling: projects.reduce((n, p) => n + p.index.dangling.length, 0),
    unindexed: projects.reduce((n, p) => n + p.index.unindexed.length, 0),
    brokenLinks: projects.reduce((n, p) => n + p.brokenLinks.length, 0),
    nearDuplicatePairs: projects.reduce((n, p) => n + p.nearDuplicatesTotal, 0),
    dreamCandidates: dream ? dream.candidates.length : 0,
  },
};
if (opt.ticked) inventory.overview = readTicked();

if (opt.out) {
  fs.mkdirSync(path.dirname(opt.out), { recursive: true });
  fs.writeFileSync(opt.out, JSON.stringify(inventory, null, 2));
}

if (opt.summary) {
  const out = [];
  out.push(`# Inventory — ${inventory.generatedAt}`);
  out.push(`home: ${opt.home}`);
  out.push(dream ? `dream: ${dream.path} (run_at ${dream.frontmatter?.run_at ?? "?"}, ${dream.candidates.length} candidates, ${dream.superseded.length} superseded, ${dream.needsDecision.length} decisions, ${dream.alsoSeen.length} also-seen)` : `dream: none at ${opt.dream}`);
  if (state) out.push(`state: run ${state.runs ?? "?"}, last ${state.lastRunAt ?? "?"}, consumed ${state.lastDreamConsumed ?? "none"}`);
  out.push("");
  out.push("| project | memories | index bytes | dangling | unindexed | broken links | near-dup pairs | superseded-marked | CLAUDE.md chars | rules files | dream cands |");
  out.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const p of projects) {
    const cands = dream ? dream.candidates.filter((c) => c.project && (p.slug.toLowerCase().includes(c.project.toLowerCase()) || c.project === "global")).length : 0;
    const cm = p.instructionFiles?.claudeMd;
    out.push(`| ${p.slug} | ${p.memories.length} | ${p.index.bytes} | ${p.index.dangling.length} | ${p.index.unindexed.length} | ${p.brokenLinks.length} | ${p.nearDuplicatesTotal} | ${p.memories.filter((m) => m.supersessionMarked).length} | ${cm ? cm.chars : p.cwd ? "none" : "cwd?"} | ${p.instructionFiles?.rules.length ?? 0} | ${cands} |`);
  }
  out.push("");
  out.push(`cross-project: ${crossProject.sameName.length} same-name, ${crossProject.sameOriginSession.length} same-origin-session`);
  out.push(`user-level: CLAUDE.md ${user.claudeMd ? user.claudeMd.chars + " chars" : "absent"}, ${user.rules.length} rules files`);
  if (dream) {
    out.push("");
    out.push("## Dream candidates");
    for (const c of dream.candidates) out.push(`- #${c.n} ${c.name} [${c.type} · ${c.project} · ${c.confidence} · ${c.status}${c.updates.length ? " " + c.updates.join(", ") : ""}]`);
  }
  if (inventory.overview) out.push("", `ticked: ${inventory.overview.ticked.join(", ") || "none"}; open: ${inventory.overview.open.join(", ") || "none"}`);
  out.push("", opt.out ? `JSON: ${opt.out}` : "(pass --out to write the JSON)");
  console.log(out.join("\n"));
} else if (!opt.out) {
  console.log(JSON.stringify(inventory, null, 2));
}
