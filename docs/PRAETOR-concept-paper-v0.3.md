# PRAETOR: A Persistent Cognitive Memory Architecture for Trustworthy Reasoning, Abstraction and Long-Term Planning in AI Agents

**Concept Paper v0.3**

**Applicant:** Thomas Huybrechts — Single Research Applicant (Victus AI, Belgium)
**Programme fit:** EIC Pathfinder Challenge — DeepRAP: Deep Reasoning, Abstraction & Planning towards Trustworthy Cognitive AI Systems (HORIZON-EIC-2026-PATHFINDERCHALLENGES, deadline 28 October 2026)
**Proposed project type:** High-risk / high-gain cognitive AI research
**Technology Readiness Level:** TRL 1–2 at start, targeting TRL 4 proof-of-concept demonstrator
**Duration:** 36 months
**Keywords:** cognitive AI, memory architecture, neuro-symbolic reasoning, agentic systems, long-term planning, explainability, AI trustworthiness, local-first AI, evaluation benchmarks

**Changelog v0.1 → v0.2 → v0.3**
- Added Section 6: State of the Art and Novelty Claims (explicit differentiation from RAG, agent-memory frameworks and classical cognitive architectures)
- Added Section 7: Evaluation Protocol — PRAETOR-Bench (falsifiable predictions, baselines, ablations, statistical protocol)
- Added Section 8: 90-Day Proof-of-Concept Plan (pre-submission de-risking)
- Added Section 13: Work Plan, Timeline and Resources
- Added Section 14: Applicant Capacity and Team Growth Plan
- Added References
- Tightened hypothesis into three falsifiable sub-hypotheses (H1–H3)

---

## Abstract

Current generative AI systems are powerful pattern-completion engines, but they remain structurally weak at persistent memory, causal reasoning, long-term planning, self-evaluation and transparent decision-making. They can generate convincing answers, but often lack a stable internal model of goals, context, prior decisions, uncertainty and consequences. This limits their use in high-value domains where AI must not only answer, but remember, reason, plan, explain and improve over time.

This paper proposes **PRAETOR**, a persistent cognitive memory architecture for AI agents. PRAETOR separates AI cognition into layered memory, reasoning, abstraction, planning and verification components. Instead of treating the large language model as the whole intelligence, PRAETOR treats it as one cognitive engine inside a larger orchestration system.

The architecture is inspired by human memory systems: working memory, episodic traces, semantic knowledge, procedural skill and reflective self-correction. It introduces a governed **memory lifecycle** (a 14-day volatile episodic buffer with an explicit promotion/decay/forgetting mechanism), a procedural skill layer, a symbolic reasoning layer with **epistemic typing** of all outputs, and a planning controller capable of decomposing goals, checking progress and revising strategies across days and weeks.

The central research hypothesis is that persistent, structured memory combined with neuro-symbolic reasoning and explicit temporal planning significantly improves the reliability, transparency and long-horizon task performance of AI agents under constrained computational resources. The project delivers (i) a formal cognitive architecture specification, (ii) a working local-first prototype, (iii) a new longitudinal evaluation suite (PRAETOR-Bench) for memory, planning persistence and reasoning trace quality, and (iv) a TRL4 demonstrator: a cognitive AI operations assistant that manages complex multi-week tasks with explainable memory, traceable decisions and measurable trustworthiness.

---

## 1. Problem Statement

Large language models have achieved remarkable performance in natural language generation, coding, summarisation and question answering. However, current AI systems still struggle with several core cognitive functions:

1. **They forget outside the context window.** Most systems do not possess stable, inspectable, long-term memory. They rely on prompt context, retrieval augmentation or hidden session state, but not on an explicit cognitive memory architecture with governed retention.
2. **They confuse fluency with reasoning.** A model may produce a plausible answer without a valid chain of evidence, causal structure or logical verification. Facts, inferences, assumptions and guesses are emitted in the same undifferentiated stream of text.
3. **They lack durable planning.** Current agents decompose tasks, but they do not reliably maintain goals, constraints, fallback strategies and long-term progress across days or weeks. Goal drift over long horizons is largely unmeasured.
4. **They are difficult to audit.** Users and regulators cannot inspect why a system remembered something, forgot something, changed strategy or selected a specific tool. This directly conflicts with the transparency requirements of the EU AI Act.
5. **They are computationally inefficient.** Many systems compensate for weak architecture with larger models, longer context windows and more API calls. This is expensive, fragile, and concentrates capability in a small number of frontier-model providers.

