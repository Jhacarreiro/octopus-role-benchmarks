# Octopus Role Benchmarks

Compare current CommandCode Max offers across eight Octopus roles, with Quality, Balanced and Budget rankings and constrained eight-seat portfolio recommendations.

Public site: [benchmark.gallivanter.biz](https://benchmark.gallivanter.biz/). This repository owns the static site, source data and GitHub Pages deployment. It does not require private infrastructure.

## Active methodology

Methodology **v10** is active through `config/active-methodology.json` and `config/roles-v10.json`.

- Complete measured roles use versioned AA-Briefcase, GDP.pdf, Terminal-Bench 4.0 and explicitly labeled legacy evidence.
- Every eligible model has all eight role scores. Missing contributions use labeled conservative profile analogies; a model that cannot be completed is excluded entirely with one issue. Raw missing measurements remain absent.
- Documented analogies have separate provenance, conservative policy values and evidence expiry; partially measured targets keep every observed contribution.
- Only the two newest distinct catalog generations per series enter active rankings. Claude tiers are separate series, and unscored new releases still advance the window.
- Statistical Intelligence and CAI estimators remain disabled. Observed security uses direct AA Cyber Index; missing security is an explicitly labeled role analogy, never a measured Cyber Index.
- Portfolio analogies use conservative role and Intelligence values, with at most one estimated seat and shared-anchor/worker independence rules.

[Complete profile policy](methodology/complete-profiles-2026-10-28.md), [initial v10 design](methodology/selective-v10.md), [migration comparison](methodology/migration-validation-2026-10-28.md), [six-model source investigation](methodology/coverage-followup-2026-10-28.md), and [activation validation](methodology/activation-2026-10-28.md).

## Quality and cost

The ranking table retains pure Quality, 75%/25% Balanced and 40%/60% Budget views. Recommended portfolios are selected separately: all start from pure role quality. Balanced and Budget then apply their score/price exchanges. Estimated rows do not change measured percentile reference populations.

All current offers are repriced on the same fixed reference token workload. CommandCode supplies effective prices, discounts, billing categories and included credits. Actual task cost varies with task size and usage; these comparative estimates are not invoices or subscription prices. Historical comparison reports freeze existing costs explicitly and must not be confused with a fresh common-workload refresh.

## Portfolios

The rules live in `config/lineup-policy.json`: Quality retains its requested 85% Intelligence floor and adaptive descent by 0.005; Balanced and Budget require known Intelligence without a relative floor, at least four families for Quality and five for Balanced/Budget, at most two seats per family, independent reviewer families whose Reviewer quality exceeds both workers by at least two points, and a Heavy model that improves the same Implementer quality metric by at least two points. Balanced excludes the highest distinct plan-adjusted task-price level; Budget excludes the two highest levels, including every tie at six-decimal USD precision. Each mode then recalculates mean + 2 population standard deviations on its remaining latest-generation reference models and excludes further price outliers. Price exclusions remain hard constraints. Conservative analogies enforce a one-estimated-seat maximum and keep estimated security distinct from direct security measurements.

Recommendations are published in `site/data/lineups.json`. The machine-readable intended Balanced identities are in `site/data/octopus-routing.json`; generating that artifact does not apply runtime configuration or execute any models.

Balanced and Budget then minimize cost against their fixed initial selections. Each positive point of loss on the 0-100 role-quality scale requires at least 15% lower cost for that role in Balanced, or 10% in Budget. Fractional points scale continuously. There is no separate role-loss, mean-loss, swap-count or total-savings threshold: large savings can justify large score losses. A swap cannot be more expensive, and a free initial role cannot finance a quality loss. Balanced and Budget have no initial relative Intelligence cutoff. New replacements require observed role scores and observed Intelligence v5; every price, generation, family, coding and estimated-seat constraint remains enforced. Comparisons always use the same snapshot's initial role selections, never preceding replacements. A bounded search falls back to the initial portfolio if it cannot finish. Quality retains its original policy. The public lineup records each initial selection and its score/price exchange. See the [policy v19 comparison](methodology/quality-first-portfolios-2026-10-28.md).

## Refresh and validate

```sh
npm ci
npm run update
npm run update-lineups
npm run check:all
npm run build:octopus-routing
npm run check:octopus-routing
```

`npm run update` follows the active v10 configuration, collects public sources, builds the complete snapshot/portfolios/routing in ignored staging storage, validates them, and then promotes the coherent artifact set with backups. Infrastructure-wide extraction failures or infeasible portfolios preserve the preceding publication. Core artifact and source hashes are saved in `data/deployment-validation.json`. No model inference is involved.

The existing deterministic scheduler invokes `scripts/run-scheduled-weekly.sh`. The manual GitHub Actions fallback is `.github/workflows/weekly.yml`; Pages deploys `site/` after eligible pushes to main. Refresh status and weekly-review artifacts distinguish partial evidence coverage from a terminal collection failure. No new scheduled job is introduced by v10.

For a source collection without publication:

```sh
node scripts/update.mjs --methodology-v10 --output-dir tmp/selective-collection
```

For reproducible historical comparisons:

```sh
npm run compare:methodologies -- --output-dir tmp/migration-comparison
```

That comparison reads the frozen v9 baseline in `methodology/fixtures/` and separates methodology, observed coverage and analogy effects. `config/roles.json` and legacy estimator-validation artifacts are retained for historical inspection; they are not the active v10 configuration.

## Integrity and rollback

Versioned source provenance records exact AA identity, effort, raw scale, implementation and metric version. Missing evidence is never silently relabeled observed. Published snapshot/portfolio generations must match; mixed versions are hidden by the UI.

Before publication run `npm run check:all`, `npm run audit:public` and `git diff --check`. Revert an activation publication as one coherent code/data/frontend change and redeploy Pages; preserve the prior revision and manifest hashes. Do not repair a failed refresh by weakening estimator, identity or portfolio constraints.

See [the data contract](docs/data-contract.md) and [architecture](docs/architecture.md).

CommandCode DeepSeek V4.1 Flash latest aliases follow the newest dated AA release within that series at collection time, with an explicit latest-serving assumption authorized by the owner. The current resolved release is 1017; this is not independent serving attestation.
