# Octopus Role Benchmarks

Transparent **benchmark-per-task-dollar** comparisons for Claude Octopus roles.

This project does **not** name a universal “best model”. It compares role-relevant quality against the effective cost of completing benchmark work.

## Live data

The daily pipeline reads:

- **CommandCode Max** — current model catalogue and effective pricing, including promotions;
- **Artificial Analysis** — model benchmarks plus measured per-task token mix;
- **Artificial Analysis Coding Agent Index** — agentic coding evidence where available;
- **OpenCLI 1.8.6** — read-only structured extraction layer.

The current snapshot is [`data/latest.json`](data/latest.json). Historical dated snapshots are retained.

## Primary value metric

The default denominator is **CommandCode Cost per Task**, not price per million tokens.

Artificial Analysis measures non-cached input, cache-read, cache-write and output usage per Intelligence Index task. The pipeline reprices that measured token mix using current effective CommandCode Max prices. This penalizes models that need much more token volume to reach similar quality.

Input/output price-per-million views remain secondary diagnostics.

## Coverage rules

1. Every component inside a role score must have **100% coverage** of all scored AA model families.
2. The primary Cost-per-Task denominator must also have **100% coverage**.
3. Missing values are never imputed and weights are never renormalized around missing data.
4. Stealth/unresolved models remain visible as `UNSCORED`.
5. Commercial variants can share a verified underlying benchmark but keep their own CommandCode price and policy flags.
6. Daily updates fail closed if required identity, benchmark or task-cost coverage breaks.

## Coding Agent evidence

For `implementer`, `implementer-heavy` and `code-reviewer`, the UI also shows the current Artificial Analysis Coding Agent Index where a safe evaluated model mapping exists.

It combines DeepSWE, Terminal-Bench v2.1 and SWE-Atlas-QnA, with pooled tokens/task, API cost/task and execution time. Coverage is partial, so **it is not mixed into the role score**. Coding-specific cost is displayed using AA's published API cost/task rather than a speculative CommandCode repricing.

## Pipeline

```text
GitHub Actions daily
  -> OpenCLI CommandCode Max adapter
  -> OpenCLI Artificial Analysis model adapter
  -> OpenCLI Artificial Analysis Coding Agent adapter
  -> verified identity mapping
  -> 100% role-benchmark coverage gate
  -> 100% universal task-cost coverage gate
  -> role score / CommandCode-repriced task cost
  -> optional partial Coding Agent evidence
  -> dated JSON snapshot
  -> static UI data
```

See [`methodology/methodology.md`](methodology/methodology.md) for exact weights, task-cost derivation and limitations.

## Run locally

```bash
npm ci
npm run update
npm test
```

No account cookies, API keys or browser profile are required for the current public extraction path.

## License

MIT.
