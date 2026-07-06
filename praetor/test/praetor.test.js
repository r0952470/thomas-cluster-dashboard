const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { Praetor, Clock } = require('../src/praetor');
const { typedOutput } = require('../src/epistemic');

function fresh() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'praetor-test-'));
  const clock = Clock.frozen('2026-07-06T09:00:00Z');
  return { praetor: new Praetor(dataDir, clock), clock, dataDir };
}

test('corrections are promoted to long-term memory (rule R2)', () => {
  const { praetor } = fresh();
  praetor.observe({ kind: 'correction', content: 'The API key lives in backend/.env' });
  const entries = praetor.semantic.activeEntries();
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].promotionRule, 'R2_user_correction');
  assert.ok(entries[0].evidence.length > 0);
});

test('ordinary chatter is NOT promoted and is deleted after 14 days', () => {
  const { praetor, clock } = fresh();
  const ep = praetor.observe({ kind: 'utterance', content: 'nice weather today' });
  assert.strictEqual(praetor.semantic.activeEntries().length, 0);
  clock.advanceDays(15);
  const { swept } = praetor.maintain();
  assert.deepStrictEqual(swept.deleted, [ep.id]);
  assert.strictEqual(praetor.buffer.get(ep.id).status, 'deleted');
});

test('explicitly marked episodes are promoted (rule R1)', () => {
  const { praetor } = fresh();
  praetor.observe({ kind: 'note', content: 'Victus node IP is 100.101.9.116', marked: true });
  const entries = praetor.semantic.activeEntries();
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].promotionRule, 'R1_user_marked');
});

test('repetition across episodes triggers promotion (rule R3)', () => {
  const { praetor } = fresh();
  praetor.observe({ kind: 'utterance', content: 'deploy target is the Victus node' });
  praetor.observe({ kind: 'utterance', content: 'remember deploy target is the Victus node' });
  praetor.observe({ kind: 'utterance', content: 'again: deploy target is the Victus node' });
  const promoted = praetor.semantic.activeEntries();
  assert.strictEqual(promoted.length, 1);
  assert.strictEqual(promoted[0].promotionRule, 'R3_repetition');
  assert.ok(promoted[0].evidence.length >= 3);
});

test('correction supersedes contradicting memory, logged as contradiction', () => {
  const { praetor } = fresh();
  praetor.observe({ kind: 'note', content: 'backend runs on port 3000', marked: true });
  praetor.observe({ kind: 'correction', content: 'backend runs on port 3001' });
  const active = praetor.semantic.activeEntries();
  assert.strictEqual(active.length, 1);
  assert.strictEqual(active[0].statement, 'backend runs on port 3001');
  assert.ok(active[0].supersedes !== null);
  const events = praetor.audit.all().map((e) => e.event);
  assert.ok(events.includes('memory.contradiction.resolved'));
});

test('recall after 15 days returns a FACT with evidence links', () => {
  const { praetor, clock } = fresh();
  praetor.observe({ kind: 'correction', content: 'dashboard backend runs on port 3001' });
  clock.advanceDays(15);
  praetor.maintain();
  const answer = praetor.answer('what port does the backend run on?');
  assert.strictEqual(answer.type, 'fact');
  assert.ok(answer.evidence.length > 0);
});

test('unknown queries return a typed non-answer, never a fabricated fact', () => {
  const { praetor } = fresh();
  const answer = praetor.answer('what is the capital of France?');
  assert.notStrictEqual(answer.type, 'fact');
});

test('a fact without evidence is structurally invalid (N2/N3)', () => {
  assert.throws(() => typedOutput({ type: 'fact', content: 'x', evidence: [] }));
});

test('memory explanation reconstructs rule + evidence from audit trail', () => {
  const { praetor } = fresh();
  praetor.observe({ kind: 'correction', content: 'use pnpm not npm in this repo' });
  const entry = praetor.semantic.activeEntries()[0];
  const why = praetor.explainMemory(entry.id);
  assert.strictEqual(why.retainedBecause, 'R2_user_correction');
  assert.ok(why.evidence[0].content.includes('pnpm'));
});

test('plans survive restart with version and progress intact', () => {
  const { praetor, clock, dataDir } = fresh();
  const plan = praetor.planner.createPlan({
    goal: 'ship PoC',
    subgoals: [{ title: 'a' }, { title: 'b', dependsOn: [1] }],
  });
  praetor.planner.markProgress(plan.id, 1, 'done');
  clock.advanceDays(2);
  const reborn = new Praetor(dataDir, clock);
  const restored = reborn.planner.activePlan();
  assert.strictEqual(restored.goal, 'ship PoC');
  assert.strictEqual(restored.subgoals[0].status, 'done');
});

test('replan bumps version, preserves history, logs trigger', () => {
  const { praetor } = fresh();
  const plan = praetor.planner.createPlan({ goal: 'g', subgoals: [{ title: 'a' }] });
  praetor.planner.replan(plan.id, {
    trigger: 'requirement_change',
    changes: { addSubgoals: [{ title: 'b' }] },
  });
  assert.strictEqual(plan.version, 2);
  assert.strictEqual(plan.history.length, 1);
  const ev = praetor.audit.all().find((e) => e.event === 'plan.replanned');
  assert.strictEqual(ev.trigger, 'requirement_change');
});

test('blocked subgoal is detected when dependency is not done', () => {
  const { praetor } = fresh();
  const plan = praetor.planner.createPlan({
    goal: 'g',
    subgoals: [{ title: 'dep' }, { title: 'work', dependsOn: [1] }],
  });
  praetor.planner.markProgress(plan.id, 2, 'in_progress');
  const blocked = praetor.planner.detectBlocked(plan.id);
  assert.strictEqual(blocked.length, 1);
  assert.strictEqual(blocked[0].waitingOn, 'dep');
});

test('unsupported memories decay and are removed (false-memory defence)', () => {
  const { praetor, clock } = fresh();
  // Promote from a plain utterance via marking, then delete its evidence.
  const ep = praetor.observe({ kind: 'utterance', content: 'temp fact', marked: true });
  clock.advanceDays(15);
  praetor.maintain(); // sweep deletes the (already promoted? no: promoted eps keep status 'promoted')
  // Force the pathological case: evidence episode hard-deleted.
  praetor.buffer.get(ep.id).status = 'deleted';
  let removed = [];
  for (let i = 0; i < 5 && removed.length === 0; i++) {
    removed = praetor.semantic.decay(praetor.buffer);
  }
  assert.strictEqual(removed.length, 1);
  const events = praetor.audit.all().map((e) => e.event);
  assert.ok(events.includes('memory.decayed'));
  assert.ok(events.includes('memory.removed'));
});