The DeepRAP Challenge explicitly identifies the gap between generative AI and human-like cognitive capabilities — reasoning, abstraction, contextualisation, causality, explainability and long-term planning — and calls for novel frameworks and architectures, including neuro-symbolic approaches, demonstrated at TRL4 on complex real-world tasks with new evaluation benchmarks.

The core problem is therefore:

> **How can we design an AI architecture that remembers, reasons, abstracts and plans over time in a transparent and trustworthy way, without depending solely on ever-larger foundation models?**

---

## 2. Core Research Hypothesis

The central hypothesis of PRAETOR is:

> **Persistent cognitive memory, when combined with neuro-symbolic reasoning and explicit temporal planning, significantly improves the reliability, explainability and long-term usefulness of AI agents under constrained computational resources.**

To make this scientifically testable, the hypothesis is decomposed into three falsifiable sub-hypotheses:

- **H1 (Memory).** A governed memory lifecycle (episodic buffer → rule-based promotion → typed long-term memory with evidence links and decay) yields higher memory precision and a lower false-memory rate on longitudinal tasks than (a) long-context prompting and (b) standard vector-RAG memory, at equal or lower compute.
- **H2 (Planning).** Explicit, persistent plan state with hierarchical goals, progress markers and re-planning triggers reduces goal drift and improves task completion on multi-week tasks compared to reactive agent loops without persistent plan state.
- **H3 (Trust).** Epistemic typing of outputs (fact / inference / assumption / hypothesis / decision / risk) combined with evidence-linked memory produces reasoning traces that human evaluators judge as significantly more auditable and that enable automated contradiction detection with measurably higher precision.

This implies a shift from **"LLM as brain"** to **"LLM as cognitive processor inside a structured reasoning–memory–planning system."** The LLM remains useful, but it is no longer responsible for everything. Memory, planning, verification and skill execution become separate, inspectable modules.

---

## 3. Scientific Objectives

### Objective 1 — Build a layered cognitive memory system

PRAETOR separates memory into five layers:

| Memory Layer | Function |
|---|---|
| Working Memory | Current task, active goals, open constraints |
| Volatile Episodic Buffer | Raw recent events, logs and interactions, retained for ±14 days |
| Long-Term Semantic Memory | Stable facts, preferences, concepts, project knowledge |
| Procedural Memory | Reusable workflows, skills, tool-use patterns |
| Reflective Memory | Mistakes, corrections, lessons, failed assumptions |

The key innovation is the **promotion mechanism**: not everything becomes long-term memory. Information is promoted only when it is repeated, confirmed, useful, strategically important, or explicitly marked by the user. Every promotion event is logged with its triggering rule, so retention itself becomes auditable.

This avoids the classic AI memory failure mode: either remembering nothing, or remembering garbage forever.

### Objective 2 — Add neuro-symbolic reasoning

PRAETOR combines neural language models with symbolic structures: entities, relationships, rules, constraints, goals, causal assumptions, task states, confidence scores and contradiction checks.

This maps directly onto the DeepRAP requirement for systems that move beyond statistical pattern matching toward causal inference, logical reasoning and context-aware decision-making. The system should answer not only *"What should I do?"* but also:

- *"Why this action?"*
- *"Which assumption is weak?"*
- *"What evidence supports this?"*
- *"What changed since last time?"*
- *"What are the risks?"*
- *"What would make this plan fail?"*

### Objective 3 — Develop long-term planning across temporal levels

PRAETOR uses hierarchical planning:

| Planning Level | Example |
|---|---|
| Immediate | Execute current tool call or code task |
| Session-level | Finish today's workflow |
| Project-level | Build a working AI dashboard |
| Strategic | Move toward a business or research goal |
| Reflective | Reassess whether the goal still makes sense |

