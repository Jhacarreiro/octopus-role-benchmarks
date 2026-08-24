# OpenCLI adapters

This directory defines the extraction boundary for the two public sources.

Planned adapters:

- `commandcode-max`: current Max model catalogue and effective pricing;
- `artificial-analysis`: canonical model identities and benchmark components.

Adapters must be read-only and return structured JSON. Prefer public endpoints/SSR/hydration state over browser automation. Browser/DOM extraction is a fallback, not the default architecture.

No cookies, account state, tokens or machine-specific OpenCLI profiles belong in this repository.
