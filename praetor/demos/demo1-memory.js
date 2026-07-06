// Demo 1 (paper §8, Month 1): the system recalls a user correction made
// 14+ days earlier — outside any context window — and can show WHY it
// retained it: which rule fired, which episodes are the evidence.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { Praetor, Clock } = require('../src/praetor');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'praetor-demo1-'));
const clock = Clock.frozen('2026-07-06T09:00:00Z');
const praetor = new Praetor(dataDir, clock);

console.log('=== PRAETOR Demo 1: governed memory lifecycle ===\n');

// Day 0 — normal working chatter enters the episodic buffer.
praetor.observe({ kind: 'utterance', content: 'Working on the cluster dashboard today' });
praetor.observe({ kind: 'utterance', content: 'The backend runs on port 3000 I think' });

// Day 1 — the user corrects a fact. Rule R2 promotes corrections.
clock.advanceDays(1);
const correction = praetor.observe({
  kind: 'correction',
  content: 'Correction: the dashboard backend runs on port 3001, not 3000',
});
console.log(`Day 1: user correction recorded as episode #${correction.id} and promoted (rule R2)\n`);

// 15 days pass. Retention sweep expires unpromoted chatter.
clock.advanceDays(15);
const { swept } = praetor.maintain();
console.log(`Day 16: retention sweep — deleted episodes ${JSON.stringify(swept.deleted)}, archived ${JSON.stringify(swept.archived)}`);
console.log('The original chatter is gone; no context window contains the correction.\n');

// The question arrives 15 days after the correction.
const answer = praetor.answer('which port does the dashboard backend run on?');
console.log('Query: which port does the dashboard backend run on?');
console.log(`Answer [${answer.type.toUpperCase()}] (confidence ${answer.confidence}):`);
console.log(`  "${answer.content}"`);
console.log(`  evidence episodes: ${JSON.stringify(answer.evidence)}\n`);

// And the retention story — why is this remembered at all?
const entryId = praetor.semantic.activeEntries()[0].id;
const why = praetor.explainMemory(entryId);
console.log('Why is this remembered? (audit reconstruction)');
console.log(JSON.stringify(why, null, 2));

console.log(`\nFull audit trail: ${path.join(dataDir, 'audit.jsonl')}`);
console.log(`Audit events recorded: ${praetor.audit.all().length}`);
