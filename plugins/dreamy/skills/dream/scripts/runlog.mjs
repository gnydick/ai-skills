#!/usr/bin/env node
// runlog.mjs — the /dream orchestrator's memory of its own runs.
//
// /dream chains three skills (session-analysis dream → improve-memory →
// send-results) and has to know, before it starts, whether the user reviewed
// the last Memory Improvement Overview and which flagged items have already
// been applied. Those are facts about files on disk, so a script establishes
// them rather than the model eyeballing a checklist and rationalising.
//
//   node runlog.mjs status [--home <dir>] [--mode full|apply-fixes]
//       Print the facts and the steps this run should take, as JSON. Also
//       snapshots the ticked items into pending.json so that `record` can
//       later tell which of them apply actually consumed.
//
//   node runlog.mjs record [--home <dir>] --mode <m> [--sent <message id>]
//                          [--applied <key,key>] [--note <text>]
//       Append one run to run-log.json: which overview (path + sha256 +
//       history copy) and which dream file this run left behind, and which
//       flagged items were applied — computed by diffing pending.json against
//       the overview now, or taken from --applied when given.
//
// Files (all under <home>/dream/, <home> defaulting to ~/.claude):
//   run-log.json   { runs: [...], applied: { "<F-id>@run<N>": {...} } }
//   pending.json   snapshot written by status, consumed and deleted by record
//
// Flagged items are keyed "<F-id>@run<N>" where N is the improve-memory run
// the item first appeared in ("since run N" on its line). improve-memory
// carries unticked items forward under their original ID, so the ID alone
// is only unique within one lineage of overviews; the run number pins it.

import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ---------- arguments ----------

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = { home: path.join(os.homedir(), ".claude"), mode: "full", applied: null, sent: null, note: null };
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  const next = () => { if (i + 1 >= argv.length) die(`${a} needs a value`); return argv[++i]; };
  switch (a) {
    case "--home": opt.home = path.resolve(next()); break;
    case "--mode": opt.mode = next(); break;
    case "--applied": opt.applied = next().split(",").map((s) => s.trim()).filter(Boolean); break;
    case "--sent": opt.sent = next(); break;
    case "--note": opt.note = next(); break;
    default: die(`unknown option ${a}`);
  }
}
if (!["full", "apply-fixes"].includes(opt.mode)) die(`--mode must be full or apply-fixes, not "${opt.mode}"`);

function die(msg) { console.error(`runlog: ${msg}`); process.exit(2); }

const P = {
  overview: path.join(opt.home, "improve-memory", "Memory Improvement Overview.md"),
  history: path.join(opt.home, "improve-memory", "history"),
  imState: path.join(opt.home, "improve-memory", "state.json"),
  saState: path.join(opt.home, "session-analysis", "state.json"),
  dreamDir: path.join(opt.home, "session-analysis", "dream"),
  latest: path.join(opt.home, "session-analysis", "dream", "latest.md"),
  log: path.join(opt.home, "dream", "run-log.json"),
  pending: path.join(opt.home, "dream", "pending.json"),
};

// ---------- helpers ----------

const readText = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null);
const readJson = (p) => { const t = readText(p); if (t === null) return null; try { return JSON.parse(t); } catch { return null; } };
const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const mtime = (p) => (fs.existsSync(p) ? fs.statSync(p).mtime.toISOString() : null);
const samePath = (a, b) => !!a && !!b && path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

