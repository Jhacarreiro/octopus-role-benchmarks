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
