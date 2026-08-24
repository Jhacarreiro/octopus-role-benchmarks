# Methodology

## Objective

Compare **role-relevant benchmark quality against the effective cost of completing benchmark work**. The project does not publish a universal "best model".

## Universe and identity

The daily universe is the current CommandCode **Max** table. Commercial rows remain distinct because price and policy can differ even when the underlying model is identical.

Each CommandCode row maps to Artificial Analysis as `exact`, `exact_alias`, `commercial_variant`, or `unscored`. Stealth, anonymous or unresolved models receive no proxy benchmark.

## Role-score coverage rule

Every component inside a role score must cover **100% of the scored underlying AA model-family universe** for that snapshot. There is no imputation, zero filling or weight renormalization around missing data.

Active universal components are GDPval-AA v2, SciCode, Humanity's Last Exam, GPQA Diamond, AA-LCR, AA-Omniscience Accuracy and AA-Omniscience Non-Hallucination. Terminal-Bench v2.1 and Agentic Index are not inserted into universal role weights while coverage is incomplete.

## Primary cost metric: CommandCode Cost per Task

Price per million tokens is not the primary denominator because models can consume very different token volumes for the same benchmark task.

Artificial Analysis publishes measured Intelligence Index per-task usage. The pipeline derives:

- non-cached input tokens;
- cache-read tokens;
- cache-write tokens;
- output tokens, including reasoning where billed as output.

Those volumes are repriced using current effective CommandCode Max prices:

```text
CC task cost =
  non_cached_input_tokens × CC_input_price
+ cache_read_tokens       × CC_cache_read_price
+ cache_write_tokens      × CC_cache_write_price
+ output_tokens           × CC_output_price
```

Rates are per million tokens. If CommandCode exposes no separate cache-read or cache-write rate, normal input price is used rather than assuming caching is free.

The task-cost denominator has the same **100% coverage requirement** as the role score.

```text
Role value = Role score / CommandCode Cost per Task
```

Input/output/50-50 price-per-million ratios remain available only as diagnostic views.

## Role weights

All active components are represented on a 0–100 scale. Machine-readable weights live in [`config/roles.json`](../config/roles.json).

### Architect
GDPval-AA v2 40% · AA-LCR 25% · GPQA Diamond 20% · Humanity's Last Exam 15%.

### Strategist
GDPval-AA v2 40% · AA-LCR 20% · AA-Omniscience Accuracy 20% · AA-Omniscience Non-Hallucination 10% · GPQA Diamond 10%.

### Security Reviewer
SciCode 30% · GPQA Diamond 25% · Humanity's Last Exam 20% · AA-Omniscience Non-Hallucination 15% · AA-LCR 10%.

This remains an explicit proxy methodology because no dedicated security benchmark currently satisfies the project's universal coverage rule.

### Code Reviewer
SciCode 45% · GPQA Diamond 20% · AA-LCR 15% · AA-Omniscience Non-Hallucination 10% · Humanity's Last Exam 10%.

### Implementer
SciCode 60% · GPQA Diamond 15% · AA-LCR 15% · Humanity's Last Exam 10%.

### Implementer Heavy
SciCode 45% · GDPval-AA v2 25% · AA-LCR 20% · GPQA Diamond 10%.

### Synthesizer
AA-LCR 45% · AA-Omniscience Accuracy 20% · AA-Omniscience Non-Hallucination 20% · GDPval-AA v2 15%.

### Researcher
AA-LCR 30% · GDPval-AA v2 25% · AA-Omniscience Accuracy 20% · GPQA Diamond 15% · Humanity's Last Exam 10%.

## Coding Agent evidence

For `implementer`, `implementer-heavy` and `code-reviewer`, the site additionally displays the Artificial Analysis Coding Agent Index when a safe model mapping exists.

The current Coding Agent Index v1.4 combines:

- DeepSWE — long-horizon software engineering;
- Terminal-Bench v2.1 — agentic terminal execution;
- SWE-Atlas-QnA — repository question answering.

The site also displays AA's pooled API cost/task, tokens/task, execution time and selected agent/harness variant.

### Why it is not inside the role score

Coding Agent coverage is lower than the project's 100% threshold for the full scored Max universe. Mixing it into the role score would violate the comparability rule. It therefore appears as **partial evidence**, clearly separated from the universal role score and CC Cost/Task ratio.

### Variant selection

When multiple Coding Agent rows map to the same underlying model, the deterministic order is:

1. AA `highlighted` variant;
2. AA `default` variant;
3. highest published Coding Agent Index score.

The selected agent/harness label is always shown.

### Why Coding Agent cost is not repriced to CommandCode

AA's public coding telemetry exposes input/cache/output aggregates, but those fields cannot currently be recombined with sufficient confidence to reproduce published coding `costUsd` across providers without risking double counting. Until that is possible, coding-specific cost shown is AA's own published pay-per-token API cost/task. It is labelled as such and is not the primary value denominator.

## Reproducibility

OpenCLI adapters extract all public source data. A scheduled GitHub Action runs daily, validates coverage, writes an immutable dated snapshot and updates `data/latest.json` only after all required checks pass.