function frontmatter(text) {
  if (!text) return {};
  const lines = text.split(/\r?\n/);
  if (lines[0].trim() !== "---") return {};
  const end = lines.indexOf("---", 1);
  if (end < 0) return {};
  const out = {};
  for (const line of lines.slice(1, end)) {
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

// The overview's "Needs your approval" section holds the open flagged items,
// one `- [ ] **F<n>** · … · since run <N>` line each. Items apply moves out of
// that section are, by construction, no longer open.
function parseOverview(text) {
  const fm = frontmatter(text);
  const run = Number(fm.run) || null;
  const lines = text.split(/\r?\n/);
  const items = [];
  let inApproval = false;
  for (const line of lines) {
    if (/^## /.test(line)) { inApproval = /^## Needs your approval/i.test(line); continue; }
    if (!inApproval) continue;
    const m = /^- \[([ xX])\] \*\*(F\d+)\*\*(.*)$/.exec(line);
    if (!m) continue;
    const since = /since run (\d+)/i.exec(m[3]);
    const sinceRun = since ? Number(since[1]) : run;
    items.push({ id: m[2], sinceRun, key: `${m[2]}@run${sinceRun ?? "?"}`, ticked: m[1] !== " " });
  }
  return { run, runAt: fm.run_at || null, dreamConsumed: fm.dream_consumed || null, items };
}

// latest.md is a copy; the dated file beside it is the one worth recording.
function resolveDream() {
  const latestText = readText(P.latest);
  if (latestText === null) return { exists: false };
  const fm = frontmatter(latestText);
  const latestSha = sha256(latestText);
  let dated = null;
  if (fs.existsSync(P.dreamDir)) {
    const files = fs.readdirSync(P.dreamDir).filter((f) => f.endsWith(".md") && f !== "latest.md").sort();
    dated = files.find((f) => sha256(readText(path.join(P.dreamDir, f))) === latestSha) || files.at(-1) || null;
  }
  return {
    exists: true,
    latestPath: P.latest,
    datedPath: dated ? path.join(P.dreamDir, dated) : P.latest,
    runAt: fm.run_at || null,
    window: fm.window || null,
    sessions: fm.sessions ? Number(fm.sessions) : null,
    candidates: fm.candidates ? Number(fm.candidates) : null,
    sha256: latestSha,
  };
}

function latestHistory() {
  if (!fs.existsSync(P.history)) return null;
  const files = fs.readdirSync(P.history).filter((f) => f.endsWith(".md")).sort();
  return files.length ? path.join(P.history, files.at(-1)) : null;
}

function loadLog() {
  const log = readJson(P.log) || { runs: [], applied: {} };
  log.runs ||= []; log.applied ||= {};
  return log;
}

function gather() {
  const overviewText = readText(P.overview);
  const log = loadLog();
  const lastRun = log.runs.at(-1) || null;
  const imState = readJson(P.imState);
  const saState = readJson(P.saState);
  const dream = resolveDream();

  const ov = overviewText === null
    ? { exists: false, path: P.overview }
    : {
        exists: true, path: P.overview, sha256: sha256(overviewText), modifiedAt: mtime(P.overview),
        ...parseOverview(overviewText), latestHistory: latestHistory(),
      };

  // "Reviewed" is decided by evidence the user left in the file: a ticked box,
  // or any edit at all since this skill last recorded the file's hash.
  let reviewedBecause;
  const tickedKeys = ov.exists ? ov.items.filter((i) => i.ticked && !log.applied[i.key]).map((i) => i.key) : [];
  if (!ov.exists) reviewedBecause = "no-overview";
  else if (tickedKeys.length) reviewedBecause = "ticked";
  else if (!lastRun || !lastRun.overview?.sha256) reviewedBecause = "never-recorded";
  else if (lastRun.overview.sha256 !== ov.sha256) reviewedBecause = "edited";
  else reviewedBecause = "unchanged";
  const reviewed = reviewedBecause === "ticked" || reviewedBecause === "edited";

  // A dream improve-memory has not consumed yet is work waiting to be done
  // even when the analysis step finds no new sessions.
  const consumedPath = imState?.lastDreamConsumed || null;
  const dreamUnconsumed = dream.exists && !(consumedPath && (samePath(consumedPath, dream.datedPath) || samePath(consumedPath, dream.latestPath)));

  return {
    home: opt.home, mode: opt.mode, now: new Date().toISOString(),
    overview: ov, tickedKeys, reviewed, reviewedBecause,
    dream: { ...dream, consumedByImproveMemory: dream.exists ? !dreamUnconsumed : null },
    sessionAnalysisLastRunAt: saState?.runs?.dream?.lastRunAt || null,
    improveMemoryState: imState,
    lastRun,
    appliedSoFar: Object.keys(log.applied),
    runsSoFar: log.runs.length,
  };
}

// ---------- status ----------

function status() {
  const s = gather();
  const steps = [];
  if (s.tickedKeys.length) {
    steps.push({ step: "apply", because: `${s.tickedKeys.length} ticked item(s) not yet applied: ${s.tickedKeys.join(", ")}` });
  }
  if (opt.mode === "full") {
    steps.push({ step: "analyze", because: s.sessionAnalysisLastRunAt ? `sessions since ${s.sessionAnalysisLastRunAt}` : "no previous dream run; the analysis falls back to 14 days" });
    steps.push({
      step: "improve",
      when: "the analysis wrote a new dream file, or dream.consumedByImproveMemory is false",
      because: s.dream.exists ? (s.dream.consumedByImproveMemory ? "the dream on disk is already consumed; only a new one triggers this" : `dream ${path.basename(s.dream.datedPath)} has not been consumed yet`) : "no dream on disk yet",
    });
  } else if (!steps.length) {
    steps.push({ step: "nothing", because: s.overview.exists ? "no ticked items in the overview" : "no overview to apply" });
  }
  if (steps.some((x) => x.step !== "nothing")) {
    steps.push({ step: "record" });
    steps.push({ step: "send", when: "something was applied, analyzed or improved; skip when the run changed nothing" });
  }
  s.steps = steps;
  s.summary = s.overview.exists
    ? `overview run ${s.overview.run} (${s.overview.items.length} open, ${s.tickedKeys.length} ticked) — ${s.reviewedBecause}; dream ${s.dream.exists ? `${path.basename(s.dream.datedPath)} ${s.dream.consumedByImproveMemory ? "consumed" : "UNCONSUMED"}` : "none"}; ${s.runsSoFar} dream run(s) logged`
    : `no overview yet; dream ${s.dream.exists ? path.basename(s.dream.datedPath) : "none"}; ${s.runsSoFar} dream run(s) logged`;

  // A run the plan already calls a no-op records nothing, so it needs no
  // snapshot; leaving one behind would only mislead someone reading the dir.
  if (steps.every((x) => x.step === "nothing")) fs.rmSync(P.pending, { force: true });
  else fs.mkdirSync(path.dirname(P.pending), { recursive: true }), fs.writeFileSync(P.pending, JSON.stringify({
    startedAt: s.now, mode: opt.mode,
    overviewSha256: s.overview.sha256 || null, overviewRun: s.overview.run || null,
    openKeys: s.overview.items?.map((i) => i.key) || [], tickedKeys: s.tickedKeys,
    dreamDatedPath: s.dream.datedPath || null, dreamRunAt: s.dream.runAt || null,
    sessionAnalysisLastRunAt: s.sessionAnalysisLastRunAt,
  }, null, 2) + "\n");

  delete s.improveMemoryState;
  console.log(JSON.stringify(s, null, 2));
}

// ---------- record ----------

function record() {
  const pending = readJson(P.pending);
  const s = gather();
  const log = loadLog();

  // `record --sent <id>` after the run was already recorded (no snapshot left)
  // stores the message id on that run rather than inventing a second one.
  const last = log.runs.at(-1);
  if (!pending && opt.sent && last && !last.sent && last.overview?.sha256 === s.overview.sha256) {
    last.sent = opt.sent;
    if (opt.note) last.note = opt.note;
    fs.writeFileSync(P.log, JSON.stringify(log, null, 2) + "\n");
    console.log(JSON.stringify({ updated: { n: last.n, sent: last.sent }, logPath: P.log }, null, 2));
    return;
  }
  const openNow = new Set(s.overview.items?.map((i) => i.key) || []);

  let applied, targetMoved = [];
  if (opt.applied) {
    applied = opt.applied;
  } else if (pending) {
    // apply moves a consumed item out of "Needs your approval"; one still
    // there after apply is the sha-mismatch case improve-memory leaves flagged.
    applied = pending.tickedKeys.filter((k) => !openNow.has(k));
    targetMoved = pending.tickedKeys.filter((k) => openNow.has(k));
  } else {
    applied = [];
    console.error("runlog: no pending.json (status was not run first) and no --applied; recording zero applied items");
  }

  const startedAt = pending?.startedAt || s.now;
  const dreamNew = s.dream.exists && (!pending || !samePath(pending.dreamDatedPath, s.dream.datedPath) || pending.dreamRunAt !== s.dream.runAt);
  const overviewNew = s.overview.exists && (!pending || pending.overviewSha256 !== s.overview.sha256);
  const n = log.runs.length + 1;
  const entry = {
    n, mode: opt.mode, startedAt, finishedAt: s.now,
    overview: s.overview.exists ? {
      path: s.overview.path, sha256: s.overview.sha256, run: s.overview.run, runAt: s.overview.runAt,
      history: s.overview.latestHistory, openItems: [...openNow], changedThisRun: overviewNew,
    } : null,
    dream: s.dream.exists ? { path: s.dream.datedPath, runAt: s.dream.runAt, window: s.dream.window, sessions: s.dream.sessions, candidates: s.dream.candidates, newThisRun: dreamNew } : null,
    applied, appliedButTargetMoved: targetMoved,
    sent: opt.sent, note: opt.note,
  };
  for (const k of applied) log.applied[k] = { run: n, at: s.now, overviewRun: s.overview.run || null };
  log.runs.push(entry);

  fs.mkdirSync(path.dirname(P.log), { recursive: true });
  fs.writeFileSync(P.log, JSON.stringify(log, null, 2) + "\n");
  if (pending) fs.rmSync(P.pending, { force: true });
  console.log(JSON.stringify({ recorded: entry, logPath: P.log, appliedTotal: Object.keys(log.applied).length }, null, 2));
}

// ---------- dispatch ----------

switch (cmd) {
  case "status": status(); break;
  case "record": record(); break;
  case "--help": case "-h": case undefined:
    console.log(readText(new URL(import.meta.url)).split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
    if (cmd === undefined) process.exit(2);
    break;
  default: die(`unknown command ${cmd}; try --help`);
}
