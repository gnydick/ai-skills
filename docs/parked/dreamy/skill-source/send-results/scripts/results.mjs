#!/usr/bin/env node
// send-results: one pipeline from (file, summary) to a ready-to-send message.
//
//   init      write ~/.claude/send-results.json   (run once by `/send-results setup`)
//   compose   print the message as JSON           (run on every send)
//   config    print the current configuration
//
// The assistant never assembles the email by hand. `compose` is the only place
// the subject, body, and links are built, so every automation's report has the
// same shape, the same subject prefix, and lands under the same label. A caller
// that wants a different layout changes this file, not its own prompt.
//
// Arguments to `compose` use the same grammar as the skill itself, so the
// assistant can pass what it was given straight through:
//
//   compose <file> [--from <name>] [--title <text>] -- <summary words...>
//   compose <file> [--from <name>] [--title <text>] --summary <text>
//   compose <file> [--from <name>] [--title <text>] --summary-file <path>

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CONFIG = path.join(os.homedir(), '.claude', 'send-results.json');
const IDE_NAMES = {
  idea: 'IntelliJ IDEA', rustrover: 'RustRover', pycharm: 'PyCharm', webstorm: 'WebStorm',
  goland: 'GoLand', clion: 'CLion', phpstorm: 'PhpStorm', rider: 'Rider', datagrip: 'DataGrip',
};

const die = (code, msg) => { console.error(`send-results: ${msg}`); process.exit(code); };

function parseArgs(argv) {
  const out = { flags: {}, positional: [], rest: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { out.rest = argv.slice(i + 1).join(' '); break; }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out.flags[key] = true;
      else { out.flags[key] = next; i++; }
    } else {
      out.positional.push(a);
    }
  }
  return out;
}

// Git Bash hands node a POSIX-looking path when the caller wrote one and the
// automatic conversion did not fire (it skips arguments containing certain
// characters). Recover the Windows form rather than reporting a missing file.
function resolveFile(p) {
  let candidate = p;
  if (process.platform === 'win32' && !fs.existsSync(candidate)) {
    const m = /^\/([a-zA-Z])\/(.*)$/.exec(p);
    if (m) candidate = `${m[1].toUpperCase()}:/${m[2]}`;
  }
  return path.resolve(candidate);
}

// The nearest enclosing .git decides the project name and the path the IDE
// link refers to. Outside any repository the file's own directory stands in.
function locate(abs) {
  let dir = path.dirname(abs);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git'))) {
      return { root: dir, project: path.basename(dir), relpath: path.relative(dir, abs).split(path.sep).join('/') };
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const root = path.dirname(abs);
  return { root, project: path.basename(root), relpath: path.basename(abs) };
}

function loadConfig() {
  if (!fs.existsSync(CONFIG)) die(3, `no configuration at ${CONFIG} — run: /send-results setup`);
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  if (!Array.isArray(cfg.to) || !cfg.to.length) die(3, `${CONFIG} has no "to" address — run: /send-results setup`);
  return cfg;
}

// Order is by what a web mail client will actually render. Gmail drops the
// href from custom schemes (jetbrains://, file://) and shows them as text, but
// keeps http links, so the IDE's built-in server link goes first: it opens the
// file by absolute path in the running IDE regardless of which project it
// belongs to. The others stay for clients that honor them and as copyable text.
function defaultLinks(ide, port) {
  const ideName = IDE_NAMES[ide] ?? ide;
  return [
    { label: `Open in ${ideName} (IDE must be running)`, url: `http://localhost:${port}/api/file/{abspathfs}` },
    { label: 'Toolbox deep link (copy it if your mail client shows it as text)', url: `jetbrains://${ide}/navigate/reference?project={project}&path={relpath}` },
    { label: 'Local file link', url: 'file:///{abspathfs}' },
  ];
}

function init(flags) {
  const existing = fs.existsSync(CONFIG) ? JSON.parse(fs.readFileSync(CONFIG, 'utf8')) : {};
  const cfg = { ...existing };
  if (flags.to) cfg.to = String(flags.to).split(',').map((s) => s.trim()).filter(Boolean);
  if (flags.prefix) cfg.subjectPrefix = String(flags.prefix);
  cfg.subjectPrefix ??= '[results]';
  cfg.label ??= {};
  if (flags['label-name']) cfg.label.name = String(flags['label-name']);
  if (flags['label-id']) cfg.label.id = String(flags['label-id']);
  cfg.label.name ??= 'Automation results';
  const ide = flags.ide ? String(flags.ide) : (cfg.ide ?? 'idea');
  const port = flags.port ? Number(flags.port) : (cfg.ideServerPort ?? 63342);
  cfg.ide = ide;
  cfg.ideServerPort = port;
  // Links are regenerated whenever the IDE changes; a hand-edited list survives otherwise.
  if (!cfg.links || flags.ide || flags.port) cfg.links = defaultLinks(ide, port);

  if (!cfg.to?.length) die(2, 'init needs --to <address>[,<address>]');
  fs.mkdirSync(path.dirname(CONFIG), { recursive: true });
  fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + '\n');
  console.log(JSON.stringify({ wrote: CONFIG, config: cfg }, null, 2));
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? encodeURI(vars[k]) : `{${k}}`));

