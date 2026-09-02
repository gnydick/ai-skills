#!/usr/bin/env node
/**
 * digest.mjs — distill Claude Code session transcripts into a readable digest.
 *
 * Walks ~/.claude/projects/<project>/<sessionId>.jsonl (main sessions only —
 * subagent transcripts under <sessionId>/subagents/ are skipped unless
 * --subagents is passed) and writes a Markdown digest a model can read.
 *
 * What survives distillation, per session:
 *   - header: project, title, time span, active minutes, prompt count, branch, PR links
 *   - compaction summaries (Claude's own summary of the session so far — high value)
 *   - every real user prompt (slash commands normalised to "/name args";
 *     tool results, hook attachments and injected skill bodies are dropped),
 *     including messages typed while Claude was busy — those are stored as
 *     queue-operation/enqueue records and about half never reappear as a
 *     normal user entry; they are flagged "(queued)"
 *   - interrupt markers ("[Request interrupted by user]") flagged on the turn
 *   - the assistant's final text per turn, truncated, plus up to three short
 *     mid-turn narration lines that mention a failure or workaround ("~ …")
 *   - per-turn tool tallies, tool-error counts, skills/agents invoked, files
 *     written/edited, wall time
 *
 * What is dropped: tool results, thinking blocks, hook output, file-history
 * snapshots, queue operations, sidechain entries, skill/CLAUDE.md injections.
 *
 * Usage:
 *   node digest.mjs [--since 14d|24h|2w|all|<ISO>|last:<run>] [--until <ISO>]
 *                   [--project <substr>]... [--out <file>] [--stats] [--subagents]
 *                   [--max-user-chars N] [--max-assistant-chars N]
 *                   [--max-compact-chars N] [--root <dir>]
 *   node digest.mjs --mark-run <run>
 *
 *   --since last:<run>  everything since the recorded end of the last <run>
 *             (e.g. last:dream); falls back to 14d when there is no record.
 *             This is what makes the skill safe in a loop: each pass reads
 *             only what is new.
 *   --mark-run <run>  record now as the end of <run> in
 *             ~/.claude/session-analysis/state.json and exit. Call it after a
 *             pass has finished writing its output, never before.
 *   --stats   print one line per project (sessions, prompts, digest size) and
 *             exit without writing the digest — use it to plan chunking.
 *   --out     write the digest here (default: stdout).
 *   --project may repeat; matches a substring of the project folder name
 *             (e.g. "ferrislicer" matches every ferrislicer worktree).
 *
 * Zero dependencies. Node 18+.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import readline from 'node:readline'

// ---------- args ----------
const args = process.argv.slice(2)
const opt = {
  since: '14d',
  until: null,
  projects: [],
  out: null,
  stats: false,
  subagents: false,
  maxUser: 1200,
  maxAssistant: 400,
  maxCompact: 3000,
  root: path.join(os.homedir(), '.claude', 'projects'),
}
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  const next = () => args[++i]
  switch (a) {
    case '--since': opt.since = next(); break
    case '--until': opt.until = next(); break
    case '--project': opt.projects.push(next()); break
    case '--out': opt.out = next(); break
    case '--stats': opt.stats = true; break
    case '--subagents': opt.subagents = true; break
    case '--max-user-chars': opt.maxUser = +next(); break
    case '--max-assistant-chars': opt.maxAssistant = +next(); break
    case '--max-compact-chars': opt.maxCompact = +next(); break
    case '--root': opt.root = next(); break
    case '--mark-run': opt.markRun = next(); break
    case '-h': case '--help': {
      const src = fs.readFileSync(new URL(import.meta.url), 'utf8')
      console.log(src.slice(0, src.indexOf('*/')))
      process.exit(0)
    }
    default:
      console.error(`unknown arg: ${a}`); process.exit(2)
  }
}

