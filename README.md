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
Ranking Value = Universal Role Score / CommandCode Cost per Task
```

For `implementer`, `implementer-heavy` and `code-reviewer`:

```text
Ranking Value = (2/3 Universal Role Score + 1/3 CAI*) / CommandCode Cost per Task
```

`CAI*` uses the observed Artificial Analysis Coding Agent Index when available. Missing CAI values are estimated with a reverse-validated 50/50 ensemble of ridge regression and inverse-distance 5-nearest-neighbours.

## Why Cost per Task

Nominal price per million tokens can make verbose models look artificially cheap. Artificial Analysis publishes the measured token mix consumed per Intelligence Index task. The pipeline reprices that measured non-cached input, cache-read, cache-write and output usage with current effective CommandCode Max prices, including promotions.

The Cost-per-Task denominator has **100% coverage** of the scored model-family universe.

## CAI coverage and estimation

The current pipeline keeps observed and estimated CAI separate in the raw data, but combines them into one `CAI*` for ranking:

- observed CAI where Artificial Analysis has a mapped Coding Agent result;
- estimated CAI everywhere else;
- commercial CommandCode variants never count as extra training examples.

The estimator is rerun and reverse-validated every day. The daily job fails closed if the estimator or final-ranking guardrails are breached.

See:

- [`methodology/methodology.md`](methodology/methodology.md) — full methodology;
- [`methodology/cai-estimation-validation.md`](methodology/cai-estimation-validation.md) — current reverse validation;
- [`config/roles.json`](config/roles.json) — machine-readable role weights and ranking parameters;
- [`data/latest.json`](data/latest.json) — current scored snapshot;
- [`data/cai-validation.json`](data/cai-validation.json) — current validation metrics.

## Sources

- **CommandCode Max** — current model catalogue and effective pricing;
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
  -> CommandCode Cost-per-Task coverage gate
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
- **Balanced**: start from the Intelligence-qualified pool, remove only models whose CommandCode Cost per Task is above **mean + 2 population standard deviations**, then maximize total Role Quality. Price does not affect ranking after that filter.
- **Budget**: minimize total CommandCode Cost per Task subject to the shared structural and role-eligibility constraints.

Balanced records its pool mean, sigma, cutoff and excluded outliers in `site/data/lineups.json`. The current v6 snapshot excludes only Claude Fable 5.1 as a Balanced price outlier.

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

When AA temporarily omits SciCode for a mapped model, Octopus may estimate SciCode from the model's other independent AA benchmarks (GPQA, HLE, LCR, GDPval and normalized AA-Omniscience) using a leave-one-out validated Ridge model. Intelligence Index is deliberately excluded to avoid circularity. The estimate is conservatively bounded by a recent last-known target score and any explicitly configured same-series/sibling analogue; provenance and validation error are published in the snapshot. If the estimator guardrails fail or required features are missing, the model becomes `source_incomplete` instead of receiving a score.