The DeepRAP guide specifically asks for hierarchical planning, contingency planning and continual re-planning in dynamic environments. PRAETOR therefore includes goal decomposition, progress tracking, fallback strategy generation, blocked-task detection, re-planning when assumptions change, and memory-aware prioritisation.

### Objective 4 — Make the system trustworthy and inspectable

The trust layer logs: what the system remembered, why it remembered it, what it forgot, what source supported a conclusion, what uncertainty remains, what tool or model made the decision, and what assumptions were used.

This aligns with the DeepRAP requirement for explainability, transparency, fairness, risk evaluation, security and alignment with ethical and legal standards, including the EU AI Act. The aim is not artificial general intelligence. The aim is **auditable cognition**.

### Objective 5 — Deliver a longitudinal evaluation methodology

Existing benchmarks measure single-session performance. PRAETOR will contribute **PRAETOR-Bench** (Section 7): a reproducible evaluation suite for longitudinal memory quality, planning persistence and reasoning trace auditability, released openly so other DeepRAP portfolio projects can adopt it. This directly serves the Challenge's portfolio synergy goals (shared benchmarks, interoperability).

---

## 4. Proposed Architecture

### 4.1 System Overview

PRAETOR consists of seven core modules:

```
User / Environment
        ↓
Input Interpreter
        ↓
Working Memory Controller
        ↓
Reasoning Engine  ←→  Symbolic Knowledge Graph
        ↓
Planning Controller  ←→  Task State / Goals / Constraints
        ↓
Tool & Agent Orchestrator
        ↓
Verification & Reflection Layer
        ↓
Memory Promotion / Forgetting System
```

### 4.2 Module 1 — Input Interpreter

Converts raw user input, documents, tool output and environmental data into structured representations: intent, entities, time references, constraints, priority signals, task type, required tools and uncertainty markers.

### 4.3 Module 2 — Working Memory Controller

Maintains the active context of the current task. It prevents the system from losing track of: what the user asked, what is already known, what has already been tried, what failed, what remains open, and what the next action should be.

### 4.4 Module 3 — Episodic Buffer

A temporary event memory. Proposed default: **14-day volatile memory buffer**. Everything enters this buffer first; nothing becomes permanent automatically.

The buffer stores conversations, decisions, tool outputs, errors, code changes, project notes, repeated preferences and user corrections. After the retention period, memories are either **promoted, compressed, archived, or deleted** — each transition governed by explicit, logged rules.

### 4.5 Module 4 — Long-Term Semantic Memory

Stores stable knowledge: project architecture, user goals, reusable facts, technical stack, business constraints, preferred methods, lessons learned.

It is structured as:

```
Entity → Relationship → Evidence → Confidence → Last validated date
```

Example:

```
Project: PRAETOR
Relation: uses
Object: local-first memory architecture
Evidence: [episode #4211, #4507 — repeated design notes]
Confidence: high (0.92)
Last validated: 2026-06-14
```

Every long-term memory entry carries evidence pointers back into the episodic record. A memory without evidence is flagged, decayed, and eventually removed. This is the structural defence against false memories.

### 4.6 Module 5 — Procedural Memory

Procedural memory stores "how to do things": how to debug a local AI service, run a benchmark, create a research summary, split a task into scanner/planner/builder/tester/reviewer agents, update project documentation.

This is the AI equivalent of muscle memory. Instead of rediscovering workflows every time, the system consolidates validated action sequences into reusable, versioned procedures with success statistics.

### 4.7 Module 6 — Reasoning Engine

The reasoning engine combines LLM reasoning, symbolic rules, causal graphs, contradiction detection, confidence scoring, retrieval from memory and external tool verification.

The system enforces **epistemic typing** — every output is classified:

| Output Type | Meaning |
|---|---|
| Fact | Supported by source or memory with evidence link |
| Inference | Reasoned from available evidence |
| Assumption | Plausible but not verified |
| Hypothesis | Testable claim |
| Decision | Chosen action |
| Risk | Possible failure mode |

This matters because current AI systems blur all of these together in a single fluent stream, which is precisely why they cannot be audited.

### 4.8 Module 7 — Planning Controller

