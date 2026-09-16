# Octopus Role Benchmarks

Transparent role rankings for Claude Octopus roles using the current CommandCode Max catalogue, plus deterministic Quality/Balanced/Budget portfolio recommendations.

The detailed table exposes **Quality** and cost-adjusted **Balanced** ranking views. Separately, the recommendation cards are generated as constrained **Quality**, **Balanced** and **Budget** portfolios under config/lineup-policy.json.

## Public site

The static UI is deployed directly from this repository by `.github/workflows/pages.yml`. It does not depend on private operator repositories.

Current native GitHub Pages URL:

```text
https://benchmark.gallivanter.biz/
```

Target branded URL after DNS cutover:

```text
https://getrad.ar/whipit/benchmark/ (compatibility redirect)
```

`getrad.ar` is only the shared domain namespace; benchmark source, deployment and history remain owned by this repository.

## Ranking formula

For non-coding roles:

```text
Balanced Score = Universal Role Score − 3.5 × Plan-adjusted Cost per Task
```

For `implementer`, `implementer-heavy` and `code-reviewer`:

```text
Balanced Score = (2/3 Universal Role Score + 1/3 CAI*) − 3.5 × Plan-adjusted Cost per Task
```

`CAI*` uses the current Artificial Analysis Coding Agent Index when observed. If the current CAI version has not yet re-evaluated a family, the last observed prior-version CAI is mapped onto the current scale with a validated overlap-derived degradation factor. Only families with neither observation use the reverse-validated 50/50 Ridge + inverse-distance 5NN estimator.

## Why plan-adjusted Cost per Task

Nominal price per million tokens can make verbose models look artificially cheap. Artificial Analysis publishes the measured token mix consumed per Intelligence Index task. The pipeline reprices that measured non-cached input, cache-read, cache-write and output usage with current effective CommandCode Max prices, including promotions.

The raw credit burn uses CommandCode effective prices after any published discount. The plan-adjusted denominator then converts that credit burn into subscription economics: standard Max credits use the 100/150 ratio, premium credits use 100/100, and free models remain zero. Max 20× has the same ratios, so ordering is unchanged. Discounts are not applied twice.

Plan-adjusted Cost per Task has **100% coverage** of the scored model-family universe and is used as the economic penalty in Balanced scoring.

## CAI coverage and estimation

The current pipeline preserves CAI provenance in the raw data, but combines three supported sources into one `CAI*` for ranking:

- current-version observed CAI where Artificial Analysis has a mapped Coding Agent result;
- prior-version observed CAI calibrated onto the current version using validated overlapping families;
- Ridge + 5NN estimated CAI only where neither observation exists;
- commercial CommandCode variants never count as extra training examples.

The estimator is rerun and reverse-validated every day. The daily job fails closed if the estimator or final-ranking guardrails are breached.

See:

- [`methodology/methodology.md`](methodology/methodology.md) — full methodology;
- [`methodology/cai-estimation-validation.md`](methodology/cai-estimation-validation.md) — current reverse validation;
- [`config/roles.json`](config/roles.json) — machine-readable role weights and ranking parameters;
- [`data/latest.json`](data/latest.json) — current scored snapshot;
- [`data/cai-validation.json`](data/cai-validation.json) — current validation metrics.

## Sources

- **CommandCode Max** — current model catalogue, effective pricing, discounts and standard/premium/free monthly credit allowances;
- **Artificial Analysis** — model benchmarks and per-task efficiency telemetry;
- **Artificial Analysis Coding Agent Index** — observed agentic coding outcomes;
- **OpenCLI 1.8.6** — read-only structured extraction layer.

## Pipeline

```text
GitHub Actions weekly
  -> OpenCLI CommandCode Max
  -> OpenCLI Artificial Analysis models
  -> OpenCLI Coding Agent Index
  -> AA Intelligence Index refresh
  -> Vals AI CyberBench refresh
  -> verified model-family mapping
  -> universal benchmark coverage gate
  -> CommandCode plan-adjusted Cost-per-Task coverage gate
  -> fit/validate CAI* and SciCode estimators
  -> role-quality scores
  -> deterministic Quality / Balanced / Budget portfolio optimizer
  -> generate site/data/lineups.json
  -> dated JSON snapshot + public site data
```

