# CAI estimation — reverse validation

Snapshot: **2026-09-04**
Observed Coding Agent families: **23**

## Selected estimator

`CAI* estimate = 50% Ridge + 50% inverse-distance 5-nearest-neighbours`.

- Ridge: λ=1; SciCode, GPQA, HLE, LCR, GDPval, Omniscience Accuracy, Omniscience Reliability, log(Output Tokens/Task).
- 5NN: SciCode, GPQA, HLE, LCR; standardized features; Euclidean distance; inverse-distance weighting.
- Production coding-role blend: `2/3 universal role score + 1/3 CAI*`.

## Leave-one-vendor-out

An entire vendor/family group is removed from training before predicting it. This is deliberately harder than normal random cross-validation.

| Method | MAE | RMSE | Spearman | Pairwise accuracy |
|---|---:|---:|---:|---:|
| Ridge | 6.1 | 7.72 | 0.749 | 76.3% |
| 5NN | 5.55 | 8.08 | 0.769 | 78.7% |
| **50/50 ensemble** | **5.2** | **7.24** | **0.849** | **81.8%** |

## Random 30% holdout × 500

- MAE median: **4.9**; p90: **7.36**.
- Spearman median: **0.857**; p10: **0.679**.
- Pairwise ranking accuracy median: **85.7%**.

## Effect on final ranking

For each observed family, the real CAI is hidden using leave-one-vendor-out; the estimated CAI is then inserted into the production `2/3 + 1/3` quality formula.

| Role | Spearman | Pairwise accuracy | Top-5 recovered | Quality MAE |
|---|---:|---:|---:|---:|
| implementer | 0.995 | 98.8% | 100% | 1.73 |
| implementer-heavy | 0.993 | 98.4% | 100% | 1.73 |
| code-reviewer | 0.996 | 98.8% | 100% | 1.73 |

## Guardrails

The daily pipeline fails closed if leave-one-vendor-out ensemble MAE rises above 8, estimator Spearman falls below 0.70, or any coding-role final-ranking Spearman falls below 0.95 / top-5 recovery below 80%.
