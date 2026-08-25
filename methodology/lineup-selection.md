# Recommended Lineup Selection

## Purpose

The role tables answer two numerical questions: **Quality** and **Balanced**. The eight cards at the top answer a different operational question: **which portfolio of models should be assigned across the eight Octopus roles?**

The lineup is therefore not produced by taking the #1 row for every role independently. It is a constrained portfolio assignment with explicit policy.

## Sources of truth

- `config/lineup-policy.json` — machine-readable selections and constraints.
- `data/latest.json` — current benchmark, cost and mapping snapshot.
- `scripts/build-lineups.mjs` — fail-closed policy validator and generator.
- `site/data/lineups.json` — generated public artifact consumed by the site.

The daily update regenerates `site/data/lineups.json` after refreshing benchmark data and CAI validation. `npm test` fails when the generated lineup data is stale or a policy constraint is broken.

## Common constraints

1. Every canonical Octopus role has exactly one model.
2. The same exact model cannot occupy two seats.
3. Every lineup must span **at least 5 and at most 8 distinct model families**.
4. Seven or eight families are considered at least as good as six; there is no optimization penalty for exceeding six.
5. A single model family may occupy at most **2 seats**.
6. A selected scored model must still have the required role score in the current snapshot.
7. An unresolved model can appear only through a role-specific external-evidence override. If the override requires a free model, the current CommandCode row must still be marked `free: true`.
8. Claude Sonnet 5 is eligible but not mandatory; inclusion must be justified by role fit and economics rather than vendor representation.

## Quality lineup

Quality ignores price. The current curated portfolio is family-diverse and uses role quality as its primary signal. It remains a portfolio rather than a simple per-role top-1 list so one family cannot dominate multiple seats.

## Balanced lineup

Balanced uses the benchmark-vs-cost signal as the primary numerical input, but the final lineup also applies role-fit and portfolio constraints. A pure rank optimizer is intentionally not authoritative because it can place expensive high-capability models in semantically weak roles merely to minimize aggregate rank penalties.

Current Balanced portfolio:

| Role | Model | Rationale |
| --- | --- | --- |
| Architect | Claude Opus 5 | Premium architecture/deep-decision seat and mandatory Claude anchor. |
| Strategist | Qwen 3.8 27B | Strong strategic role quality at materially lower task cost than premium alternatives. |
| Security Reviewer | MiMo V2.5 | Very strong role quality per task cost. |
| Code Reviewer | GPT-5.6 Luna | Strong coding/review tier at modest cost; keeps Luna in the portfolio without spending it on the highest-volume implementation seat. |
| Implementer | Muse Spark 1.2 Contributor | Higher measured Implementer quality than Luna at substantially lower task cost; preferred for the highest-volume seat. |
| Implementer Heavy | GPT-5.6 Sol | Higher-capability escalation tier; deliberately not used for routine implementation. |
| Synthesizer | Inkling Small | Low-cost portfolio fit with acceptable synthesis quality. |
| Researcher | Tencent Hy3 | Strong Researcher score, especially long-context reasoning, at low task cost. |

### Mandatory portfolio models

Balanced currently requires Claude Opus 5, GPT-5.6 Luna and GPT-5.6 Sol somewhere in the eight-seat portfolio. This requirement does **not** permanently bind those models to Architect, Code Reviewer and Implementer Heavy. Future re-optimization may move them if the role evidence changes, subject to the constraints below.

### Sol constraint and implementation escalation

`GPT-5.6 Sol -> implementer` is explicitly forbidden in policy. The reason is economic rather than aesthetic: normal implementation is expected to be the highest-volume seat. In the current snapshot Muse Spark 1.2 Contributor has higher measured Implementer quality than Luna while costing substantially less per normalized task, so Muse is preferred for routine throughput and Sol remains the heavy/escalation tier.

The operating interpretation is:

```text
normal implementation -> Muse Spark 1.2 Contributor
code review            -> GPT-5.6 Luna
review / correction    -> cheap correction loop on the normal tier
repeated failure or genuinely heavy implementation -> GPT-5.6 Sol escalation
```

This aims at **cost per completed task**, not cost per first attempt. The benchmark does not currently observe real Octopus retry rates, so no retry probability is inserted into the numerical score. The escalation rule is therefore policy, clearly separated from measured benchmark methodology.

## Budget lineup

For every **scored** Budget pick:

```text
Role Quality >= 80% of the best scored Role Quality for that role
```

Within that strong-quality universe, the portfolio favors low task cost and family diversity. Free unresolved models can bypass the numerical floor only through a documented external-evidence override because they have no comparable Role Quality.

Current Budget portfolio:

| Role | Model | Note |
| --- | --- | --- |
| Architect | Tencent Hy3 | Scored pick above the 80% quality floor. |
| Strategist | Qwen 3.8 27B | Scored pick above the 80% quality floor. |
| Security Reviewer | Inkling Small | Scored pick above the 80% quality floor. |
| Code Reviewer | Laguna S 2.1 | FREE external-evidence override. |
| Implementer | GPT-5.6 Luna | Scored, low-cost normal implementation tier. |
| Implementer Heavy | Muse Spark 1.2 Contributor | Scored low-cost heavy seat above the quality floor. |
| Synthesizer | MiMo V2.5 | Scored pick above the 80% quality floor. |
| Researcher | Ox Alpha | FREE / EXPERIMENTAL external-evidence override; remains unscored. |

## External-evidence overrides

Overrides never create synthetic Role Quality or Balanced scores. They only affect the curated cards. The full tables remain fail-closed and contain scored rows only.

Laguna S 2.1 is accepted narrowly for coding roles because public Poolside evidence includes Terminal-Bench 2.1, SWE-bench Multilingual, SWE-bench Pro and DeepSWE results. Ox Alpha remains stealth/unresolved and is therefore allowed only as an experimental Budget pick.

## Automation boundary

The automation is intentionally conservative. It **validates and publishes** the approved portfolio; it does not silently replace a model when rankings change. A failing constraint stops the update and forces review. This prevents a daily data refresh from turning an editorial/operational portfolio decision into an unreviewed routing change.