function compose(parsed) {
  const cfg = loadConfig();
  const { flags, positional, rest } = parsed;

  const filearg = positional[0] ?? flags.file;
  if (!filearg) die(2, 'compose needs a file path as the first argument');
  const abs = resolveFile(String(filearg));
  if (!fs.existsSync(abs)) die(2, `file does not exist: ${abs} — nothing was sent`);
  const stat = fs.statSync(abs);

  let summary = rest ?? (typeof flags.summary === 'string' ? flags.summary : null);
  if (summary == null && flags['summary-file']) summary = fs.readFileSync(resolveFile(String(flags['summary-file'])), 'utf8');
  summary = (summary ?? '').trim();
  if (!summary) die(2, 'compose needs a summary: words after "--", or --summary <text>, or --summary-file <path>');

  const from = typeof flags.from === 'string' && flags.from.trim() ? flags.from.trim() : 'automation';
  const title = typeof flags.title === 'string' && flags.title.trim() ? flags.title.trim() : path.basename(abs);
  const loc = locate(abs);
  const abspathfs = abs.split(path.sep).join('/');
  const vars = { project: loc.project, relpath: loc.relpath, abspath: abs, abspathfs, basename: path.basename(abs) };
  const links = (cfg.links ?? defaultLinks(cfg.ide ?? 'idea', cfg.ideServerPort ?? 63342))
    .map((l) => ({ label: l.label, url: fill(l.url, vars) }));

  const when = new Date();
  const stamp = when.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const subject = `${cfg.subjectPrefix} ${from}: ${title}`;

  const body = [
    summary,
    '',
    `File: ${abs}`,
    `Project: ${loc.project}  (${loc.relpath})`,
    '',
    ...links.map((l) => `${l.label}:\n  ${l.url}`),
    '',
    `-- sent by /send-results from ${os.hostname()} | ${from} | ${stamp}`,
  ].join('\n');

  const htmlBody = [
    '<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.45;color:#222">',
    `<p>${esc(summary).replace(/\r?\n/g, '<br>')}</p>`,
    `<p><b>File:</b> <code style="font-size:13px">${esc(abs)}</code><br>`,
    `<b>Project:</b> ${esc(loc.project)} <span style="color:#777">(${esc(loc.relpath)})</span></p>`,
    '<ul style="padding-left:18px">',
    ...links.map((l) => `<li><a href="${esc(l.url)}">${esc(l.label)}</a></li>`),
    '</ul>',
    `<p style="color:#777;font-size:12px">sent by /send-results from ${esc(os.hostname())} &middot; ${esc(from)} &middot; ${esc(stamp)}</p>`,
    '</div>',
  ].join('\n');

  const out = {
    send: { to: cfg.to, subject, body, htmlBody },
    labelIds: cfg.label?.id ? [cfg.label.id] : [],
    labelName: cfg.label?.name ?? null,
    file: { path: abs, project: loc.project, relpath: loc.relpath, bytes: stat.size, modified: stat.mtime.toISOString() },
    links,
  };
  console.log(JSON.stringify(out, null, 2));
}

const [cmd, ...argv] = process.argv.slice(2);
const parsed = parseArgs(argv);
if (cmd === 'init') init(parsed.flags);
else if (cmd === 'compose') compose(parsed);
else if (cmd === 'config') {
  if (!fs.existsSync(CONFIG)) die(3, `no configuration at ${CONFIG} — run: /send-results setup`);
  process.stdout.write(fs.readFileSync(CONFIG, 'utf8'));
} else {
  console.error('usage: results.mjs init --to <addr> [--label-id <id>] [--label-name <name>] [--ide idea|rustrover|...] [--port 63342] [--prefix "[results]"]');
  console.error('       results.mjs compose <file> [--from <name>] [--title <text>] -- <summary...>');
  console.error('       results.mjs config');
  process.exit(2);
}
