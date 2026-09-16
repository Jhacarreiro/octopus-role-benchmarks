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
2. Quality measures its Intelligence floor against the best current-generation eligible model. Balanced and Budget first apply their shared effective-cost outlier filter, recompute the best eligible **AA Intelligence Index** among survivors, and measure their requested floors against that filtered baseline.
3. If a candidate pool cannot support a feasible portfolio, lower the Intelligence floor by **0.005** until the structural constraints can be satisfied.
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

Balanced and Budget share the same effective-cost outlier filter. Its reference population is the complete latest-generation scored universe, before mode-specific Intelligence eligibility:

```text
cutoff = mean(Plan-adjusted Cost per Task)
       + 2 × population standard deviation(Plan-adjusted Cost per Task)
```

Models strictly above that cutoff are excluded. The best eligible Intelligence Index is then recomputed from the surviving universe, and the 0.85 floor is applied to that filtered baseline. If the resulting pool is not feasible, the floor descends by 0.005 without recalculating the cutoff.

Within that pool, Balanced maximizes the sum of:

```text
Role Quality − 3.5 × Plan-adjusted Cost per Task
```

The generated lineup records the reference population size, mean, population sigma, cutoff, excluded models, pre-filter best Intelligence and post-filter best Intelligence.

## Budget

Requested Intelligence floor: **0.80**.

Budget applies the same cost cutoff and post-filter Intelligence-baseline recomputation as Balanced, then applies the 0.80 floor. If necessary, the floor descends by 0.005 without recalculating the cutoff.

Within the resulting pool, Budget minimizes total **plan-adjusted Cost per Task** across the eight-seat portfolio. Ties prefer higher total Role Quality, then lower raw CommandCode credit burn.

Monthly standard/premium plan utilization and estimated complete-portfolio capacity are still reported as diagnostics, but they are not the Budget optimization objective.

## Security Reviewer

Security Reviewer does not use an Octopus proxy. Its Role Quality is the external **Vals AI CyberBench Overall** score directly.

Production ingestion uses an explicit AA-slug → Vals-label mapping. There is no fuzzy matching, no cross-benchmark arithmetic and no GPQA/SciCode/HLE/Omniscience/LCR security composite.

If a model has no direct CyberBench result, it is simply not a Security Reviewer candidate. This does not make the model source-incomplete for other roles.

## Portfolio regeneration and review

`scripts/evaluate-lineup-swaps.mjs` regenerates the full portfolio after refreshes and compares it with the currently published lineup. `data/lineup-opportunities.json` is therefore portfolio-level review data, not a list of independent single-seat substitutions.

The evaluator never writes new hand-picked selections back into `config/lineup-policy.json`; the policy contains rules only.
