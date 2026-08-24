# Octopus Role Benchmarks

Transparent **benchmark-per-dollar** comparisons for Claude Octopus roles.

This project does **not** try to name a single “best model”. It compares role-relevant quality against effective cost using reproducible public criteria.

## Live data

The daily pipeline reads:

- **CommandCode Max** — current model catalogue and effective pricing, including active promotions;
- **Artificial Analysis** — canonical model identities and benchmark components;
- **OpenCLI 1.8.6** — read-only structured extraction layer.

The current snapshot is [`data/latest.json`](data/latest.json). Historical dated snapshots are retained.

## Rules

1. Output is **benchmark vs effective cost**, not a winner label.
2. Every active component must have **100% coverage** of all scored AA model families.
3. Missing values are never imputed and weights are never renormalized around missing data.
4. Stealth/unresolved models remain visible as `UNSCORED`.
5. Commercial variants can share an underlying benchmark only when identity is verified; their CommandCode price and policy flags remain distinct.
6. Daily updates fail closed: if identity or coverage breaks, the last known-good snapshot remains public.

## Pipeline

```text
GitHub Actions daily
  -> OpenCLI CommandCode Max adapter
  -> OpenCLI Artificial Analysis adapters
  -> verified identity mapping
  -> 100% coverage gate
  -> role score + effective-cost ratios
  -> dated JSON snapshot
  -> static UI data
```

## Methodology

See [`methodology/methodology.md`](methodology/methodology.md) for the exact weights, benchmark rationale, cost bases, coverage rules and limitations.

The machine-readable definitions live in:

- [`config/roles.json`](config/roles.json)
- [`config/model-aliases.json`](config/model-aliases.json)

## Run locally

```bash
npm ci
npm run update
npm test
```

No account cookies, API keys or browser profile are required for the current public extraction path.

## License

MIT.
