# Methodology

## What is being optimized

The project does not optimize for a universal “best model”. For each Octopus role it reports:

1. the role-relevant benchmark score;
2. effective CommandCode Max price;
3. benchmark-per-dollar ratios under clearly stated token mixes.

## Coverage rule

A benchmark component is eligible for a role score only when it has **100% coverage of the scored underlying model-family universe** for that snapshot.

There are no exceptions:

- no imputation;
- no zero-filling;
- no proxy scores;
- no renormalization of weights around missing components.

If coverage falls below 100%, the component must be removed or replaced before a role score is published.

## Stealth models

Stealth, anonymous or unresolved models may be listed with their current CommandCode price, but are marked `UNSCORED`. They are not treated as missing benchmark rows inside the scored universe.

## Cost

The cost side uses **effective current CommandCode Max pricing**, including active promotions. Original/list prices may be displayed for transparency but do not drive the value ratio while a promotion is active.

Commercial variants remain distinct. If two CommandCode rows map to the same underlying model but one is cheaper or has a data-sharing condition, they share quality benchmarks but retain separate price and policy metadata.

## Benchmark selection

Role methodology is versioned in Git. Candidate dimensions include agentic coding, professional reasoning, long-context reasoning, factuality/calibration and hard reasoning. Exact benchmark components and weights are only activated after coverage validation.

## Reproducibility

Every methodology change must be committed. Every daily output identifies the methodology/schema version used. Historical snapshots are not recomputed silently.
