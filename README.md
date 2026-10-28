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

Quality uses only role capability. Balanced combines 75% role-quality percentile and 25% affordability percentile; Budget uses 40% and 60%. Estimated rows do not change measured percentile reference populations.

All current offers are repriced on the same fixed reference token workload. CommandCode supplies effective prices, discounts, billing categories and included credits. Actual task cost varies with task size and usage; these comparative estimates are not invoices or subscription prices. Historical comparison reports freeze existing costs explicitly and must not be confused with a fresh common-workload refresh.

## Portfolios

The rules live in `config/lineup-policy.json`: requested Intelligence floors 85/80/75%, adaptive descent by 0.005 to a feasible pool, at least four families for Quality and five for Balanced/Budget, at most two seats per family, independent reviewer families, and a Heavy model that improves the same Implementer quality metric by at least two points. Balanced excludes the highest distinct plan-adjusted task-price level; Budget excludes the two highest levels, including every tie at six-decimal USD precision. Each mode then recalculates mean + 2 population standard deviations on its remaining latest-generation reference models and excludes further price outliers. Price exclusions cannot be relaxed by the Intelligence adjustment. Conservative analogies enforce a one-estimated-seat maximum and keep estimated security distinct from direct security measurements.

Recommendations are published in `site/data/lineups.json`. The machine-readable intended Balanced identities are in `site/data/octopus-routing.json`; generating that artifact does not apply runtime configuration or execute any models.

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
