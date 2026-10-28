# Selective v10 implementation validation

Frozen baseline: `24b7d71fd27df2fe1428207bc153bab35b5f7aa6`, `data/2026-10-28.json`. Source captures: 2026-10-28. The new estimator is disabled. This delivery does not activate v10, refresh production, publish a site or change routing.

## Result

The selective core scores 64 verified AA identities (73 retained commercial offers) in at least one role. The catalog has 99 raw offers, 97 after free-offer preference, and 76 verified AA identities. Four roles remain limited by Omniscience. Only 29 identities have observed v5 Intelligence and can participate in portfolios before cost, generation and diversity filters. Both existing synthetic AA proxies are unranked in v10.

| Role | Complete identities | Offers | Also observed Intelligence v5 |
| --- | ---: | ---: | ---: |
| architect | 64 | 73 | 29 |
| strategist | 33 | 37 | 29 |
| security-reviewer | 19 | 23 | 14 |
| code-reviewer | 33 | 37 | 29 |
| implementer | 64 | 73 | 29 |
| implementer-heavy | 64 | 73 | 29 |
| synthesizer | 33 | 37 | 29 |
| researcher | 33 | 37 | 29 |

## Ranking comparison

The aligned comparison uses the same 29 observed-v5 identities and exact existing per-offer task costs. It includes the source/normalization changes and removal of CAI* as part of the methodology change. Historical and estimated components in the old baseline are retained with their original provenance, not relabeled observed. Old partial scores are identified in the rank-movement data. Security has 14 identities in this common cohort.

| Role | Spearman | Kendall tau-b | Top-5 overlap | Top-10 overlap |
| --- | ---: | ---: | ---: | ---: |
| architect | 0.874 | 0.742 | 100% | 70% |
| strategist | 0.871 | 0.744 | 80% | 90% |
| security-reviewer | 1.000 | 1.000 | 100% | 100% |
| code-reviewer | 0.876 | 0.798 | 80% | 90% |
| implementer | 0.851 | 0.734 | 60% | 90% |
| implementer-heavy | 0.861 | 0.759 | 80% | 80% |
| synthesizer | 0.901 | 0.734 | 80% | 80% |
| researcher | 0.877 | 0.759 | 60% | 80% |

The major rank alerts are GPT-6.1 Terra: 29→13 Architect, 29→11 Strategist, 28→8 Code Reviewer, 28→8 Implementer, 29→9 Heavy, 17→6 Synthesizer and 27→9 Researcher. Its prior role scores were partial. Removing the old CAI* missingness penalty and using directly observed Terminal-Bench/professional-work evidence explains this movement; it is not an imputed benchmark uplift. Absolute composite totals across methodologies have different meanings and must not be interpreted as task accuracy improvements.

Security retains the same raw Cyber Index and ordering. Under ±5 percentage-point component-weight perturbations, top-5 overlap is 100% in six weighted roles and at least 80% in Strategist. Component ablations and benchmark correlations are reported separately; they do not authorize automatic weight changes. Quality, Balanced and Budget rank statistics are included in the JSON report.

## Portfolio comparison

All three candidate portfolios satisfy the unchanged Intelligence, cost-filter, family, reviewer-independence and Heavy-advantage constraints. Existing costs are frozen; newly scoreable offers use frozen reference workload/rates. These are comparative estimates for an eight-task portfolio cycle, not live invoices or task-performance measurements.

| Mode | Requested floor | Effective floor | Published cost | Candidate cost | Cost change | Changed seats |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| quality | 0.850 | 0.740 | $43.290777 | $34.962383 | -19.24% | 4 |
| balanced | 0.800 | 0.790 | $28.767515 | $31.606593 | +9.87% | 5 |
| budget | 0.750 | 0.750 | $28.767515 | $28.456560 | -1.08% | 3 |

| Role | Quality | Balanced | Budget |
| --- | --- | --- | --- |
| architect | Muse Wonder | Muse Wonder | Muse Wonder |
| strategist | Claude Opus 5.5 | Claude Sonnet 5.5 | Kimi K3.1 Pro |
| security-reviewer | Kimi K3.1 Pro | Kimi K3.1 Pro | Kimi K3.1 Pro |
| code-reviewer | Gemini 4 Argon | Claude Sonnet 5.5 | Gemini 4 Argon |
| implementer | Claude Sonnet 5.5 | Gemini 4 Argon | GPT-6.1 Terra |
| implementer-heavy | Kimi K3.1 Pro | Kimi K3.1 Pro | Claude Sonnet 5.5 |
| synthesizer | GPT-6.1 Sol | GPT-6.1 Sol | GPT-6.1 Sol |
| researcher | GPT-6.1 Sol | GPT-6.1 Sol | Gemini 4 Argon |

Quality relaxes the 85% requested floor to 74% to satisfy all existing constraints. Balanced relaxes 80% to 79%; Budget stays at 75%. The highest Intelligence baseline remains 58.406 before cost filtering and 54.5087 after the Balanced/Budget outlier filter. The new observed-only reference population changes the cost cutoff from 9.308693 to 10.016849; the filter algorithm and policy are unchanged.

The decomposition matters: on the aligned observed cohort alone, v10 Budget costs 31.606593 versus 28.767515 for v9. Expanding complete role rankings changes affordability/quality percentiles and moves four Budget seats, yielding 28.456560. Thus the small final Budget saving is not a pure weight-change saving. Expanded role coverage changes no Quality or Balanced seats in this frozen run.

Balanced becomes about 10% more expensive. Its objective is the unchanged 75/25 percentile blend, not minimum dollar cost; this tradeoff is a review finding, not a reason to silently retune the approved weights. Full per-seat changes, baseline/cutoff populations, costs and provenance are in [the comparison JSON](validation/selective-v10-2026-10-28.json).

## Reproduction and checks

```sh
npm ci
npm run check:all
npm audit --omit=dev
npm run compare:methodologies -- --output-dir tmp/migration-comparison
node scripts/validate.mjs --snapshot tmp/migration-comparison/expanded-v10.json
git diff --check
```

Local validation ran on Windows x64 / Node 24.13.1. The existing hosted validation job uses Linux / Node 22; `check:snapshot` now includes the focused v10 behavior checks, without adding a workflow or job.

Checks cover scale/version integrity, exact effort isolation, missing-role independence, source failure isolation, no estimation, free offer preference and valid eight-seat portfolios. The default v9 snapshot and lineups still pass their original checks. The candidate site runtime smoke uses v10 inputs in memory and verifies same-origin loading, provenance, status and selection buttons. It is a DOM runtime smoke, not pixel-level browser verification. A real browser rendering check remains required before eventual activation.

The local dependency audit returned zero vulnerabilities. Public sanitization runs over every staged implementation/report/fixture file before branch publication. Published `data/**`, `site/data/**`, default `config/roles.json`, policy, routing mappings and workflow files are unchanged. The compact report and two lineup artifacts live only under `methodology/validation/`.

Portfolio artifacts bind their methodology and snapshot-generation timestamp. Positive v10 rendering and deliberate same-date v9/v10 mismatch rejection both pass in the focused behavior checks; mismatched portfolios are hidden while role rankings remain available.

## Remaining activation work

Production activation is intentionally withheld. A later approved activation must recheck source-version bindings, run the supervised refresh, verify rendered pages with real browser inputs, and publish the snapshot/portfolios/frontend as a coherent version with rollback hashes. The existing refresh command remains v9. The new residual Intelligence estimator is neither enabled nor included in the code path.
