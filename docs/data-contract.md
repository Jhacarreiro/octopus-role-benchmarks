# Data contract

Each dated snapshot is immutable and records source timestamps, raw identity references and derived values.

Minimum top-level shape:

```json
{
  "schemaVersion": 1,
  "date": "YYYY-MM-DD",
  "sources": {
    "commandCodeMax": {"retrievedAt": "ISO-8601"},
    "artificialAnalysis": {"retrievedAt": "ISO-8601"}
  },
  "models": [],
  "roles": {}
}
```

Each model row must keep the CommandCode commercial identity separate from the benchmark-family identity. This is required so discounted/Fast/Contributor variants can share quality scores while preserving their own effective cost.

Stealth or unresolved models use `mapping.status = "unscored"` and must not contain fabricated benchmark values.
