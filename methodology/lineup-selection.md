# Lineup selection

## Purpose

Octopus recommends three eight-seat portfolios — **Quality**, **Balanced** and **Budget** — from the current benchmark snapshot. The lineups are generated deterministically; there are no mandatory models or hand-picked seat assignments.

## Sources of truth

- benchmark snapshot: `data/latest.json`
- role definitions: `config/roles.json`
- lineup rules: `config/lineup-policy.json`
- optimizer: `scripts/build-lineups.mjs`
- generated public output: `site/data/lineups.json`

## Shared constraints

1. Only current-generation eligible models are considered.
2. Eligibility begins with a mode-specific fraction of the best eligible **AA Intelligence Index**.
3. Before optimization, if the candidate pool has fewer than **5 families**, lower the Intelligence floor by **0.005** until it has at least 5.
4. Final portfolio: **4–8 families**.
5. Maximum **2 seats per family**.
6. No mandatory models.
7. No per-role quality floor.
8. Code Reviewer must have a different AA benchmark identity from both Implementer and Implementer Heavy.
9. Implementer Heavy must have a different AA identity from Implementer.
10. Implementer Heavy must have AA Intelligence Index at least **Implementer + 2.0**.
11. A model may occupy multiple seats where allowed by the family cap.
12. A missing role-specific benchmark makes the model ineligible only for that role.

## Quality

Requested Intelligence floor: **0.90**.

After the adaptive five-family pre-check, Quality maximizes the sum of `rankingQuality` across the eight roles. **Price has no effect**, including tie-breaking.

## Balanced

Requested Intelligence floor: **0.85**.

Balanced uses price only to remove extreme cost outliers from the Intelligence-qualified pool:

```text
cutoff = mean(CommandCode Cost per Task)
       + 2 × population standard deviation(CommandCode Cost per Task)
```

Models strictly above that cutoff are excluded. The optimizer then maximizes total Role Quality exactly like Quality. Price does not contribute to the score after the outlier filter.

The generated lineup records the mean, population sigma, cutoff, and every excluded model/cost.

If this filter makes the structural constraints infeasible, generation fails closed; the optimizer does not silently change the sigma multiplier or diversity rules.

## Budget

Requested Intelligence floor: **0.80**.

After the adaptive five-family pre-check, Budget minimizes the total CommandCode Cost per Task for all eight seats, subject to the same family, coding-independence and role-eligibility constraints.

Budget does **not** apply the Balanced outlier filter because cost is already the direct objective.

## Security Reviewer

Security Reviewer does not use an Octopus proxy. Its Role Quality is the external **Vals AI CyberBench Overall** score directly.

Production ingestion uses an explicit AA-slug → Vals-label mapping. There is no fuzzy matching, no cross-benchmark arithmetic and no GPQA/SciCode/HLE/Omniscience/LCR security composite.

If a model has no direct CyberBench result, it is simply not a Security Reviewer candidate. This does not make the model source-incomplete for other roles.

## Portfolio regeneration and review

`scripts/evaluate-lineup-swaps.mjs` regenerates the full portfolio after refreshes and compares it with the currently published lineup. `data/lineup-opportunities.json` is therefore portfolio-level review data, not a list of independent single-seat substitutions.

The evaluator never writes new hand-picked selections back into `config/lineup-policy.json`; the policy contains rules only.