The planning controller creates and updates multi-step plans. Each plan is a persistent, versioned data structure containing:

```
Goal · Subgoals · Current state · Known constraints · Required tools
Dependencies · Risks · Fallbacks · Progress markers · Stop conditions
```

Plans survive restarts, model changes and multi-day gaps. Re-planning events are logged with their trigger (new evidence, failed assumption, blocked task, user override). This enables the system to act less like a chatbot and more like an operational assistant.

---

## 5. Research Methodology

**Phase 1 — Theoretical Model (M1–M8).** Develop a formal model of cognitive memory for AI agents: memory types, promotion rules, forgetting rules, trust metadata schema, planning state machine, epistemic categories. Output: formal PRAETOR cognitive architecture specification, published as an open technical report.

**Phase 2 — Prototype Implementation (M4–M20).** Build a local-first prototype using open-source LLMs, a vector database, a structured database, a knowledge graph, a task queue, an agent registry, a logging system, a model router and an inspection dashboard. The prototype must not depend on one specific model provider.

| Execution Mode | Function |
|---|---|
| Local | Ollama / local open-source models |
| Cloud | External high-performance models |
| Hybrid | Local memory + cloud reasoning |
| Offline | Reduced capability but no cloud dependency |

**Phase 3 — Benchmarking (M12–M30).** Benchmark PRAETOR against baseline agent systems using PRAETOR-Bench (Section 7) across eight test domains: multi-day software tasks, document reasoning, project planning, contradiction detection, memory retention, tool-use reliability, strategy revision, and explanation quality.

**Phase 4 — TRL4 Demonstrator (M24–M36).** A lab-validated cognitive AI system that can manage a real project over several weeks, remember decisions and constraints, explain its planning, detect contradictions, use tools, revise strategy, preserve user control, operate under constrained compute and export auditable logs.

Target use case: **Local-first AI Operations Assistant** for complex technical and entrepreneurial workflows — broad enough for research, concrete enough to demonstrate, and directly aligned with the DeepRAP application domains of human-AI collaboration and decision support.

---

## 6. State of the Art and Novelty Claims

Evaluators will immediately ask: *"Is this not just RAG plus agents plus a memory plugin?"* This section answers that question explicitly.

### 6.1 Comparison with existing approaches

| Approach | What it does | What it lacks (and PRAETOR adds) |
|---|---|---|
| **Vector-RAG memory** (standard retrieval-augmented generation) | Retrieves semantically similar chunks at query time | No memory lifecycle: nothing is promoted, validated, decayed or forgotten by rule. No evidence links, no confidence, no audit trail of retention decisions. |
| **Agent memory frameworks** (MemGPT/Letta, mem0, Zep) | Persist conversational facts across sessions, paging between context and storage | Storage-centric, not governance-centric: writes are heuristic and unlogged, memories carry no epistemic type or evidence pointer, and memory is not coupled to a persistent planner. |
| **Generative Agents** (Park et al., 2023) | Memory stream + reflection for believable simulated agents | Optimised for behavioural plausibility in simulation, not for task reliability, verification, contradiction detection or auditability on real work. |
| **Skill-learning agents** (Voyager, Wang et al., 2023) | Grow a library of reusable procedures | Domain-specific (embodied game environment); no general memory lifecycle, no trust metadata, no long-horizon plan persistence. |
| **Classical cognitive architectures** (SOAR, ACT-R) | Principled symbolic memory (declarative/procedural) and goal stacks | Weak natural-language grounding and limited integration with modern neural models; decades of theory but no LLM-era trustworthiness layer. |
| **Agent orchestration frameworks** (LangGraph, AutoGen, CrewAI) | Graph/loop control over LLM calls and tools | Orchestration without cognition: no governed memory model, plans live inside the loop state and evaporate, no epistemic separation of outputs. |

### 6.2 Explicit novelty claims

PRAETOR's contribution is not any single component — most components exist somewhere in isolation. The contribution is the **integration under explicit governance**, plus the evaluation methodology to prove it matters:

- **N1 — Memory as a governed lifecycle, not storage.** Retention itself becomes a rule-based, logged, auditable process (buffer → promotion → decay → forgetting), rather than an unbounded write-on-heuristic store.
- **N2 — Epistemic typing enforced at architecture level.** Every output is typed (fact / inference / assumption / hypothesis / decision / risk) and the type constrains what downstream modules may do with it. No existing agent framework enforces this separation structurally.
- **N3 — Evidence-linked long-term memory.** Every semantic memory entry carries pointers to the episodic evidence that produced it; unsupported entries decay. This is a structural defence against false memories rather than a prompt-level one.
- **N4 — Plan persistence as a first-class, measurable object.** Plans are versioned data structures that survive restarts and multi-day gaps, with logged re-planning triggers — making "does the agent keep its goal for 30 days?" an empirical question.
- **N5 — Longitudinal evaluation methodology.** Existing benchmarks (LoCoMo, LongMemEval, GAIA, PlanBench) measure single sessions or isolated capabilities. PRAETOR-Bench measures cognition **over time**: memory quality after weeks, goal drift across sessions, correction uptake latency, and audit trace quality.

Honest positioning: if H1–H3 turn out to be false — if governed memory and symbolic control do *not* beat well-tuned RAG baselines at equal compute — that is itself a publishable, valuable negative result for the field. That is what makes this Pathfinder-appropriate: high risk, high gain, falsifiable.

---

## 7. Evaluation Protocol — PRAETOR-Bench

### 7.1 Three benchmark suites

**Suite 1 — LTM-Bench (longitudinal memory quality).**
Multi-session task scenarios spanning a simulated 30–90 day period (compressed in wall-clock time via replayable event logs). Scenarios include planted facts, later corrections, contradictions, and distractor information.
Primary metrics: memory precision, memory recall, **false memory rate** (asserting remembered facts that were never established), correction uptake latency (sessions until a user correction is consistently applied).

**Suite 2 — PLAN-Persist (planning persistence and adaptation).**
Multi-week project tasks (e.g. build and document a small software system) with injected disruptions: changed requirements, failed dependencies, blocked subtasks, invalidated assumptions.
Primary metrics: goal drift (semantic distance between the active plan and the original committed goal), task completion rate, blocked-task detection time, re-planning quality (rated: did the revision address the actual disruption?).

**Suite 3 — TRACE-Audit (reasoning trace and trustworthiness).**
Given completed tasks, evaluate the audit record.
Primary metrics: contradiction detection precision/recall on planted contradictions; evidence coverage (fraction of asserted facts with valid evidence links); epistemic typing accuracy; human auditability score (blinded expert raters answer "can you reconstruct why the system did X?" on a Likert scale, inter-rater reliability reported).

### 7.2 Baselines and ablations

**Baselines** (all given the same tools, models and compute budget):
1. Long-context LLM (no external memory, full history in context where it fits);
2. Vector-RAG memory agent;
3. MemGPT/Letta-style paged memory agent;
4. LangGraph-style ReAct agent with scratchpad state.

**Ablations** (to attribute gains to specific mechanisms):
- A1: remove promotion rules (everything is stored) → tests N1;
- A2: remove evidence links and decay → tests N3;
- A3: remove epistemic typing → tests N2;
- A4: remove persistent plan state (re-plan from scratch each session) → tests N4.

### 7.3 Statistical protocol

- ≥ 20 scenarios per suite, ≥ 5 seeded runs per system per scenario;
- paired statistical tests with effect sizes and confidence intervals;
- pre-registered hypotheses and metrics before final benchmark runs;
- **compute accounting**: all comparisons reported at matched token/inference budgets, so improvements cannot be explained by "PRAETOR simply used more model calls" — this operationalises the DeepRAP constrained-compute requirement;
- scenario generators, logs and scoring code released openly for reproduction by other DeepRAP portfolio projects.

### 7.4 Falsifiable predictions

- **P1 (→ H1):** PRAETOR reduces false memory rate by ≥ 30% relative to the strongest memory baseline on LTM-Bench, at equal or lower inference budget.
- **P2 (→ H2):** PRAETOR maintains goal fidelity over a 30-session horizon with ≤ 10% goal drift, where baseline agents show measurable drift or goal loss; blocked tasks are detected ≥ 2× faster.
- **P3 (→ H3):** PRAETOR's audit traces achieve significantly higher human auditability scores (pre-registered threshold, blinded raters) and higher contradiction-detection F1 than all baselines.

