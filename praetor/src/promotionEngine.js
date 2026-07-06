// Promotion engine v0 (paper §3 Objective 1, §8 Month 1, novelty claim N1).
// Rules decide what leaves the volatile buffer for long-term memory; every
// promotion is logged with the rule that fired and the episodes that are
// its evidence.
//
// v0 rules:
//   R1 user_marked     — user explicitly said "remember this"
//   R2 user_correction — corrections are always promoted (reflective memory)
//   R3 repetition      — same claim appears in >= REPEAT_THRESHOLD episodes
//   R4 confirmed       — user confirmed a system-proposed memory

const REPEAT_THRESHOLD = 3;

const { tokenize, similarity } = require('./textMatch');

class PromotionEngine {
  constructor(episodicBuffer, semanticMemory, auditLog) {
    this.buffer = episodicBuffer;
    this.semantic = semanticMemory;
    this.audit = auditLog;
  }

  // Evaluate all active episodes against the rules; promote matches.
  run() {
    const promoted = [];
    const active = this.buffer.active();

    for (const ep of active) {
      let rule = null;
      let evidence = [ep.id];

      if (ep.marked) {
        rule = 'R1_user_marked';
      } else if (ep.kind === 'correction') {
        rule = 'R2_user_correction';
      } else if (ep.confirmed) {
        rule = 'R4_confirmed';
      } else {
        const similar = active.filter(
          (other) =>
            other.id !== ep.id && similarity(ep.content, other.content) >= 0.6
        );
        if (similar.length + 1 >= REPEAT_THRESHOLD) {
          rule = 'R3_repetition';
          evidence = [ep.id, ...similar.map((s) => s.id)].sort((a, b) => a - b);
          // Only promote once per repetition cluster (anchor on lowest id).
          if (evidence[0] !== ep.id) rule = null;
        }
      }

      if (!rule) continue;
      if (this.semantic.hasEvidence(ep.id)) continue; // already promoted

      const entry = this.semantic.promoteFromEpisode(ep, { rule, evidence });
      ep.status = 'promoted';
      promoted.push(entry);
      this.audit.record('memory.promoted', {
        subjectId: entry.id,
        rule,
        evidence,
        content: entry.statement,
      });
    }

    this.buffer._save();
    return promoted;
  }
}

module.exports = { PromotionEngine, REPEAT_THRESHOLD, tokenize };
