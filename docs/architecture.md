# Architecture

## Objective

Generate one daily, auditable **Ranking Value** per CommandCode Max row and Octopus role.

## Extraction via OpenCLI

- `commandcode max` — current Max catalogue, effective promotional prices, cache prices and commercial flags.
- `artificial-analysis models` — canonical model identity, universal benchmark components and Intelligence Index per-task efficiency telemetry.
- `artificial-analysis coding-agents` — observed Coding Agent Index variants and harness metadata.

All current adapters use public structured/server-rendered data and require no login, cookies or browser profile.

## Identity

A CommandCode row is `exact`, `exact_alias`, `commercial_variant`, or `unscored`. Fuzzy matching alone is never sufficient to publish a benchmark identity.

Coding Agent host IDs use explicit aliases or conservative provider-wrapper normalization. Commercial variants share benchmark-family quality/telemetry only after identity is verified, while retaining their own CommandCode price and policy flags.

## Ranking pipeline

```text
OpenCLI sources
 -> verified model-family mapping
 -> 100% universal benchmark coverage gate
 -> 100% task-efficiency coverage gate
 -> CommandCode Cost-per-Task repricing
 -> observed Coding Agent mapping
 -> fit CAI estimator on unique observed families
 -> CAI* observed/estimated to 100% coverage
 -> reverse validation + guardrails
 -> role quality blend
 -> one Ranking Value
 -> immutable dated snapshot + site data
```

## Failure behavior

The daily job fails closed if:

- a required public source cannot be read;
- a universal role-score component falls below 100% coverage;
- task-efficiency coverage falls below 100%;
- a scored CommandCode row loses verified AA identity;
- CAI* cannot be produced for every scored family;
- reverse-validation estimator/ranking guardrails fail.

The last known-good snapshot remains public.