If P1–P3 fail under this protocol, the hypothesis is rejected. This is the difference between a vision document and a research proposal.

---

## 8. 90-Day Proof-of-Concept Plan (pre-submission de-risking)

Before the full EIC submission (deadline 28 October 2026), a minimal prototype demonstrates that the core loop is buildable on consumer hardware. This strengthens the proposal ("we have preliminary results") and de-risks Phase 2.

**Month 1 — Minimal cognitive loop.**
Episodic buffer (SQLite + local vector store), promotion rules v0 (repetition, explicit user marking, confirmation), working memory controller, structured audit log.
*Demo 1:* the system correctly recalls a user correction made 14+ days earlier — outside any context window — and can show **why** it retained it (which rule fired, which episodes are the evidence).

**Month 2 — Plan persistence and epistemic typing.**
Persistent plan objects (goal, subgoals, constraints, progress, fallbacks), blocked-task detection, output typing (fact/inference/assumption/decision/risk) in all responses.
*Demo 2:* a multi-day coding project survives full system restarts and a mid-project requirement change; the re-planning event is logged with its trigger.

**Month 3 — Mini-benchmark.**
LTM-Bench v0 (15–20 scenarios) run against two baselines (long-context, vector-RAG) with 3 seeded runs each; exportable audit report.
*Demo 3:* a one-page results table with preliminary deltas on memory precision, false memory rate and correction uptake — the seed of Figure 1 in the full proposal.

**Infrastructure:** single consumer GPU workstation (RTX 4070-class), local open-source models 7–14B via Ollama, hybrid cloud routing optional. Total cost: negligible. This itself demonstrates the constrained-compute claim.

**Go/no-go criterion:** if Demo 1–3 cannot be achieved on this hardware in 90 days, the architecture is revised before submission rather than after funding.

---

## 9. Innovation Beyond Current Systems

Current RAG: *Question → Retrieve documents → Generate answer.*
PRAETOR: *Goal → Memory → Reasoning → Planning → Tool execution → Verification → Reflection → Memory update.*

The innovation is the integration of persistent memory, neuro-symbolic reasoning, hierarchical planning, procedural skill learning, explicit forgetting, trust metadata, local-first deployment and multi-agent orchestration — under the explicit governance and evaluation regime defined in Sections 6–7.

The scientific risk is high: it is not guaranteed that external memory and symbolic control improve reasoning quality. The potential gain is equally high: AI systems that become more useful over time without becoming opaque black boxes.

---

## 10. Expected Outcomes

1. **A formal cognitive memory architecture** — technical specification for layered AI memory, epistemic typing and planning (open technical report).
2. **A working prototype** — local-first system with memory, planning, reasoning and tool orchestration, model-provider-agnostic.
3. **Trustworthiness mechanisms** — explainable memory, decision logs, assumption tracking and uncertainty labels, aligned with EU AI Act transparency expectations.
4. **PRAETOR-Bench** — an open longitudinal evaluation suite for memory quality, planning persistence, reasoning reliability and correction uptake, offered to the DeepRAP portfolio as a shared benchmark.
5. **TRL4 demonstrator** — a lab-validated cognitive AI operations assistant performing complex multi-week real-world tasks.
6. **Open research outputs** — architecture documents, benchmark definitions, evaluation methods and at least two peer-reviewed publications.

---

## 11. Risks and Mitigation

| Risk | Problem | Mitigation |
|---|---|---|
| Memory pollution | System stores too much garbage | Promotion rules, decay, user confirmation |
| False memories | System misremembers facts | Evidence links, confidence scores, validation, decay of unsupported entries |
| Overengineering | Architecture becomes too complex | 90-day minimal cognitive loop first; add modules only when benchmarks justify them |
| Weak reasoning gains | Memory may not improve reasoning | Pre-registered benchmarks against strong baselines; negative result is publishable |
| Privacy risk | Personal memory can be sensitive | Local-first storage, user-controlled inspection/edit/deletion, sensitivity filters at write time |
| Compute cost | Multi-agent systems can be heavy | Local/cloud routing, matched-budget evaluation, compute-efficiency as a primary metric |
| Evaluation difficulty | Hard to prove "better cognition" | Narrow, falsifiable predictions (P1–P3) with statistical protocol |
| Single-applicant capacity | One person cannot execute a 36-month research project alone | Funded team of 3–4 FTE recruited in M1–M6; advisory board; optional academic partner (Section 14) |

