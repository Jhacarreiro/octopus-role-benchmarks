# Octopus Role Benchmarks

A transparent **benchmark-vs-cost ranking** for Claude Octopus roles using the current CommandCode Max catalogue.

The public UI shows one number per model and role: **Ranking Value**. Higher is better.

## Ranking formula

For non-coding roles:

```text
Ranking Value = Universal Role Score / CommandCode Cost per Task
```

For `implementer`, `implementer-heavy` and `code-reviewer`:

```text
Ranking Value = (2/3 Universal Role Score + 1/3 CAI*) / CommandCode Cost per Task
```

`CAI*` uses the observed Artificial Analysis Coding Agent Index when available. Missing CAI values are estimated with a reverse-validated 50/50 ensemble of ridge regression and inverse-distance 5-nearest-neighbours.

## Why Cost per Task

Nominal price per million tokens can make verbose models look artificially cheap. Artificial Analysis publishes the measured token mix consumed per Intelligence Index task. The pipeline reprices that measured non-cached input, cache-read, cache-write and output usage with current effective CommandCode Max prices, including promotions.

The Cost-per-Task denominator has **100% coverage** of the scored model-family universe.

## CAI coverage and estimation

The current pipeline keeps observed and estimated CAI separate in the raw data, but combines them into one `CAI*` for ranking:

- observed CAI where Artificial Analysis has a mapped Coding Agent result;
- estimated CAI everywhere else;
- commercial CommandCode variants never count as extra training examples.

The estimator is rerun and reverse-validated every day. The daily job fails closed if the estimator or final-ranking guardrails are breached.

See:

- [`methodology/methodology.md`](methodology/methodology.md) — full methodology;
- [`methodology/cai-estimation-validation.md`](methodology/cai-estimation-validation.md) — current reverse validation;
- [`config/roles.json`](config/roles.json) — machine-readable role weights and ranking parameters;
- [`data/latest.json`](data/latest.json) — current scored snapshot;
- [`data/cai-validation.json`](data/cai-validation.json) — current validation metrics.

## Sources

- **CommandCode Max** — current model catalogue and effective pricing;
- **Artificial Analysis** — model benchmarks and per-task efficiency telemetry;
- **Artificial Analysis Coding Agent Index** — observed agentic coding outcomes;
- **OpenCLI 1.8.6** — read-only structured extraction layer.

## Pipeline

```text
GitHub Actions daily
  -> OpenCLI CommandCode Max
  -> OpenCLI Artificial Analysis models
  -> OpenCLI Coding Agent Index
  -> verified model-family mapping
  -> 100% universal benchmark coverage gate
  -> 100% CommandCode Cost-per-Task coverage gate
  -> fit CAI* estimator on observed CAI families
  -> estimate missing CAI values
  -> reverse validation + guardrails
  -> one Ranking Value per role/model
  -> dated JSON snapshot + public site data
```

## Run locally

```bash
npm ci
npm run update
npm test
```

No login cookies, API keys or browser profile are required for the current public extraction path.

## License

MIT.
