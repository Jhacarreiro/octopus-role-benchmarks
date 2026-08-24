# Architecture

## Objective

Daily, auditable **role benchmark quality vs effective CommandCode Max cost per task**.

## Sources via OpenCLI

- `commandcode max`: current Max rows, effective promotional prices, cache prices and commercial flags.
- `artificial-analysis models`: canonical model identity, role benchmark components and Intelligence Index per-task token/cost telemetry.
- `artificial-analysis coding-agents`: Coding Agent variants, DeepSWE / Terminal-Bench v2.1 / SWE-Atlas-QnA, pooled tokens, API cost, execution time and harness identity.

All current adapters use public structured/server-rendered data and require no login, cookies or browser profile.

## Identity

A CommandCode row is `exact`, `exact_alias`, `commercial_variant`, or `unscored`. No fuzzy match alone is sufficient to publish a benchmark mapping.

Coding Agent host IDs are normalized conservatively: provider/endpoint wrappers are removed only when the remaining identifier exactly matches a scored AA family.

## Daily run

```text
GitHub Actions
 -> OpenCLI extraction
 -> verified identity mapping
 -> 100% role-component coverage gate
 -> 100% universal task-efficiency coverage gate
 -> CommandCode repricing of measured task token mix
 -> role scores and score/$task
 -> optional partial Coding Agent evidence
 -> immutable dated snapshot + latest.json
```

## Fail closed

The daily run fails if a required source cannot be read, an active role component falls below 100%, task-efficiency coverage falls below 100%, or a scored CommandCode row loses verified identity. Partial Coding Agent coverage does not fail the universal snapshot because that evidence is never mixed into the universal role score.
