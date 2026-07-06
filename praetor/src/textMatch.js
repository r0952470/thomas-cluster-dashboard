// Keyword-overlap retrieval and similarity. Honest placeholder for the
// vector store of the full prototype (paper §5 Phase 2) — deterministic,
// dependency-free, good enough to demonstrate the memory lifecycle. The
// interface (score two strings, rank candidates) is what a real embedding
// backend would replace.

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on',
  'for', 'and', 'or', 'not', 'it', 'this', 'that', 'we', 'i', 'you',
  'what', 'which', 'does', 'do', 'use', 'uses', 'should',
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t));
}

function similarity(a, b) {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.min(ta.size, tb.size);
}

function rank(query, candidates, textOf) {
  return candidates
    .map((c) => ({ item: c, score: similarity(query, textOf(c)) }))
    .filter((r) => r.score > 0)
    .sort((x, y) => y.score - x.score);
}

module.exports = { tokenize, similarity, rank };
