// Demo 2 (paper §8, Month 2): a multi-day project plan survives a full
// system restart and a mid-project requirement change; the re-planning
// event is logged with its trigger, and a blocked task is detected.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { Praetor, Clock } = require('../src/praetor');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'praetor-demo2-'));
const clock = Clock.frozen('2026-07-06T09:00:00Z');

console.log('=== PRAETOR Demo 2: persistent planning ===\n');

// Session 1: create the plan.
{
  const praetor = new Praetor(dataDir, clock);
  const plan = praetor.planner.createPlan({
    goal: 'Build the PRAETOR PoC memory subsystem',
    subgoals: [
      { title: 'Design memory schema' },
      { title: 'Implement episodic buffer', dependsOn: [1] },
      { title: 'Implement promotion engine', dependsOn: [2] },
      { title: 'Run LTM-Bench v0', dependsOn: [3] },
    ],
    constraints: ['runs on consumer hardware', 'no cloud dependency'],
    fallbacks: ['drop vector search, keyword retrieval only'],
    stopConditions: ['LTM-Bench v0 passes on 15 scenarios'],
  });
  praetor.planner.markProgress(plan.id, 1, 'done');
  praetor.planner.markProgress(plan.id, 2, 'in_progress');
  console.log(`Session 1: plan v${plan.version} created, subgoal 1 done, subgoal 2 in progress.`);
}

// Three days pass. FULL RESTART: a new process instance loads from disk.
clock.advanceDays(3);
{
  const praetor = new Praetor(dataDir, clock); // fresh instance, same data dir
  const plan = praetor.planner.activePlan();
  console.log(`\nSession 2 (after restart, +3 days): plan v${plan.version} restored from disk.`);
  console.log(`  goal: "${plan.goal}"`);
  console.log(`  progress: ${plan.subgoals.map((s) => `${s.title}=${s.status}`).join(', ')}`);

  // Requirement change arrives mid-project.
  praetor.planner.replan(plan.id, {
    trigger: 'requirement_change: benchmark must also include vector-RAG baseline',
    changes: {
      addSubgoals: [{ title: 'Implement vector-RAG baseline', dependsOn: [3] }],
    },
  });
  console.log(`\n  Re-planned -> v${plan.version}. Trigger logged in audit trail.`);

  // Someone starts the benchmark before the promotion engine is done.
  praetor.planner.markProgress(plan.id, 4, 'in_progress');
  const blocked = praetor.planner.detectBlocked(plan.id);
  console.log(`  Blocked-task detection: ${JSON.stringify(blocked)}`);

  const replanEvents = praetor.audit.all().filter((e) => e.event === 'plan.replanned');
  console.log('\nAudit record of the re-plan:');
  console.log(JSON.stringify(replanEvents, null, 2));
  console.log(`\nPlan history versions preserved: ${plan.history.length}`);
}
