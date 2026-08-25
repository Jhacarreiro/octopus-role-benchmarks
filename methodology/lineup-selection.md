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
3. Model families are unique by default.
4. GPT-5.6 is the only current family exception, with a maximum of two seats, specifically to allow Luna and Sol to represent different operating tiers.
5. A selected scored model must still have the required role score in the current snapshot.
6. An unresolved model can appear only through a role-specific external-evidence override. If the override requires a free model, the current CommandCode row must still be marked `free: true`.

## Quality lineup

Quality ignores price. The current curated portfolio is family-diverse and uses role quality as its primary signal. It remains a portfolio rather than a simple per-role top-1 list so one family cannot dominate multiple seats.

## Balanced lineup

Balanced uses the benchmark-vs-cost signal as the primary numerical input, but the final lineup also applies role-fit and portfolio constraints. A pure rank optimizer is intentionally not authoritative because it can place expensive high-capability models in semantically weak roles merely to minimize aggregate rank penalties.

Current Balanced portfolio:

| Role | Model | Rationale |
| --- | --- | --- |
| Architect | Claude Opus 5 | Highest-value use of the mandatory Claude anchor is deep architecture/complex decisions. |
| Strategist | DeepSeek V4 Flash (latest) | Strong low-cost Balanced seat after the portfolio constraints are satisfied. |
| Security Reviewer | MiMo V2.5 | Very strong role quality per task cost. |
| Code Reviewer | Laguna S 2.1 | Free external-evidence coding override; excluded from scored tables while unresolved. |
| Implementer | GPT-5.6 Luna | High-volume normal implementation tier with strong coding quality at very low task cost. |
| Implementer Heavy | GPT-5.6 Sol | Higher-capability escalation tier; deliberately not used for routine implementation. |
| Synthesizer | Muse Spark 1.2 Contributor | Strong low-cost portfolio fit once higher-priority seats are assigned. |
| Researcher | Tencent Hy3 | Strong Researcher score, especially long-context reasoning, at low task cost. |

### Mandatory portfolio models

Balanced currently requires Claude Opus 5, GPT-5.6 Luna and GPT-5.6 Sol somewhere in the eight-seat portfolio. This requirement does **not** permanently bind those models to Architect, Implementer and Implementer Heavy. Future re-optimization may move them if the role evidence changes, subject to the constraints below.

### Sol constraint and implementation escalation

`GPT-5.6 Sol -> implementer` is explicitly forbidden in policy. The reason is economic rather than aesthetic: normal implementation is expected to be a high-volume seat, and Sol's normalized task cost is far above Luna's for a much smaller difference in measured role quality.

The operating interpretation is:

```text
normal implementation -> Luna
review / correction    -> cheap reviewer + Luna correction
repeated failure or genuinely heavy implementation -> Sol escalation
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
