# PRAETOR — Proof of Concept

A minimal, dependency-free implementation of the core cognitive loop from the
[PRAETOR concept paper v0.3](docs/PRAETOR-concept-paper-v0.3.md) (EIC
Pathfinder **DeepRAP** challenge): a governed memory lifecycle, persistent
planning, and epistemic typing — the architecture *around* the model, with no
LLM in the loop yet, because the governance layer is the part under test
(hypotheses H1–H3).

## What this PoC demonstrates

This corresponds to the **90-day plan, Months 1–2** (paper §8):

| Paper concept | Implementation |
|---|---|
| Volatile episodic buffer, 14-day retention (§4.4) | `src/episodicBuffer.js` — everything enters here first; a sweep archives or deletes stale episodes, each transition logged with its rule |
| Promotion rules v0 (§3 Obj. 1, N1) | `src/promotionEngine.js` — R1 user-marked, R2 correction, R3 repetition (≥3), R4 confirmed; every promotion logged with rule + evidence |
| Evidence-linked semantic memory (§4.5, N3) | `src/semanticMemory.js` — entries carry episode pointers; unsupported entries decay and are removed; contradictions detected at write time |
| Epistemic typing (§4.7, N2) | `src/epistemic.js` — fact / inference / assumption / hypothesis / decision / risk; a fact without evidence is invalid **by construction** |
| Persistent planning controller (§4.9, N4) | `src/planner.js` — versioned plans survive restarts; re-plans logged with trigger; blocked-task detection from dependency state |
| Working memory controller (§4.3) | `src/workingMemory.js` |
| Auditable retention (§4.8 trust layer) | `src/auditLog.js` — append-only JSONL; "why do I remember this?" is answerable from the log |
| Compressed longitudinal time (§7.1) | `src/clock.js` — injectable clock; 30–90 day scenarios replay in milliseconds |

Deliberate simplifications, to be replaced in the full prototype (§5 Phase 2):

- **Retrieval** is keyword-overlap (`src/textMatch.js`), not embeddings. The
  interface is what a vector backend would replace.
- **Storage** is JSON/JSONL files, not SQLite + vector store.
- **No LLM calls.** The reasoning engine and input interpreter are out of
  scope for Month 1–2; observations arrive pre-structured.

## Run it

Requires Node 18+. No dependencies to install.

```bash
npm test         # 13 tests covering promotion rules, decay, contradiction,
                 # recall, epistemic constraints, plan persistence

npm run demo1    # Paper §8 Demo 1: recall a user correction 15 simulated
                 # days later — outside any context window — and show WHY
                 # it was retained (rule fired + evidence episodes)

npm run demo2    # Paper §8 Demo 2: a plan survives a full restart and a
                 # mid-project requirement change; the re-plan is logged
                 # with its trigger; a blocked subtask is detected
```

## Example: the retention story (Demo 1 output)

```json
{
  "statement": "Correction: the dashboard backend runs on port 3001, not 3000",
  "confidence": 0.95,
  "retainedBecause": "R2_user_correction",
  "promotedAt": "2026-07-07T09:00:00.000Z",
  "evidence": [
    { "episode": 3, "kind": "correction", "status": "promoted" }
  ]
}
```

This is the PoC's central claim in miniature: **retention itself is a
rule-based, logged, auditable process** — not an unbounded write-on-heuristic
store, and not a context window.

## Next steps (toward Demo 3 / LTM-Bench v0)

1. Scenario generator: planted facts, later corrections, contradictions,
   distractors over a simulated 30–90 day horizon (paper §7.1, Suite 1).
2. Two baselines under the same scenarios: long-context replay and naive
   store-everything retrieval (paper §7.2).
3. Metrics: memory precision, false-memory rate, correction uptake latency.
4. Swap `textMatch` for a local embedding backend (Ollama on the Victus
   node) behind the same interface.
5. Surface memory + audit trail in the cluster dashboard as the inspection
   UI (paper §5 Phase 2).
