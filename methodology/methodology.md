# Methodology

## Objective

Produce one transparent **Ranking Value** for every scored CommandCode Max row and every Octopus role.

The ranking is not a claim that one model is universally best. It is a reproducible role-specific estimate of benchmark quality per effective cost of completing comparable work.

## Universe and identity

The daily universe is the current CommandCode **Max** table. Commercial variants remain distinct because price and policy can differ even when the underlying model family is the same.

Each CommandCode row maps to Artificial Analysis as `exact`, `exact_alias`, `commercial_variant`, or `unscored`. Stealth, anonymous or unresolved models receive no fabricated benchmark values.

## Universal Role Score

Each role has a weighted score built only from benchmark components with **100% coverage** of the scored model-family universe.

Current components:

- GDPval-AA v2;
- SciCode;
- Humanity's Last Exam;
- GPQA Diamond;
- AA-LCR;
- AA-Omniscience Index, normalized from native -100..100 to 0..100.

Weights are machine-readable in [`config/roles.json`](../config/roles.json). Missing values are never imputed inside the Universal Role Score and weights are never renormalized around missing data.

## CommandCode Cost per Task

Price per million tokens is not the primary denominator because different models can consume very different token volumes for the same benchmark task.

Artificial Analysis publishes measured Intelligence Index per-task usage. The pipeline derives:

- non-cached input tokens;
- cache-read tokens;
- cache-write tokens;
- output tokens, including reasoning when billed as output.

The same measured token mix is repriced using current effective CommandCode Max rates:

```text
CC task cost =
  non_cached_input_tokens × CC_input_price
+ cache_read_tokens       × CC_cache_read_price
+ cache_write_tokens      × CC_cache_write_price
+ output_tokens           × CC_output_price
```

Rates are converted from per-million-token prices. If CommandCode exposes no separate cache rate, normal input price is used rather than assuming cache usage is free.

The task-cost denominator must have **100% coverage** of the scored model-family universe.

## Ranking formula

For non-coding roles:

```text
Ranking Value = Universal Role Score / CommandCode Cost per Task
```

For `implementer`, `implementer-heavy` and `code-reviewer`:

```text
Coding Quality = 2/3 Universal Role Score + 1/3 CAI*
Ranking Value  = Coding Quality / CommandCode Cost per Task
```

The 1/3 CAI weight was reverse-validated against observed Coding Agent families. It materially adds agentic-coding information while leaving the final ranking robust to estimation error.

## CAI*: observed when available, estimated otherwise

Artificial Analysis Coding Agent coverage does not yet span the complete Max universe. To avoid discarding this signal, the project defines `CAI*`:

```text
CAI* = observed CAI, if available
CAI* = estimated CAI, otherwise
```

The estimator is:

```text
Estimated CAI = 50% Ridge + 50% inverse-distance 5NN
```

### Ridge

Ridge regression uses λ=1 and standardized features:

- SciCode;
- GPQA Diamond;
- Humanity's Last Exam;
- AA-LCR;
- GDPval-AA v2;
- AA-Omniscience Index, normalized from native -100..100 to 0..100;
- log(Output Tokens per Intelligence Index Task).

### 5-nearest-neighbours

5NN uses standardized:

- SciCode;
- GPQA Diamond;
- Humanity's Last Exam;
- AA-LCR.

Distance is Euclidean and neighbour weights are `1 / distance`.

Only unique model families with observed CAI are training examples. CommandCode price variants such as Fast, HighSpeed or Contributor never create duplicate training rows.

A simple previous-generation/lineage proxy was considered but rejected during experimentation because reverse validation was materially worse than the global+local ensemble.

## Reverse validation

The estimator is validated every daily run. See [`cai-estimation-validation.md`](cai-estimation-validation.md) for the current generated report.

The hardest check is **leave-one-vendor-out**: an entire vendor/family group is removed before prediction. The pipeline also runs 500 deterministic random 30% holdouts and measures the impact of estimated CAI on the final coding-role ranking.

Current fail-closed guardrails:

- leave-one-vendor-out ensemble MAE ≤ 8 CAI points;
- estimator Spearman ≥ 0.70;
- final coding-role ranking Spearman ≥ 0.95;
- final Top-5 recovery ≥ 80%.

If these fail, the weekly update does not publish a new snapshot.

## Role weights

### Architect
GDPval-AA v2 40% · AA-LCR 25% · GPQA Diamond 20% · Humanity's Last Exam 15%.

### Strategist
GDPval-AA v2 40% · AA-LCR 20% · AA-Omniscience Index 30% · GPQA Diamond 10%.

### Security Reviewer
SciCode 30% · GPQA Diamond 25% · Humanity's Last Exam 20% · AA-Omniscience Index 15% · AA-LCR 10%.

### Code Reviewer
SciCode 45% · GPQA Diamond 20% · AA-LCR 15% · AA-Omniscience Index 10% · Humanity's Last Exam 10%, then blended 2/3 with 1/3 CAI*.

### Implementer
SciCode 60% · GPQA Diamond 15% · AA-LCR 15% · Humanity's Last Exam 10%, then blended 2/3 with 1/3 CAI*.

### Implementer Heavy
SciCode 45% · GDPval-AA v2 25% · AA-LCR 20% · GPQA Diamond 10%, then blended 2/3 with 1/3 CAI*.

### Synthesizer
AA-LCR 45% · AA-Omniscience Index 40% · GDPval-AA v2 15%.

### Researcher
AA-LCR 30% · GDPval-AA v2 25% · AA-Omniscience Index 20% · GPQA Diamond 15% · Humanity's Last Exam 10%.

## Transparency

The public snapshot preserves, for every scored model row:

- source model-family identity;
- Universal Role Score;
- CommandCode Cost per Task;
- `CAI*` value and whether it was observed or estimated;
- Ridge and 5NN component estimates for estimated rows;
- final coding-adjusted quality;
- final Ranking Value.

The homepage intentionally displays only the final Ranking Value. The intermediate values remain public in JSON and in this methodology so the ranking can be audited without cluttering the main view.

Mapped AA families with a missing active benchmark are retained for audit as `source_incomplete` but excluded from the scored universe until complete source coverage returns. The 100% coverage rule applies to the scored universe. No benchmark value is imputed or carried forward except the explicitly documented, validated SciCode fallback below.

When AA temporarily omits SciCode for a mapped model, Octopus may estimate SciCode from the model's other independent AA benchmarks (GPQA, HLE, LCR, GDPval and normalized AA-Omniscience) using a leave-one-out validated Ridge model. Intelligence Index is deliberately excluded to avoid circularity. The estimate is conservatively bounded by a recent last-known target score and any explicitly configured same-series/sibling analogue; provenance and validation error are published in the snapshot. If the estimator guardrails fail or required features are missing, the model becomes `source_incomplete` instead of receiving a score.