// Run state for loop usage: ~/.claude/session-analysis/state.json records
// when each subcommand last ran, so "--since last:dream" covers only what is
// new since then and a scheduled loop never re-reads the same sessions.
const STATE_DIR = path.join(os.homedir(), '.claude', 'session-analysis')
const STATE_FILE = path.join(STATE_DIR, 'state.json')
function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) } catch { return { runs: {} } }
}
function markRun(name) {
  const st = readState()
  st.runs = st.runs || {}
  st.runs[name] = { lastRunAt: new Date().toISOString() }
  fs.mkdirSync(STATE_DIR, { recursive: true })
  fs.writeFileSync(STATE_FILE, JSON.stringify(st, null, 2) + '\n', 'utf8')
  return st.runs[name].lastRunAt
}
if (opt.markRun) {
  console.log(`marked ${opt.markRun} run at ${markRun(opt.markRun)}`)
  process.exit(0)
}

function parseSince(s) {
  if (!s || s === 'all') return 0
  const last = /^last:([\w-]+)$/.exec(s)
  if (last) {
    const rec = (readState().runs || {})[last[1]]
    if (rec && rec.lastRunAt) { opt.since = `last:${last[1]} (${rec.lastRunAt})`; return Date.parse(rec.lastRunAt) }
    opt.since = `last:${last[1]} (no previous run, using 14d)`
    return Date.now() - 14 * 86400e3
  }
  const m = /^(\d+)([hdw])$/.exec(s)
  if (!m) {
    const t = Date.parse(s)
    if (Number.isNaN(t)) { console.error(`bad --since: ${s}`); process.exit(2) }
    return t
  }
  const n = +m[1]
  const unit = { h: 3600e3, d: 86400e3, w: 7 * 86400e3 }[m[2]]
  return Date.now() - n * unit
}
const sinceMs = parseSince(opt.since)
const untilMs = opt.until ? Date.parse(opt.until) : Infinity

