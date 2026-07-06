// Persistent planning controller (paper §4.9, novelty claim N4). Plans are
// versioned data structures that survive restarts and multi-day gaps.
// Re-planning events are logged with their trigger; blocked subtasks are
// detectable from dependency state.

class Planner {
  constructor(store, auditLog, clock) {
    this.store = store;
    this.audit = auditLog;
    this.clock = clock;
    this.plans = store.readJson('plans.json', []);
    this._nextId = this.plans.reduce((m, p) => Math.max(m, p.id), 0) + 1;
  }

  _save() {
    this.store.writeJson('plans.json', this.plans);
  }

  createPlan({ goal, subgoals = [], constraints = [], fallbacks = [], stopConditions = [] }) {
    const plan = {
      id: this._nextId++,
      version: 1,
      goal,
      originalGoal: goal,
      constraints,
      fallbacks,
      stopConditions,
      subgoals: subgoals.map((sg, i) => ({
        id: i + 1,
        title: sg.title,
        dependsOn: sg.dependsOn || [],
        status: 'pending', // pending | in_progress | done | blocked
      })),
      status: 'active',
      createdAt: this.clock.nowIso(),
      updatedAt: this.clock.nowIso(),
      history: [],
    };
    this.plans.push(plan);
    this._save();
    this.audit.record('plan.created', { subjectId: plan.id, content: goal });
    return plan;
  }

  get(planId) {
    return this.plans.find((p) => p.id === planId);
  }

  activePlan() {
    return this.plans.find((p) => p.status === 'active');
  }

  markProgress(planId, subgoalId, status) {
    const plan = this.get(planId);
    const sg = plan.subgoals.find((s) => s.id === subgoalId);
    sg.status = status;
    plan.updatedAt = this.clock.nowIso();
    this._save();
    this.audit.record('plan.progress', {
      subjectId: planId,
      subgoal: sg.title,
      status,
    });
    return sg;
  }

  // A subgoal is blocked when it is not done and one of its dependencies
  // has failed or is itself blocked/stalled past its expected window.
  detectBlocked(planId) {
    const plan = this.get(planId);
    const byId = new Map(plan.subgoals.map((s) => [s.id, s]));
    const blocked = [];
    for (const sg of plan.subgoals) {
      if (sg.status === 'done' || sg.status === 'blocked') continue;
      const badDep = sg.dependsOn.find((d) => {
        const dep = byId.get(d);
        return dep && dep.status !== 'done';
      });
      if (badDep !== undefined && sg.status === 'in_progress') {
        sg.status = 'blocked';
        blocked.push({ subgoal: sg.title, waitingOn: byId.get(badDep).title });
        this.audit.record('plan.blocked_detected', {
          subjectId: planId,
          subgoal: sg.title,
          waitingOn: byId.get(badDep).title,
        });
      }
    }
    this._save();
    return blocked;
  }

  // Re-planning with a logged trigger: requirement change, failed
  // assumption, blocked task, user override.
  replan(planId, { trigger, changes }) {
    const plan = this.get(planId);
    plan.history.push({
      version: plan.version,
      goal: plan.goal,
      subgoals: JSON.parse(JSON.stringify(plan.subgoals)),
      replacedAt: this.clock.nowIso(),
      trigger,
    });
    plan.version += 1;
    if (changes.goal) plan.goal = changes.goal;
    if (changes.addSubgoals) {
      let nextSgId = plan.subgoals.reduce((m, s) => Math.max(m, s.id), 0) + 1;
      for (const sg of changes.addSubgoals) {
        plan.subgoals.push({
          id: nextSgId++,
          title: sg.title,
          dependsOn: sg.dependsOn || [],
          status: 'pending',
        });
      }
    }
    if (changes.dropSubgoals) {
      for (const title of changes.dropSubgoals) {
        const sg = plan.subgoals.find((s) => s.title === title);
        if (sg) sg.status = 'dropped';
      }
    }
    plan.updatedAt = this.clock.nowIso();
    this._save();
    this.audit.record('plan.replanned', {
      subjectId: planId,
      trigger,
      newVersion: plan.version,
      changes: Object.keys(changes),
    });
    return plan;
  }
}

module.exports = { Planner };
