# Data contract

Current snapshot schema: **3**.

```json
{
  "schemaVersion": 3,
  "date": "YYYY-MM-DD",
  "coverage": {},
  "efficiencyCoverage": {},
  "codingAgentCoverage": {},
  "models": [],
  "roles": []
}
```

Each scored model row keeps separate:

- CommandCode commercial identity and effective prices;
- Artificial Analysis benchmark-family identity;
- `taskEfficiency` with AA-measured token mix and CommandCode-repriced cost/task;
- role scores and value ratios;
- optional `codingAgent` evidence with AA Coding Agent Index, component scores, API cost/task, tokens/task, time/task and selected harness.

Commercial variants may share the underlying benchmark family while retaining distinct CommandCode prices and policy flags.

Rows with `mapping.status = "unscored"` must not contain role scores or fabricated benchmark values.
