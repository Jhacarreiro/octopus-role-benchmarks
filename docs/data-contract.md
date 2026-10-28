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

The isolated v10 pipeline emits `schemaVersion: 7`, `methodologyVersion: 10` and `coverageScope: "per-role"`. The currently published snapshot stays on its previous schema.

Each mapped model retains its observed benchmark components even when Intelligence or another role's inputs are missing. `roleScores[role]` has `completeness`, `coverageWeight`, `missingComponents`, and `scoreRange`. `score`, `rankingQuality` and `rankingValue` are null for incomplete roles. Complete roles use observed normalized components only. `experimentalBenchmarks` is a separate diagnostic namespace and has no scoring weight.

`benchmarkProvenance` records raw scale/value, source field, URL, model UUID, effort, version, implementation, lifecycle and capture time. `evaluatedAt` is null when unknown. Legacy is a lifecycle of an observed value, not a synonym for estimated. Unknown Intelligence remains null; portfolio eligibility requires `intelligenceIndexVersion: "5.0"` and a finite observed score.

`roleCoverage` reports complete identities and offers for each role, with a separate observed-Intelligence count. Aggregate `scoredFamilies` means identities with at least one complete role, not identities complete in every role. `caiStarCoverage.required` is false and all v10 estimator-enabled flags are false.

V10 portfolio artifacts also bind `methodologyVersion`, `snapshotGeneratedAt` and `intelligenceIndexVersion`. The frontend refuses mismatched methodology/generation pairs, including a legacy portfolio served alongside a v10 snapshot from the same calendar date.

See [selective methodology v10](../methodology/selective-v10.md) for the opt-in commands and activation boundary.
