# CAI estimation — reverse validation

Snapshot: **2026-08-25**
Observed Coding Agent families: **22**

## Selected estimator

`CAI* estimate = 50% Ridge + 50% inverse-distance 5-nearest-neighbours`.

- Ridge: λ=1; SciCode, GPQA, HLE, LCR, GDPval, Omniscience Accuracy, Omniscience Reliability, log(Output Tokens/Task).
- 5NN: SciCode, GPQA, HLE, LCR; standardized features; Euclidean distance; inverse-distance weighting.
- Production coding-role blend: `2/3 universal role score + 1/3 CAI*`.

## Leave-one-vendor-out

An entire vendor/family group is removed from training before predicting it. This is deliberately harder than normal random cross-validation.

| Method | MAE | RMSE | Spearman | Pairwise accuracy |
|---|---:|---:|---:|---:|
| Ridge | 6.02 | 7.7 | 0.735 | 75.8% |
| 5NN | 5.31 | 7.98 | 0.762 | 78.8% |
| **50/50 ensemble** | **5.06** | **7.12** | **0.84** | **81%** |

## Random 30% holdout × 500

- MAE median: **4.91**; p90: **7.57**.
- Spearman median: **0.821**; p10: **0.607**.
- Pairwise ranking accuracy median: **85.7%**.

## Effect on final ranking

For each observed family, the real CAI is hidden using leave-one-vendor-out; the estimated CAI is then inserted into the production `2/3 + 1/3` quality formula.

| Role | Spearman | Pairwise accuracy | Top-5 recovered | Quality MAE |
|---|---:|---:|---:|---:|
| implementer | 0.996 | 98.7% | 100% | 1.69 |
| implementer-heavy | 0.999 | 99.6% | 100% | 1.69 |
| code-reviewer | 0.999 | 99.6% | 100% | 1.69 |

## Guardrails

The scheduled weekly pipeline fails closed if leave-one-vendor-out ensemble MAE rises above 8, estimator Spearman falls below 0.70, or any coding-role final-ranking Spearman falls below 0.95 / top-5 recovery below 80%.
