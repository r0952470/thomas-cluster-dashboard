// Append-only audit trail (paper §4.8 trust layer, novelty claim N1).
// Every memory transition — write, promotion, decay, deletion, contradiction,
// re-plan — lands here with the rule that triggered it and its evidence, so
// retention itself is auditable, not just retrieval.

class AuditLog {
  constructor(store, clock) {
    this.store = store;
    this.clock = clock;
  }

  record(event, detail = {}) {
    const entry = { at: this.clock.nowIso(), event, ...detail };
    this.store.appendLine('audit.jsonl', entry);
    return entry;
  }

  all() {
    return this.store.readLines('audit.jsonl');
  }

  forSubject(subjectId) {
    return this.all().filter(
      (e) =>
        e.subjectId === subjectId ||
        (Array.isArray(e.evidence) && e.evidence.includes(subjectId))
    );
  }
}

module.exports = { AuditLog };
