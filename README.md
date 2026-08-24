# Octopus Role Benchmarks

Transparent **benchmark-per-dollar** comparisons for Claude Octopus roles.

This project does **not** try to name a single “best model”. It compares model quality against effective cost for each Octopus role using reproducible, public criteria.

## Data sources

- **Model universe and effective pricing:** CommandCode **Max** plan. Promotions and commercial variants are preserved as distinct rows.
- **Benchmark results:** Artificial Analysis. Commercial variants may map to the same underlying benchmarked model family.
- **Extraction layer:** OpenCLI read-only adapters.

## Core rules

1. The output is **benchmark vs effective cost**, not a winner label.
2. Every benchmark component used in a role score must have **100% coverage of all scored model families**.
3. Missing benchmark data is never imputed and weights are never renormalized around missing data.
4. Stealth or unidentified models may remain visible as `UNSCORED`; they do not contaminate scored comparisons.
5. CommandCode commercial variants (for example Fast, HighSpeed, Contributor or discounted rows) keep their own effective price while sharing the underlying model benchmark when identity is verified.
6. Every daily run writes an immutable dated snapshot so historical comparisons remain auditable.

## Pipeline

```text
daily scheduler
  -> OpenCLI CommandCode adapter
  -> OpenCLI Artificial Analysis adapter
  -> identity mapping
  -> 100% coverage validation
  -> role score + effective-cost ratios
  -> dated JSON snapshot
  -> static site build
```

## Repository layout

```text
config/roles.json            role definitions and transparent weights
docs/architecture.md         extraction and publication architecture
docs/data-contract.md        snapshot schema and identity rules
methodology/methodology.md   scoring, cost and coverage methodology
opencli/                     OpenCLI adapter specifications
scripts/validate.mjs         deterministic config/snapshot checks
site/                        static public site source (next milestone)
data/                        generated dated snapshots (once adapters land)
```

## Status

Public scaffold established. The next implementation step is the OpenCLI extraction layer for CommandCode Max and Artificial Analysis. No provisional 70%-coverage rankings are published.

## License

MIT.
