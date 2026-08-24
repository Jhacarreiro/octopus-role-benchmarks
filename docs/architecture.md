# Architecture

## Objective

Produce a daily, auditable comparison of **role-relevant benchmark quality versus effective CommandCode Max cost**.

## Extraction

OpenCLI is the extraction interface. Each source gets a read-only adapter and follows OpenCLI's preferred strategy hierarchy: public structured source first, then progressively heavier mechanisms only when required.

### CommandCode Max

The adapter returns the current Max model rows including:

- display name;
- provider/model identity when exposed;
- input, output, cache-read and cache-write prices;
- effective promotional price;
- promotion metadata;
- commercial-variant markers such as Contributor, Fast or HighSpeed.

### Artificial Analysis

The adapter returns benchmarked model families and the benchmark components required by the active role methodology. Identity must be based on canonical model identifiers/URLs where possible, never fuzzy name matching alone.

## Identity mapping

A CommandCode row maps to one of:

- `exact`: direct underlying-model identity confirmed;
- `commercial_variant`: same benchmarked underlying model, different CommandCode commercial row/price;
- `unscored`: stealth or identity/benchmark not verifiable.

`unscored` rows remain visible in output but never receive proxy benchmark values.

## Daily update

The scheduler is intentionally separate from OpenCLI. A daily job invokes the adapters, validates the data, writes a dated snapshot and rebuilds the static site. OpenCLI extracts; the scheduler schedules.

## Failure behavior

A run fails closed if:

- a required source cannot be read;
- a benchmark component selected for scoring is below 100% coverage;
- a scored CommandCode row lacks a verified underlying benchmark family;
- prices or benchmark values cannot be parsed deterministically.

The last known-good public snapshot remains available.
