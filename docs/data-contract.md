# Data contract

Current snapshot schema: **4**.

```json
{
  "schemaVersion": 4,
  "date": "YYYY-MM-DD",
  "coverage": {},
  "efficiencyCoverage": {},
  "codingAgentCoverage": {},
  "caiStarCoverage": {},
  "caiEstimator": {},
  "models": [],
  "roles": []
}
```

Each scored model row separates:

- CommandCode commercial identity and effective prices;
- Artificial Analysis benchmark-family identity;
- universal `taskEfficiency` and CommandCode-repriced cost/task;
- `caiStar` with `source: observed | estimated`;
- Ridge and 5NN components for estimated CAI* rows;
- optional raw observed `codingAgent` evidence;
- Universal Role Score;
- coding-adjusted `rankingQuality` where applicable;
- final `rankingValue`.

Commercial variants may share the underlying model-family benchmarks and CAI* while retaining distinct CommandCode prices and policy flags.

Rows with `mapping.status = "unscored"` must not contain fabricated scores or ranking values.

## Validation sidecar

`data/cai-validation.json` stores the current reverse-validation metrics and fail-closed guardrails. `methodology/cai-estimation-validation.md` is generated from the same run for human-readable auditability.
# Opt-in snapshot schema 7

The active v10 pipeline emits `schemaVersion: 7`, `methodologyVersion: 10` and `coverageScope: "per-role"`. The active configuration is selected through `config/active-methodology.json`; legacy role configuration and historical snapshots remain available.

Each mapped model retains its observed benchmark components even when Intelligence or another role's inputs are missing. `roleScores[role]` has `completeness`, `coverageWeight`, `missingComponents`, and `scoreRange`. `score`, `rankingQuality` and `rankingValue` are null for incomplete roles. Complete roles use observed normalized components only. `experimentalBenchmarks` is a separate diagnostic namespace and has no scoring weight.

`benchmarkProvenance` records raw scale/value, source field, URL, model UUID, effort, version, implementation, lifecycle and capture time. `evaluatedAt` is null when unknown. Legacy is a lifecycle of an observed value, not a synonym for estimated. Unknown measured Intelligence remains null; measured portfolio eligibility requires `intelligenceIndexVersion: "5.0"` and a finite observed score. Explicit role analogies use the separately documented conservative policy value from observed v5 anchors; unknown anchor Intelligence stays unavailable.

`roleCoverage` reports complete identities and offers for each role, with a separate observed-Intelligence count. Aggregate `scoredFamilies` means identities with at least one complete role, not identities complete in every role. `caiStarCoverage.required` is false and statistical Intelligence/CAI estimator flags remain false. `approximationPolicy` separately enables user-authorized role analogies and caps estimated portfolio seats at one. `roleCoverage.estimatedOffers` is separate from measured coverage.

V10 portfolio artifacts also bind `methodologyVersion`, `snapshotGeneratedAt` and `intelligenceIndexVersion`. The frontend refuses mismatched methodology/generation pairs, including a legacy portfolio served alongside a v10 snapshot from the same calendar date.

See [selective methodology v10](../methodology/selective-v10.md) for the opt-in commands and activation boundary.

`generationEligibility` records active/historical state, series, generation rank, the two newest distinct catalog generations and the reason. The full retained catalog defines the window even for unscored new releases. Historical rows remain stored but never enter active rankings, coverage or portfolios.

Unmatched approximated rows retain `aaModel: null`, empty `benchmarks`/`benchmarkProvenance`, `mapping.status: "approximated"`, and `approximation` with sources, anchors, margin, role scope and evidence-review expiry. Estimated `roleScores` use `status/completeness/measurementKind: "estimated"`; `rankingQuality` is the lower heuristic policy value. `scoreRange` is not a confidence interval. Security is never approximated. Portfolio selection preserves the approximation provenance and conservative Intelligence value.

Partial observed targets use `mapping.status: "partial_approximated"`, keep their actual `aaModel` and all measured benchmark provenance, and retain the original partial calculation in `roleScores[role].observedRole`. Per-component analogy values live only under role provenance, never in target raw benchmark fields. Complete observed roles are never overwritten. Analogy coverage remains separate from measured coverage, including on these hybrid rows. V10-only `verifiedIdentities` resolves new public identity evidence independently of default production aliases.
