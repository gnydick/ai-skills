#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pluginRoot } from './lib/config.mjs';
const i = process.argv.indexOf('--plugin');
const dir = i >= 0 ? path.resolve(process.argv[i + 1]) : pluginRoot();
const f = path.join(dir, '.claude-plugin', 'plugin.json');
const text = fs.readFileSync(f, 'utf8');
const m = /"version":\s*"(\d+)\.(\d+)\.(\d+)"/.exec(text);
if (!m) { process.stderr.write(`no semver version in ${f}\n`); process.exit(1); }
const next = `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
fs.writeFileSync(f, text.replace(m[0], `"version": "${next}"`), 'utf8');
process.stdout.write(next + '\n');
