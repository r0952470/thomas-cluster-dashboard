// Volatile episodic buffer (paper §4.4). Everything enters here first;
// nothing becomes permanent automatically. After RETENTION_DAYS a sweep
// decides — per logged rule — whether each episode is promoted, archived
// or deleted.

const RETENTION_DAYS = 14;

class EpisodicBuffer {
  constructor(store, auditLog, clock) {
    this.store = store;
    this.audit = auditLog;
    this.clock = clock;
    this.episodes = store.readJson('episodes.json', []);
    this._nextId = this.episodes.reduce((m, e) => Math.max(m, e.id), 0) + 1;
  }

  _save() {
    this.store.writeJson('episodes.json', this.episodes);
  }

  // kind: 'utterance' | 'correction' | 'decision' | 'tool_output' | 'error' | 'note'
  add({ kind, content, tags = [], source = 'user', marked = false }) {
    const episode = {
      id: this._nextId++,
      at: this.clock.nowIso(),
      atMs: this.clock.now(),
      kind,
      content,
      tags,
      source,
      marked, // explicit "remember this" from the user
      confirmed: false,
      status: 'active', // active | promoted | archived | deleted
    };
    this.episodes.push(episode);
    this._save();
    this.audit.record('episode.recorded', {
      subjectId: episode.id,
      kind,
      content,
    });
    return episode;
  }

  confirm(episodeId) {
    const ep = this.get(episodeId);
    if (ep) {
      ep.confirmed = true;
      this._save();
      this.audit.record('episode.confirmed', { subjectId: episodeId });
    }
    return ep;
  }

  get(id) {
    return this.episodes.find((e) => e.id === id);
  }

  active() {
    return this.episodes.filter((e) => e.status === 'active');
  }

  // Expire episodes past retention. Promotion is decided by the caller
  // (PromotionEngine) BEFORE expiry; whatever is still 'active' and stale
  // here is archived (corrections, decisions) or deleted (chatter),
  // each transition logged.
  sweep() {
    const swept = { archived: [], deleted: [] };
    for (const ep of this.active()) {
      const age = this.clock.daysBetween(ep.atMs);
      if (age < RETENTION_DAYS) continue;
      if (ep.kind === 'correction' || ep.kind === 'decision') {
        ep.status = 'archived';
        swept.archived.push(ep.id);
        this.audit.record('episode.archived', {
          subjectId: ep.id,
          rule: 'retention_expiry_archive_significant_kinds',
          ageDays: Math.round(age),
        });
      } else {
        ep.status = 'deleted';
        swept.deleted.push(ep.id);
        this.audit.record('episode.deleted', {
          subjectId: ep.id,
          rule: 'retention_expiry_delete_unpromoted',
          ageDays: Math.round(age),
        });
      }
    }
    this._save();
    return swept;
  }
}

module.exports = { EpisodicBuffer, RETENTION_DAYS };
