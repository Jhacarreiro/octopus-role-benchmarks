# Octopus Role Benchmarks

Transparent **Quality** and **Balanced** rankings for Claude Octopus roles using the current CommandCode Max catalogue, plus curated Quality/Balanced/Budget portfolio recommendations.

The detailed table exposes two modes: **Quality** ignores price; **Balanced** divides role quality by CommandCode Cost per Task. The top lineup adds a curated **Budget** portfolio.

## Public site

The static UI is deployed directly from this repository by `.github/workflows/pages.yml`. It does not depend on the Radar repository.

Current native GitHub Pages URL:

```text
https://jhacarreiro.github.io/octopus-role-benchmarks/
```

Target branded URL after DNS cutover:

```text
https://benchmark.getrad.ar/
```

`getrad.ar` is only the shared domain namespace; benchmark source, deployment and history remain owned by this repository.

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
GitHub Actions weekly
  -> OpenCLI CommandCode Max
  -> OpenCLI Artificial Analysis models
  -> OpenCLI Coding Agent Index
  -> verified model-family mapping
  -> 100% universal benchmark coverage gate
  -> 100% CommandCode Cost-per-Task coverage gate
  -> fit CAI* estimator on observed CAI families
  -> estimate missing CAI values
  -> reverse validation + guardrails
  -> Role Quality + Balanced Score per role/model
  -> validate curated lineup policy against the fresh snapshot
  -> generate site/data/lineups.json
  -> dated JSON snapshot + public site data
```

## Recommended lineup policy

The top-page recommendations are a **portfolio assignment**, not eight independent #1 picks. The machine-readable source is [`config/lineup-policy.json`](config/lineup-policy.json); [`scripts/build-lineups.mjs`](scripts/build-lineups.mjs) validates it against every fresh snapshot and generates `site/data/lineups.json`. The daily job fails if the policy becomes invalid.

Current policy highlights:

- the same exact model may occupy two seats when useful; commercial rows sharing the same `aaModel.slug` may also coexist; diversity is enforced at the **family** level, not the model/benchmark-identity level;
- each lineup must span **5–8 distinct model families**; 6, 7 or 8 are all acceptable and no manual lineup is forced toward a particular target;
- a family may occupy at most **2 seats**;
- Balanced requires Claude Opus 5, GPT-5.6 Luna and GPT-5.6 Sol somewhere in the eight-seat portfolio; their roles are policy decisions, not permanent model identities;
- GPT-5.6 Sol is forbidden for normal `implementer`; routine implementation is intentionally assigned to a cheaper high-quality model, while Sol is reserved for `implementer-heavy` / escalation-class work;
- Claude Sonnet 5 remains eligible for portfolio selection but is not mandatory;
- Security Reviewer cards use an explicit tier policy because current public cybersecurity benchmarks do not provide sufficiently broad, comparable coverage across this model universe: Quality → Claude Fable 5, Balanced → Claude Opus 5, Budget → Muse Spark 1.2 Contributor;
- Budget scored picks must retain at least 80% of the best role quality;
- free unresolved rows may enter only through an explicit external-evidence override and remain excluded from the scored Quality/Balanced tables.

The rationale and operating rules are documented in [`methodology/lineup-selection.md`](methodology/lineup-selection.md).

Future single-seat swap opportunities are evaluated after every refresh by `scripts/evaluate-lineup-swaps.mjs` and written to `data/lineup-opportunities.json`. Quality and Budget can produce structurally **auto-safe candidates**, but only when the swap preserves or increases the current distinct-family count and clears the configured improvement threshold. `applyAutomatically` remains false; Balanced, external overrides and multi-seat rotations are always review-only. The weekly watcher turns new candidates into decision-oriented alerts: it includes Quality, normalized task cost, Balanced score, family-count impact, the review reason and a suggested next action. Price changes flag models currently used in a lineup, and newly discovered models without `familyByModel` are explicitly marked ineligible until manually classified.

## Run locally

```bash
npm ci
npm run update
npm test
```

No login cookies, API keys or browser profile are required for the current public extraction path.

## License

MIT.

### Weekly refresh and Telegram review

The benchmark refresh runs once per week via `.github/workflows/weekly.yml` (Monday 06:17 UTC). A deterministic Gallivanter cron, `octopus-benchmark-weekly-review`, runs Monday at 10:00 Europe/Lisbon and compares the newly published snapshot with the last reviewed snapshot. It sends Telegram only when models, prices, effective task costs, lineup assignments, or new swap opportunities changed. No-change runs return `NO_REPLY` and are not delivered.
