# Methodology

## Objective

Compare **role-relevant benchmark quality against effective CommandCode Max cost**. This project does not publish a universal "best model".

## Universe

The daily model universe is the current CommandCode **Max** table. Commercial rows remain distinct because price and policy can differ even when the underlying model is identical.

A CommandCode row is mapped to Artificial Analysis as one of:

- `exact` — canonical identity matches;
- `exact_alias` — identity is verified but display names differ;
- `commercial_variant` — same benchmarked model, different CommandCode commercial row;
- `unscored` — stealth, anonymous, experimental or otherwise not safely identifiable.

No benchmark is invented for `unscored` rows.

## Coverage rule

Every component active in a role score must cover **100% of the scored underlying AA model-family universe** in that daily snapshot.

There is no imputation, zero filling or renormalization around missing data. If a component loses full coverage, the daily run fails and the last known-good snapshot remains public.

As of the initial 2026-08-24 snapshot, all active components cover 51/51 scored model families. Terminal-Bench v2.1, τ³-Banking and Agentic Index are deliberately excluded because they do not meet that rule.

## Cost

Effective current CommandCode prices are used, including active promotions. List prices are retained for transparency but do not drive `Score/$` while a discount is active.

The UI exposes three neutral cost bases:

- input price per 1M tokens;
- output price per 1M tokens;
- 50/50 input-output blend: `(input + output) / 2`.

No workload-specific token mix is invented.

## Role scores

Every active benchmark is normalized to a 0–100 scale. A role score is the weighted mean defined in [`config/roles.json`](../config/roles.json).

### Architect

- GDPval-AA v2: 40%
- AA-LCR: 25%
- GPQA Diamond: 20%
- Humanity's Last Exam: 15%

Architecture is treated primarily as professional deliverable judgment plus long-context and hard reasoning.

### Strategist

- GDPval-AA v2: 40%
- AA-LCR: 20%
- AA-Omniscience Accuracy: 20%
- AA-Omniscience Non-Hallucination: 10%
- GPQA Diamond: 10%

The role emphasizes professional judgment, factuality/calibration and synthesis under ambiguity.

### Security Reviewer

- SciCode: 30%
- GPQA Diamond: 25%
- Humanity's Last Exam: 20%
- AA-Omniscience Non-Hallucination: 15%
- AA-LCR: 10%

This is explicitly a proxy methodology: no dedicated security benchmark currently satisfies the 100% coverage rule, so the score uses coding, difficult reasoning, context and reliability only.

### Code Reviewer

- SciCode: 45%
- GPQA Diamond: 20%
- AA-LCR: 15%
- AA-Omniscience Non-Hallucination: 10%
- Humanity's Last Exam: 10%

### Implementer

- SciCode: 60%
- GPQA Diamond: 15%
- AA-LCR: 15%
- Humanity's Last Exam: 10%

Terminal-Bench would be highly relevant, but is excluded until it has complete coverage of the scored Max universe.

### Implementer Heavy

- SciCode: 45%
- GDPval-AA v2: 25%
- AA-LCR: 20%
- GPQA Diamond: 10%

Large implementation work adds professional-deliverable and long-context weight beyond normal coding.

### Synthesizer

- AA-LCR: 45%
- AA-Omniscience Accuracy: 20%
- AA-Omniscience Non-Hallucination: 20%
- GDPval-AA v2: 15%

### Researcher

- AA-LCR: 30%
- GDPval-AA v2: 25%
- AA-Omniscience Accuracy: 20%
- GPQA Diamond: 15%
- Humanity's Last Exam: 10%

## Value metric

`Score/$ = role score / selected effective cost basis`

This is a comparison ratio, not a claim that the highest ratio is the universally best model. Policy constraints, latency, context window, tool compatibility, data-sharing terms and workload shape remain separate considerations.

## Reproducibility

OpenCLI adapters extract both public sources. A scheduled GitHub Action runs daily, validates full coverage, writes an immutable dated snapshot and updates `data/latest.json` only if all checks pass.
