#!/usr/bin/env node
import { setDisposition } from './lib/inbox.mjs';
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const inbox = opt('--inbox'), stamp = opt('--stamp'), filed = opt('--filed'), dismissed = opt('--dismissed');
if (!inbox || !stamp || (!filed && !dismissed)) { process.stderr.write('usage: disposition --inbox <file> --stamp <stamp> (--filed "<file § Section>" | --dismissed "<reason>")\n'); process.exit(2); }
setDisposition(inbox, stamp, filed ? { state: 'FILED', detail: `filed → ${filed}` } : { state: 'DISMISSED', detail: `dismissed: ${dismissed}` });
process.stdout.write(`${stamp}: ${filed ? 'filed' : 'dismissed'}\n`);
