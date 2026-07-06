// Evidence-linked long-term semantic memory (paper §4.5, novelty claim N3).
// Every entry carries pointers back to the episodic evidence that produced
// it; an entry whose evidence is gone decays and is eventually removed.
// Contradictions (a new promotion clashing with a stored entry) are
// detected at write time and logged.

const { rank, similarity } = require('./textMatch');

const DECAY_STEP = 0.25; // confidence lost per decay pass without evidence
const REMOVE_BELOW = 0.2;

class SemanticMemory {
  constructor(store, auditLog, clock) {
    this.store = store;
    this.audit = auditLog;
    this.clock = clock;
    this.entries = store.readJson('semantic.json', []);
    this._nextId = this.entries.reduce((m, e) => Math.max(m, e.id), 0) + 1;
  }

  _save() {
    this.store.writeJson('semantic.json', this.entries);
  }

  activeEntries() {
    return this.entries.filter((e) => e.status === 'active');
  }

  hasEvidence(episodeId) {
    return this.entries.some(
      (e) => e.status === 'active' && e.evidence.includes(episodeId)
    );
  }

  promoteFromEpisode(episode, { rule, evidence }) {
    // Contradiction check (write-time): does an active entry make a
    // conflicting claim about the same subject?
    const conflict = this.activeEntries().find(
      (e) =>
        similarity(e.statement, episode.content) >= 0.5 &&
        e.statement !== episode.content
    );

    const entry = {
      id: this._nextId++,
      statement: episode.content,
      kind: episode.kind,
      evidence, // episode ids
      promotionRule: rule,
      confidence: episode.kind === 'correction' ? 0.95 : 0.8,
      createdAt: this.clock.nowIso(),
      lastValidated: this.clock.nowIso(),
      status: 'active',
      supersedes: null,
    };

    if (conflict) {
      // A correction beats what it corrects; otherwise flag for review.
      if (episode.kind === 'correction' || entry.confidence > conflict.confidence) {
        conflict.status = 'superseded';
        entry.supersedes = conflict.id;
        this.audit.record('memory.contradiction.resolved', {
          subjectId: entry.id,
          supersededEntry: conflict.id,
          oldStatement: conflict.statement,
          newStatement: entry.statement,
          rule: 'correction_supersedes',
        });
      } else {
        entry.flagged = true;
        this.audit.record('memory.contradiction.flagged', {
          subjectId: entry.id,
          conflictingEntry: conflict.id,
        });
      }
    }

    this.entries.push(entry);
    this._save();
    return entry;
  }

  // Decay pass: entries whose evidence episodes no longer exist (deleted
  // without archive) lose confidence each pass and are removed below the
  // floor. Structural defence against false memories.
  decay(episodicBuffer) {
    const removed = [];
    for (const entry of this.activeEntries()) {
      const supported = entry.evidence.some((id) => {
        const ep = episodicBuffer.get(id);
        return ep && ep.status !== 'deleted';
      });
      if (supported) continue;
      entry.confidence -= DECAY_STEP;
      this.audit.record('memory.decayed', {
        subjectId: entry.id,
        confidence: entry.confidence,
        rule: 'unsupported_evidence_decay',
      });
      if (entry.confidence < REMOVE_BELOW) {
        entry.status = 'removed';
        removed.push(entry.id);
        this.audit.record('memory.removed', {
          subjectId: entry.id,
          rule: 'confidence_below_floor',
        });
      }
    }
    this._save();
    return removed;
  }

  recall(query, limit = 3) {
    return rank(query, this.activeEntries(), (e) => e.statement)
      .slice(0, limit)
      .map((r) => ({ ...r.item, score: r.score }));
  }

  // "Why do I remember this?" — reconstruct the retention story from the
  // audit trail: the promotion event, its rule, and its evidence episodes.
  explain(entryId, episodicBuffer) {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry) return null;
    const promotion = this.audit
      .all()
      .find((e) => e.event === 'memory.promoted' && e.subjectId === entryId);
    return {
      statement: entry.statement,
      confidence: entry.confidence,
      retainedBecause: promotion ? promotion.rule : entry.promotionRule,
      promotedAt: promotion ? promotion.at : entry.createdAt,
      evidence: entry.evidence.map((id) => {
        const ep = episodicBuffer.get(id);
        return ep
          ? { episode: id, at: ep.at, kind: ep.kind, content: ep.content, status: ep.status }
          : { episode: id, status: 'missing' };
      }),
      supersedes: entry.supersedes,
    };
  }
}

module.exports = { SemanticMemory };
