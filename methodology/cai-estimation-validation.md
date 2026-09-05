# CAI estimation — reverse validation

Snapshot: **2026-09-05**
Observed Coding Agent families: **23**

## Selected estimator

`CAI* estimate = 50% Ridge + 50% inverse-distance 5-nearest-neighbours`.

- Ridge: λ=1; SciCode, GPQA, HLE, LCR, GDPval, AA-Omniscience Index (normalized to 0–100), log(Output Tokens/Task).
- 5NN: SciCode, GPQA, HLE, LCR; standardized features; Euclidean distance; inverse-distance weighting.
- Production coding-role blend: `2/3 universal role score + 1/3 CAI*`.

## Leave-one-vendor-out

An entire vendor/family group is removed from training before predicting it. This is deliberately harder than normal random cross-validation.

| Method | MAE | RMSE | Spearman | Pairwise accuracy |
|---|---:|---:|---:|---:|
| Ridge | 5.72 | 7.71 | 0.796 | 79.8% |
| 5NN | 6 | 8.38 | 0.692 | 74.7% |
| **50/50 ensemble** | **5.28** | **7.38** | **0.787** | **79.8%** |

## Random 30% holdout × 500

- MAE median: **5.22**; p90: **7.81**.
- Spearman median: **0.857**; p10: **0.639**.
- Pairwise ranking accuracy median: **85.7%**.

## Effect on final ranking

For each observed family, the real CAI is hidden using leave-one-vendor-out; the estimated CAI is then inserted into the production `2/3 + 1/3` quality formula.

| Role | Spearman | Pairwise accuracy | Top-5 recovered | Quality MAE |
|---|---:|---:|---:|---:|
| implementer | 0.998 | 99.2% | 100% | 1.76 |
| implementer-heavy | 0.998 | 99.2% | 100% | 1.76 |
| code-reviewer | 0.998 | 99.2% | 100% | 1.76 |

## Guardrails

The daily pipeline fails closed if leave-one-vendor-out ensemble MAE rises above 8, estimator Spearman falls below 0.70, or any coding-role final-ranking Spearman falls below 0.95 / top-5 recovery below 80%.