`Security Reviewer` is the exception to the universal weighted role-score formula: it uses the external **Vals AI CyberBench Overall** score directly. If a model has no direct CyberBench result, that model is simply ineligible for the Security Reviewer seat; other roles remain usable.

## Recommended lineup policy

The eight recommendation cards are selected as one constrained portfolio rather than eight independent winners. The machine-readable policy is [`config/lineup-policy.json`](config/lineup-policy.json); [`scripts/build-lineups.mjs`](scripts/build-lineups.mjs) deterministically optimizes the portfolio from the current snapshot.

Shared rules:

- `latestGenerationOnly = true`;
- requested Intelligence floors are **Quality 0.90**, **Balanced 0.85**, **Budget 0.80** of the best eligible AA Intelligence Index;
- before optimization, the floor is lowered in **0.005** steps only if needed until the eligible pool contains at least **5 model families**;
- the final lineup must contain at least **4 families** and at most 8;
- each family may occupy at most **2 seats**;
- there are **no mandatory models** and no manual Fable blacklist;
- there is **no per-role quality floor**;
- Code Reviewer must use a different AA benchmark identity from both Implementer and Implementer Heavy;
- Implementer Heavy must differ from Implementer and must have AA Intelligence Index at least **2.0 points higher**.

Mode objectives:

- **Quality**: maximize total Role Quality. Price does not affect ranking or tie-breaking.
- **Balanced**: compute a plan-adjusted Cost per Task cutoff from the full latest-generation scored universe (`mean + 2` population standard deviations), remove those cost outliers, recompute the best eligible Intelligence Index, then apply the 0.85 floor and maximize total `Role Quality − 3.5 × plan-adjusted Cost per Task` across the portfolio.
- **Budget**: apply the same cost-outlier cutoff and recomputed Intelligence baseline, then apply the 0.80 floor and minimize total plan-adjusted task cost while preserving the diversity and coding constraints.

Balanced and Budget publish the cost reference population, mean, sigma, cutoff, excluded models, pre-filter best Intelligence and post-filter best Intelligence in `site/data/lineups.json`. Quality does not use the cost filter.

The rationale and operating rules are documented in [`methodology/lineup-selection.md`](methodology/lineup-selection.md).

After each refresh, `scripts/evaluate-lineup-swaps.mjs` regenerates the entire portfolio under the current rules and records portfolio-level opportunities in `data/lineup-opportunities.json`. It no longer proposes single-seat swaps against static hand-picked selections.

## Run locally

```bash
npm ci
npm run update
npm run check:snapshot
# optional strict portfolio audit:
npm run update-lineups
```

No login cookies, API keys or browser profile are required for the current public extraction path.

## License

MIT.

### Weekly refresh

The benchmark refresh runs once per week via `.github/workflows/weekly.yml` (Monday 06:17 UTC). The workflow publishes a valid benchmark snapshot even if the separately curated lineup needs review; lineup audit status is recorded and surfaced rather than used as a benchmark publication gate. Any downstream review or notification automation is deployment-specific and intentionally outside this public repository.

Mapped AA families with a missing active benchmark are retained for audit as `source_incomplete` but excluded from the scored universe until complete source coverage returns. The 100% coverage rule applies to the scored universe. No benchmark value is imputed or carried forward except the explicitly documented, validated SciCode fallback below.

When AA temporarily omits SciCode for a mapped model, Octopus first uses the last observed SciCode only when it is at most 14 days old and when an overlap calibration against current observed families passes the published MAE/max-error guardrails. The overlap-derived factor is capped at 1, so historical fallback never inflates a prior observation. If no eligible calibrated LKG exists, the Ridge estimator may be used only when its original leave-one-out guardrails pass; otherwise the model becomes `source_incomplete`. Intelligence Index remains excluded from the Ridge features to avoid circularity. All fallback provenance, age, calibration factor and validation diagnostics are published in the snapshot.
