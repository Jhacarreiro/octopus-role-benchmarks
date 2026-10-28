# Portfolio price exclusions

Policy v14 removes the highest distinct plan-adjusted task-price level from Balanced, and the two highest levels from Budget. Every tied offer is removed, at the same six-decimal USD precision as published task prices. These are price levels, not a fixed number of offers. The ranking universe is the portfolio candidate pool before its Intelligence threshold.

Each mode then calculates its own mean and population standard deviation using the remaining latest-generation scored reference models. Prices above mean + 2 standard deviations are removed as a second step. Excluded price levels do not influence these statistics. The Intelligence baseline and feasible portfolio are determined after both filters. Price exclusions never relax to rescue feasibility.

On the same observed input snapshot (2026-10-28 15:13 UTC):

| Mode | Price-level exclusions | Additional statistical exclusions | Adjusted 8-task cycle |
|---|---|---|---:|
| Balanced | GPT-6 Astra ($8.605424) | Claude Fable 5.1 | $10.717514 |
| Budget | GPT-6 Astra ($8.605424), Claude Fable 5.1 ($6.221286) | Claude Opus 5.5, Muse Wonder | $6.539957 |

Budget's recalculated statistical cutoff is $2.254245; Balanced's is $3.534424. The preceding Budget cycle was $9.314314: the new policy reduces that comparative estimate by 29.79%, and is 38.98% below Balanced. Budget's summed role-quality score changes from 484.233 to 459.408. These are fixed-reference-workload comparisons, not realized billing savings.

Requested Intelligence floors remain 80% for Balanced and 75% for Budget. The existing automatic feasibility adjustment results in effective floors of 74% and 62.5%, respectively. Budget's post-price-filter Intelligence baseline is 54.5087; it needs that adjustment to retain five families and satisfy the coding constraints. No Intelligence estimator is enabled. Quality's selections, costs and rules are unchanged.

Validation covers complete tie removal at both price levels, recalculation after removal, zero-cost offers, invalid settings and fail-closed behavior. The full local checks pass, including portfolio family separation, Heavy improvement, the estimated-seat cap, public artifact preservation on source/security failure, routing consistency and UI mode switching.
