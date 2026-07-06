// PRAETOR facade: wires clock, stores, buffer, promotion, semantic memory,
// working memory and planner into one cognitive loop (paper §4.1). The LLM
// is deliberately absent from this PoC — everything here is the governance
// around the model, which is the part under test (H1–H3).

const { Clock } = require('./clock');
const { Store } = require('./store');
const { AuditLog } = require('./auditLog');
const { EpisodicBuffer } = require('./episodicBuffer');
const { SemanticMemory } = require('./semanticMemory');
const { PromotionEngine } = require('./promotionEngine');
const { WorkingMemory } = require('./workingMemory');
const { Planner } = require('./planner');
const { typedOutput } = require('./epistemic');

class Praetor {
  constructor(dataDir, clock = new Clock()) {
    this.clock = clock;
    this.store = new Store(dataDir);
    this.audit = new AuditLog(this.store, clock);
    this.buffer = new EpisodicBuffer(this.store, this.audit, clock);
    this.semantic = new SemanticMemory(this.store, this.audit, clock);
    this.promotion = new PromotionEngine(this.buffer, this.semantic, this.audit);
    this.working = new WorkingMemory(this.store, this.audit, clock);
    this.planner = new Planner(this.store, this.audit, clock);
  }

  // Ingest an event, then run the promotion rules (the "consolidation tick").
  observe(episodeInput) {
    const ep = this.buffer.add(episodeInput);
    this.promotion.run();
    return ep;
  }

  // Maintenance tick: expire stale episodes, decay unsupported memories.
  maintain() {
    const swept = this.buffer.sweep();
    const removed = this.semantic.decay(this.buffer);
    return { swept, removed };
  }

  // Answer a query from memory with an epistemically typed output:
  //  - strong match in semantic memory -> FACT with evidence links
  //  - weak match                      -> ASSUMPTION with what it's based on
  //  - no match                        -> typed admission of ignorance
  answer(query) {
    const hits = this.semantic.recall(query);
    if (hits.length === 0) {
      return typedOutput({
        type: 'assumption',
        content: `No stored memory matches "${query}" — answering would be a guess.`,
        confidence: 0,
      });
    }
    const best = hits[0];
    if (best.score >= 0.5) {
      return typedOutput({
        type: 'fact',
        content: best.statement,
        evidence: best.evidence,
        confidence: best.confidence,
      });
    }
    return typedOutput({
      type: 'assumption',
      content: `Possibly relevant: "${best.statement}" (weak match, score ${best.score.toFixed(2)})`,
      evidence: best.evidence,
      confidence: Math.min(best.confidence, 0.4),
    });
  }

  explainMemory(entryId) {
    return this.semantic.explain(entryId, this.buffer);
  }
}

module.exports = { Praetor, Clock };
