// Epistemic typing (paper §4.7, novelty claim N2). Every output the system
// emits is a typed claim, and the type carries structural constraints:
// a FACT without evidence links is invalid by construction.

const TYPES = ['fact', 'inference', 'assumption', 'hypothesis', 'decision', 'risk'];

function typedOutput({ type, content, evidence = [], confidence = null }) {
  if (!TYPES.includes(type)) {
    throw new Error(`Unknown epistemic type: ${type}`);
  }
  if (type === 'fact' && evidence.length === 0) {
    throw new Error('A fact requires at least one evidence link (N3)');
  }
  return { type, content, evidence, confidence };
}

module.exports = { TYPES, typedOutput };