// ---------- helpers ----------
const clip = (s, n) => {
  s = (s || '').replace(/\r/g, '').trim()
  return s.length <= n ? s : s.slice(0, n).trimEnd() + ` …[+${s.length - n} chars]`
}
const fmtTs = (ms) => {
  const d = new Date(ms)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
const fmtMin = (ms) => {
  const m = Math.round(ms / 60e3)
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m` : `${m}m`
}
// Claude Code names a project folder by replacing every non-alphanumeric
// character of the cwd with "-". Strip the home-dir prefix so
// "C--Users-Gabe-E--Nydick-RustroverProjects-ferrislicer" reads as
// "RustroverProjects-ferrislicer", and the home dir itself as "home".
const homeSlug = os.homedir().replace(/[^a-zA-Z0-9]/g, '-')
const shortProject = (slug) => {
  if (slug === homeSlug) return 'home'
  if (slug.startsWith(homeSlug + '-')) return slug.slice(homeSlug.length + 1)
  return slug.replace(/^[A-Z]--/, '')
}

// Assistant narration worth keeping from the middle of a turn.
const NARRATION_SIGNAL = /\b(fail(ed|s|ure)?|error|broke|instead|turns out|workaround|can(no|')t|doesn'?t work|didn'?t work|not (supported|available|installed)|gotcha|switch(ing)? to)\b/i

// Strip harness noise from a user prompt, normalise slash commands.
function cleanUserText(text) {
  if (!text) return ''
  let t = text
  const cn = /<command-name>([^<]*)<\/command-name>/.exec(t)
  if (cn) {
    const ca = /<command-args>([\s\S]*?)<\/command-args>/.exec(t)
    return `${cn[1].trim()} ${ca ? ca[1].trim() : ''}`.trim()
  }
  if (/<local-command-stdout>/.test(t)) return ''
  if (/<task-notification>/.test(t)) return ''
  t = t.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
  t = t.replace(/<ide_opened_file>[\s\S]*?<\/ide_opened_file>/g, '')
  t = t.replace(/<ide_selection>[\s\S]*?<\/ide_selection>/g, '')
  return t.trim()
}

function* walkProjects(root) {
  let ents
  try { ents = fs.readdirSync(root, { withFileTypes: true }) } catch { return }
  for (const e of ents) if (e.isDirectory()) yield e.name
}

function transcriptsIn(projDir) {
  const out = []
  for (const e of fs.readdirSync(projDir, { withFileTypes: true })) {
    if (e.isFile() && e.name.endsWith('.jsonl')) out.push(path.join(projDir, e.name))
    else if (opt.subagents && e.isDirectory()) {
      const sub = path.join(projDir, e.name, 'subagents')
      if (fs.existsSync(sub))
        for (const f of fs.readdirSync(sub)) if (f.endsWith('.jsonl')) out.push(path.join(sub, f))
    }
  }
  return out
}

// A file untouched since `sinceMs` has nothing in range — skip without parsing.
const touchedInRange = (p) => fs.statSync(p).mtimeMs >= sinceMs

// Existing long-term memories for a project, so the reader can dedupe.
function readMemories(projDir) {
  const dir = path.join(projDir, 'memory')
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.md') || f === 'MEMORY.md') continue
    let name = f.replace(/\.md$/, ''), desc = '', type = ''
    try {
      const head = fs.readFileSync(path.join(dir, f), 'utf8').slice(0, 1500)
      const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(head)
      if (fm) {
        const n = /^name:\s*(.+)$/m.exec(fm[1]); if (n) name = n[1].trim()
        const d = /^description:\s*(.+)$/m.exec(fm[1]); if (d) desc = d[1].trim()
        const t = /^\s*type:\s*(.+)$/m.exec(fm[1]); if (t) type = t[1].trim()
      }
    } catch { /* unreadable memory file: keep the filename */ }
    out.push({ name, desc, type })
  }
  return out
}

// ---------- per-file parse ----------
async function parseTranscript(file) {
  const s = {
    file,
    sessionId: path.basename(file, '.jsonl'),
    title: null,
    branch: null,
    cwd: null,
    firstTs: Infinity,
    lastTs: -Infinity,
    activeMs: 0,
    prLinks: [],
    turns: [],
    inRange: false,
  }
  let cur = null
  const newTurn = (ts) => {
    cur = { ts, user: null, queued: false, compact: null, interrupted: false, assistant: [], narration: [], tools: new Map(), files: new Set(), errors: 0, ms: 0 }
    s.turns.push(cur)
  }
  const bump = (k) => cur.tools.set(k, (cur.tools.get(k) || 0) + 1)
  const userTextOf = (content) => {
    let text = ''
    let isToolResult = false
    let errors = 0
    if (typeof content === 'string') text = content
    else if (Array.isArray(content)) {
      for (const c of content) {
        if (c.type === 'tool_result') { isToolResult = true; if (c.is_error) errors++ }
        else if (c.type === 'text') text += (text ? '\n' : '') + c.text
      }
    }
    return { text, isToolResult, errors }
  }

  // Pass 1: every user-entry text, so pass 2 can tell which queued messages
  // were later delivered as a normal user entry and which were not. Messages
  // typed while Claude is busy are recorded as queue-operation/enqueue; about
  // half of them (measured on this machine) never reappear as a user entry,
  // and they are disproportionately corrections ("do not do it", "stop").
  const delivered = []
  {
    const rl1 = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity })
    for await (const line of rl1) {
      if (!line.includes('"type":"user"')) continue
      let e
      try { e = JSON.parse(line) } catch { continue }
      if (e.type !== 'user' || e.isMeta || e.isSidechain) continue
      const { text } = userTextOf((e.message || {}).content)
      if (text) delivered.push(text)
    }
  }
  const wasDelivered = (q) => delivered.some(u => u === q || u.includes(q))

  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity })
  for await (const line of rl) {
    if (!line) continue
    let e
    try { e = JSON.parse(line) } catch { continue }
    const t = e.type
    if (t === 'ai-title') { s.title = s.title || e.aiTitle; continue }
    if (t === 'agent-name') { s.title = s.title || e.agentName; continue }
    if (t === 'pr-link') { if (e.prUrl) s.prLinks.push(e.prUrl); continue }
    if (t === 'system') {
      if (e.subtype === 'turn_duration' && e.durationMs) { s.activeMs += e.durationMs; if (cur) cur.ms += e.durationMs }
      continue
    }
    if (t === 'queue-operation') {
      if (e.operation !== 'enqueue' || typeof e.content !== 'string') continue
      const q = e.content.trim()
      if (!q || wasDelivered(q)) continue
      const clean = cleanUserText(q)
      if (!clean) continue
      const qts = e.timestamp ? Date.parse(e.timestamp) : NaN
      if (!Number.isNaN(qts) && qts >= sinceMs && qts <= untilMs) s.inRange = true
      newTurn(qts); cur.user = clean; cur.queued = true
      continue
    }
    if (t !== 'user' && t !== 'assistant') continue
    if (e.isSidechain) continue
    const ts = e.timestamp ? Date.parse(e.timestamp) : NaN
    if (!Number.isNaN(ts)) {
      if (ts < s.firstTs) s.firstTs = ts
      if (ts > s.lastTs) s.lastTs = ts
      if (ts >= sinceMs && ts <= untilMs) s.inRange = true
    }
    s.branch = e.gitBranch || s.branch
    s.cwd = e.cwd || s.cwd
    const content = (e.message || {}).content

    if (t === 'user') {
      if (e.isCompactSummary) {
        const txt = typeof content === 'string' ? content
          : Array.isArray(content) ? content.filter(c => c.type === 'text').map(c => c.text).join('\n') : ''
        newTurn(ts); cur.compact = txt
        continue
      }
      if (e.isMeta) continue
      const { text, isToolResult, errors } = userTextOf(content)
      if (errors && cur) cur.errors += errors
      if (isToolResult && !text) continue
      if (/^\[Request interrupted by user/.test(text)) { if (cur) cur.interrupted = true; continue }
      const clean = cleanUserText(text)
      if (!clean) continue
      newTurn(ts); cur.user = clean
      continue
    }

    // assistant
    if (!cur) newTurn(ts)
    if (!Array.isArray(content)) continue
    for (const c of content) {
      if (c.type === 'text' && c.text && c.text.trim()) {
        const txt = c.text.trim()
        // Mid-turn narration that admits a failure or a workaround is where
        // environment gotchas surface ("the heredoc broke, writing a file
        // instead"). Keep a short line of it; the final reply rarely repeats it.
        if (cur.assistant.length && NARRATION_SIGNAL.test(cur.assistant[cur.assistant.length - 1]) && cur.narration.length < 3) {
          cur.narration.push(clip(cur.assistant[cur.assistant.length - 1], 240))
        }
        cur.assistant.push(txt)
      } else if (c.type === 'tool_use') {
        const name = c.name || '?'
        bump(name)
        const inp = c.input || {}
        if (/^(Write|Edit|MultiEdit|NotebookEdit)$/.test(name) && inp.file_path) cur.files.add(inp.file_path)
        if (name === 'Skill' && inp.skill) bump(`Skill:${inp.skill}`)
        if ((name === 'Agent' || name === 'Task') && inp.subagent_type) bump(`Agent:${inp.subagent_type}`)
      }
    }
  }
  return s
}

// ---------- render ----------
function renderSession(s, proj) {
  const lines = []
  const span = Number.isFinite(s.firstTs) ? `${fmtTs(s.firstTs)} → ${fmtTs(s.lastTs)}` : 'no timestamps'
  const prompts = s.turns.filter(t => t.user).length
  const prs = [...new Set(s.prLinks)]
  lines.push(`### ${proj} — ${s.title || '(untitled)'}`)
  lines.push(`- session ${s.sessionId.slice(0, 8)} · ${span} · active ${fmtMin(s.activeMs)} · ${prompts} prompts${s.branch ? ` · branch ${s.branch}` : ''}${prs.length ? ` · PR ${prs.join(', ')}` : ''}`)
  lines.push('')
  for (const t of s.turns) {
    if (!t.user && !t.compact && !t.assistant.length) continue
    const inRange = t.ts >= sinceMs && t.ts <= untilMs
    if (!inRange && !t.compact) continue
    const when = Number.isNaN(t.ts) ? '' : fmtTs(t.ts).slice(5)
    if (t.compact) {
      lines.push(`**[compaction summary ${when}]**`)
      lines.push('> ' + clip(t.compact, opt.maxCompact).replace(/\n/g, '\n> '))
      lines.push('')
    }
    if (t.user) {
      const flags = `${t.queued ? ' (queued)' : ''}${t.interrupted ? ' ⚑interrupted' : ''}`
      lines.push(`**U ${when}${flags}:** ${clip(t.user, opt.maxUser).replace(/\n/g, '\n  ')}`)
    }
    const plain = [...t.tools.entries()].filter(([k]) => !k.includes(':')).map(([k, v]) => v > 1 ? `${k}×${v}` : k)
    const special = [...t.tools.keys()].filter(k => k.includes(':'))
    const files = [...t.files].map(f => f.replace(/\\/g, '/').split('/').slice(-2).join('/'))
    const meta = []
    if (plain.length) meta.push(plain.join(' '))
    if (special.length) meta.push(special.join(' '))
    if (t.errors) meta.push(`errors×${t.errors}`)
    if (files.length) meta.push(`files: ${files.slice(0, 8).join(', ')}${files.length > 8 ? ` +${files.length - 8}` : ''}`)
    if (t.ms) meta.push(fmtMin(t.ms))
    if (meta.length) lines.push(`  _[${meta.join(' · ')}]_`)
    for (const n of t.narration) lines.push(`  ~ ${n.replace(/\n/g, ' ')}`)
    if (t.assistant.length) {
      lines.push(`**A:** ${clip(t.assistant[t.assistant.length - 1], opt.maxAssistant).replace(/\n/g, '\n  ')}`)
    }
    lines.push('')
  }
  return lines.join('\n') + '\n'
}

// ---------- main ----------
const wanted = (slug) => !opt.projects.length || opt.projects.some(p => slug.toLowerCase().includes(p.toLowerCase()))
const perProject = []
for (const slug of walkProjects(opt.root)) {
  if (!wanted(slug)) continue
  const projDir = path.join(opt.root, slug)
  const files = transcriptsIn(projDir).filter(touchedInRange)
  if (!files.length) continue
  const sessions = []
  for (const f of files) {
    const s = await parseTranscript(f)
    if (s.inRange) sessions.push(s)
  }
  if (!sessions.length) continue
  sessions.sort((a, b) => a.firstTs - b.firstTs)
  perProject.push({ slug, short: shortProject(slug), sessions, memories: readMemories(projDir) })
}
perProject.sort((a, b) => a.sessions[0].firstTs - b.sessions[0].firstTs)
const nSess = perProject.reduce((n, p) => n + p.sessions.length, 0)

if (opt.stats) {
  let tot = 0
  console.log('project\tsessions\tprompts\tdigest_chars')
  for (const p of perProject) {
    const chars = p.sessions.reduce((n, s) => n + renderSession(s, p.short).length, 0)
    const prompts = p.sessions.reduce((n, s) => n + s.turns.filter(t => t.user).length, 0)
    tot += chars
    console.log(`${p.short}\t${p.sessions.length}\t${prompts}\t${chars}`)
  }
  console.log(`TOTAL\t${nSess}\t\t${tot}`)
  process.exit(0)
}

const out = []
out.push(`# Session digest — since ${opt.since}${opt.until ? ` until ${opt.until}` : ''} — ${nSess} sessions across ${perProject.length} projects`)
out.push(`_generated ${fmtTs(Date.now())} from ${opt.root}_`)
out.push('')
out.push('## Existing long-term memories (already saved — do not re-propose these)')
for (const p of perProject) {
  if (!p.memories.length) { out.push(`- **${p.short}**: none (memory dir: ${path.join(opt.root, p.slug, 'memory')})`); continue }
  // Past ~40 memories the names alone are enough to dedupe against; below
  // that a clipped description helps the reader spot near-duplicates.
  const terse = p.memories.length > 40
  out.push(`- **${p.short}** (${p.memories.length}, in ${path.join(opt.root, p.slug, 'memory')}): ` +
    p.memories.map(m => (!terse && m.desc) ? `${m.name} — ${clip(m.desc.replace(/^"|"$/g, ''), 90)}` : m.name).join('; '))
}
out.push('')
for (const p of perProject) {
  out.push(`## ${p.short} (${p.sessions.length} session${p.sessions.length > 1 ? 's' : ''})`)
  out.push('')
  for (const s of p.sessions) out.push(renderSession(s, p.short))
}
const text = out.join('\n')
if (opt.out) {
  fs.writeFileSync(opt.out, text, 'utf8')
  console.error(`wrote ${opt.out} (${text.length} chars, ${nSess} sessions, ${perProject.length} projects)`)
} else {
  process.stdout.write(text)
}
