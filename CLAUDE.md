## Workflow & Agent Routing

Four-step pipeline for all non-trivial tasks:

1. **Plan** — Orchestrator (you) writes plan to `feature-research/<task>/plan.md`
2. **Plan review** — `/agents/reviewer` critiques before any code is written. Human approves.
3. **Implement** — `/agents/implementer` executes the approved plan only
4. **Diff review** — `/agents/reviewer` verifies implementation matches plan. Human approves.

Routing rules:
- Orchestrator handles: decomposition, plan writing, inter-step summaries
- reviewer handles: steps 2 and 4 only — never writes files
- implementer handles: step 3 only — never plans or reviews

After reviewer approves the plan, write a `feature-research/<task>/session.md` summarising:
- Goal, constraints, files in scope, key decisions made
This becomes the implementer's full context brief — it sees nothing else from your session.

Parallelism: tasks on separate files may run concurrently. Tasks with shared state are always sequential.
