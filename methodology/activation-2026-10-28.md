# Methodology v10 activation

Deployment and a public-source refresh were explicitly authorized on 2026-10-28. The active selector is `config/active-methodology.json`; the default `npm run update` now uses v10, while the existing scheduler and manual GitHub fallback retain their ownership. Statistical Intelligence and CAI estimators remain disabled. No model inference or operational provider-configuration change is part of activation.

## Publication contract

The publisher collects sources into ignored staging storage, validates the snapshot, generates the complete portfolios and intended Balanced identities, and then promotes the coherent artifact set. It refuses widespread extraction failure and infeasible portfolios. Existing published artifacts are backed up before replacement, and failed replacement restores them. Source/artifact hashes and the preceding committed snapshot hash are recorded in `data/deployment-validation.json`.

Windows collection uses the same installed OpenCLI entry point as Linux, with isolated adapter/cache paths and no shell-built arguments. The current updater performs no statistical Intelligence/CAI reverse-validation fit; the legacy estimator artifacts remain historical.

The public intended-routing artifact is regenerated to match the displayed Balanced recommendation. It does not write operational provider configuration or run its recommended models.

## First supervised collection

The collection at `2026-10-28T14:35:30.344Z` fetched the current public CommandCode catalog and exact AA observations:

- 99 raw offers, 97 retained, 29 historical and 68 active;
- 56 offers with some complete measured role, plus ten with documented analogies;
- 66/68 active offers have some role coverage; only the two Jev offers are unranked;
- 50 matched AA identities, 48 with some complete measured role and 29 with observed v5 Intelligence;
- 20 measured Cyber Index identities, including the verified Beam record;
- no estimated model is selected in the current three portfolios.

| Mode | Effective Intelligence floor | Families | Estimated adjusted eight-task cycle |
| --- | ---: | ---: | ---: |
| Quality | 0.740 | 5 | $12.588447 |
| Balanced | 0.740 | 5 | $10.717514 |
| Budget | 0.740 | 5 | $9.314314 |

These values use fresh effective prices and the common v10 reference workload for every model. They differ from the migration comparison, which deliberately froze each existing offer's previous task costs. Changes must not be presented as measured task-performance or realized monetary savings. Subsequent public refreshes may change the displayed values and generation timestamp.

## Checks and rollback

Full Windows/Node 24 checks pass, including legacy behavior, v10 provenance/analogies, real selection constraints, default v10 validation, matching lineup/routing artifacts and source/artifact hashes. Dedicated failure cases prove that global source loss and an infeasible security portfolio leave every current published artifact untouched. Hosted Linux/Node 22 CI runs these checks through the existing validation job.

HTML references fresh versioned JavaScript assets. Actual public rendering, controls, estimate provenance and methodology pages must be checked after Pages deployment; JSON availability alone does not establish UI correctness. The exact deployment and refresh runs are linked in the PR.

The preceding production base is `24b7d71fd27df2fe1428207bc153bab35b5f7aa6`; its public snapshot SHA-256 is `9a3c3181fad2aae4bb7900d805a6e1c9dd2340b29b3f0fc9564618a3efedb451`. Revert the activation publication coherently and redeploy Pages to restore the preceding version. Do not mix legacy snapshots with v10 lineups or frontend state. Historical v9 comparisons now read a dedicated frozen fixture so same-day publication does not overwrite the evidence baseline.