---

## 12. Ethical and Legal Considerations

PRAETOR is designed around human control:

- memory must be inspectable, editable and deletable by the user;
- sensitive information must not be stored blindly (sensitivity classification at write time, GDPR data-minimisation by design);
- decisions must be explainable; uncertainty must be visible;
- logs must show source and reasoning category;
- the system must never pretend certainty where none exists.

This aligns with the DeepRAP focus on trustworthy, transparent, human-centred cognitive AI and with the transparency and human-oversight provisions of the EU AI Act. An ethics self-assessment and data-management plan are foreseen as month-3 deliverables of the funded project.

---

## 13. Fit With EIC Pathfinder DeepRAP

Call reference: HORIZON-EIC-2026-PATHFINDERCHALLENGES-01-03, deadline 28 October 2026, 17:00 Brussels time. Grants up to €4M, TRL 1–4, single legal entities eligible.

| DeepRAP Area | PRAETOR Fit |
|---|---|
| Deep Reasoning | Symbolic reasoning, causal assumptions, contradiction checks |
| Deep Abstraction | Semantic memory, concept formation, knowledge graph |
| Deep Planning | Hierarchical goals, long-term planning, fallback strategies |
| Trustworthiness | Auditable memory, explainability, uncertainty tracking |
| Constrained Compute | Local-first architecture, model routing, matched-budget evaluation |
| Multi-agent Integration | Agent registry, task queue, planner/builder/tester/reviewer roles |
| Benchmark Development | PRAETOR-Bench longitudinal evaluation suite, released to the portfolio |
| Human-AI Collaboration | User-controlled memory, operations-assistant use case |

**Strongest category mapping:**

| Category | Mapping |
|---|---|
| Cognitive Capability | Multi-capability / Deep Planning / Deep Reasoning |
| Technological Approach | Cognitive Architecture + Neuro-Symbolic AI + Trustworthiness Mechanisms |
| Application Domain | Human-AI Collaboration / Decision Support / Industrial Productivity |
| Synergy | Benchmark Development + Interoperability + Multi-Agent Integration |

---

## 14. Work Plan, Timeline and Resources (36 months)

| WP | Title | Months | Key deliverables |
|---|---|---|---|
| WP1 | Formal cognitive architecture | M1–M8 | D1.1 Architecture specification; D1.2 Memory lifecycle & trust metadata schema |
| WP2 | Memory subsystem | M4–M16 | D2.1 Episodic buffer + promotion engine; D2.2 Evidence-linked semantic memory; D2.3 Procedural memory |
| WP3 | Reasoning & planning | M8–M24 | D3.1 Epistemic typing engine; D3.2 Symbolic layer + contradiction detection; D3.3 Persistent planning controller |
| WP4 | PRAETOR-Bench | M6–M30 | D4.1 Benchmark suites + scenario generators; D4.2 Baseline implementations; D4.3 Pre-registered evaluation report |
| WP5 | TRL4 demonstrator | M24–M36 | D5.1 Integrated operations assistant; D5.2 Multi-week validated case studies; D5.3 Audit-export tooling |
| WP6 | Dissemination, ethics, management | M1–M36 | D6.1 Ethics & data-management plan; D6.2 ≥2 publications; D6.3 Open-source releases; D6.4 Portfolio synergy activities |

**Milestones:** MS1 (M8) architecture spec frozen · MS2 (M16) memory subsystem passes LTM-Bench v1 internally · MS3 (M24) full cognitive loop operational · MS4 (M30) pre-registered benchmark campaign complete · MS5 (M36) TRL4 demonstration and final report.

