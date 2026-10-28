# Coverage gaps — 2026-10-28

Read-only inventory from the last published Octopus snapshot. This is not a new benchmark run and is not a substitute for source observations.

- Source-incomplete families: 43 (48 CommandCode rows).
- Partial-scored families: 5 (8 CommandCode rows).
- Source-incomplete rows miss both GDPval and Omniscience, and currently lack a usable Intelligence Index.
- The Implementer role uses SciCode, LCR, HLE and does not depend on either missing component. Its inputs can be present even when the family is blocked globally.
- Not every globally incomplete row has complete Implementer inputs; check the live AA parser before treating it as ready.
- An alternative Intelligence proxy calibrated on observed families using HLE/SciCode/LCR had n=35, held-out MAE approximately 5.65 and P90 approximately 10.8, above the existing P90 <=10 acceptance gate. It was NOT enabled.
- AA publishes fewer Omniscience v1.1 and GDPval-AA v2.1 observations than the CommandCode catalogue requires. Do not fill unavailable versions from legacy values without documented calibration.
- The role-specific benchmark methodology and intelligence cutoffs are unchanged.

Sources: https://artificialanalysis.ai/evaluations/omniscience and https://artificialanalysis.ai/evaluations/gdpval-aa

See `coverage-gaps-2026-10-28.csv` for per-model missingness and role impact.
