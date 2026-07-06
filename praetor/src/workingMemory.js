// Working memory controller (paper §4.3): the active context of the current
// task — what was asked, what is known, what was tried, what failed, what
// remains open. Persisted so a restart does not lose the thread.

class WorkingMemory {
  constructor(store, auditLog, clock) {
    this.store = store;
    this.audit = auditLog;
    this.clock = clock;
    this.state = store.readJson('working.json', {
      currentTask: null,
      openConstraints: [],
      tried: [],
      failed: [],
      openQuestions: [],
    });
  }

  _save() {
    this.store.writeJson('working.json', this.state);
  }

  setTask(description) {
    this.state.currentTask = { description, since: this.clock.nowIso() };
    this._save();
    this.audit.record('working.task_set', { content: description });
  }

  addConstraint(text) {
    this.state.openConstraints.push(text);
    this._save();
  }

  noteAttempt(what, { failed = false, reason = null } = {}) {
    this.state.tried.push(what);
    if (failed) this.state.failed.push({ what, reason });
    this._save();
    this.audit.record('working.attempt', { content: what, failed, reason });
  }

  snapshot() {
    return JSON.parse(JSON.stringify(this.state));
  }
}

module.exports = { WorkingMemory };