**Indicative budget (~€1.8–2.5M):** personnel 4–4.5 FTE (PI, 2 research engineers, 1 evaluation researcher, part-time ethics/legal advisor), compute infrastructure (local GPU cluster + limited cloud budget for baseline comparisons), human evaluation study (blinded raters for TRACE-Audit), open-source engineering, dissemination and travel.

---

## 15. Applicant Capacity and Team Growth

The EIC Pathfinder Challenges explicitly allow single legal entities established in a Member State. The applicant entity is Victus AI (Belgium), an AI systems and automation company, with the PI bringing hands-on experience in local-first AI systems, agent orchestration, memory architectures and neuromorphic experimentation.

The project is nevertheless designed for team execution, not solo heroics: WP staffing (Section 14) foresees recruitment of two research engineers and one evaluation researcher within the first six months, plus an advisory board covering cognitive science, symbolic AI and AI governance. A collaboration with one Belgian or European academic group (cognitive architectures / neuro-symbolic AI) is actively being explored prior to submission; solo submission remains the legal fallback, but a scientific partner materially strengthens both execution and evaluation credibility.

---

## 16. Strongest Scientific Claim

> **Future AI progress will not come only from larger models, but from better cognitive architecture around models: persistent memory, planning, symbolic reasoning, tool control and transparent self-correction.**

In other words: intelligence is not just prediction. **Intelligence is organised memory under goals.**

---

## 17. Conclusion

PRAETOR proposes a new cognitive architecture for AI agents that combines persistent governed memory, neuro-symbolic reasoning, hierarchical planning and trustworthiness mechanisms, evaluated through a new longitudinal benchmark methodology. It directly addresses known weaknesses of current generative AI: forgetting, shallow reasoning, weak planning, poor auditability and high compute dependency.

The project is high-risk because it builds a system-level architecture rather than optimising one model — and because its central hypothesis is genuinely falsifiable. It is high-gain because success would produce AI agents that are more reliable, explainable and useful across long-running real-world tasks, on European terms: transparent, human-controlled, and not dependent on ever-larger proprietary models.

---

## References

[1] European Innovation Council. *EIC Pathfinder Challenges 2026.* https://eic.ec.europa.eu/eic-funding-opportunities/eic-pathfinder/eic-pathfinder-challenges-2026_en

[2] European Innovation Council. *Challenge Guide — DeepRAP: Deep Reasoning, Abstraction & Planning towards trustworthy Cognitive AI Systems.* https://eic.ec.europa.eu/document/download/b4eeebbf-7801-44c6-87d3-2a97d80cc3d4_en

[3] European Innovation Council. *EIC Work Programme 2026.* https://eic.ec.europa.eu/eic-funding-opportunities/eic-2026-work-programme_en

[4] Packer, C., et al. (2023). *MemGPT: Towards LLMs as Operating Systems.* arXiv:2310.08560.

[5] Park, J.S., et al. (2023). *Generative Agents: Interactive Simulacra of Human Behavior.* UIST 2023.

[6] Wang, G., et al. (2023). *Voyager: An Open-Ended Embodied Agent with Large Language Models.* arXiv:2305.16291.

[7] Laird, J.E. (2012). *The Soar Cognitive Architecture.* MIT Press.

[8] Anderson, J.R., et al. (2004). *An Integrated Theory of the Mind (ACT-R).* Psychological Review, 111(4).

[9] Maharana, A., et al. (2024). *Evaluating Very Long-Term Conversational Memory of LLM Agents (LoCoMo).* ACL 2024.

[10] Wu, D., et al. (2024). *LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory.* arXiv:2410.10813.

[11] Mialon, G., et al. (2023). *GAIA: A Benchmark for General AI Assistants.* arXiv:2311.12983.

[12] Valmeekam, K., Kambhampati, S., et al. (2023). *PlanBench: An Extensible Benchmark for Evaluating LLMs on Planning and Reasoning about Change.* NeurIPS 2023.

[13] Kambhampati, S. (2024). *Can Large Language Models Reason and Plan?* Annals of the New York Academy of Sciences.

[14] European Union. *Regulation (EU) 2024/1689 — Artificial Intelligence Act.*
