# CAI estimation — reverse validation

Snapshot: **2026-10-16**
Observed Coding Agent families: **16**

## Selected estimator

`CAI* estimate = 50% Ridge + 50% inverse-distance 5-nearest-neighbours`.

- Ridge: λ=1; SciCode, GPQA, HLE, LCR, GDPval, AA-Omniscience Index (normalized to 0–100), log(Output Tokens/Task).
- 5NN: SciCode, GPQA, HLE, LCR; standardized features; Euclidean distance; inverse-distance weighting.
- Production coding-role blend: `2/3 universal role score + 1/3 CAI*`.

## Leave-one-vendor-out

An entire vendor/family group is removed from training before predicting it. This is deliberately harder than normal random cross-validation.

| Method | MAE | RMSE | Spearman | Pairwise accuracy |
|---|---:|---:|---:|---:|
| Ridge | 3.9 | 4.89 | 0.9 | 87.5% |
| 5NN | 4.61 | 5.93 | 0.841 | 80.8% |
| **50/50 ensemble** | **4.12** | **5.35** | **0.885** | **85%** |

## Random 31.3% holdout × 500

- MAE median: **4.44**; p90: **6.72**.
- Spearman median: **0.9**; p10: **0.5**.
- Pairwise ranking accuracy median: **90%**.

## Effect on final ranking

For each observed family, the real CAI is hidden using leave-one-vendor-out; the estimated CAI is then inserted into the production `2/3 + 1/3` quality formula.

| Role | Spearman | Pairwise accuracy | Top-5 recovered | Quality MAE |
|---|---:|---:|---:|---:|
| implementer | 1 | 100% | 100% | 1.37 |
| implementer-heavy | 1 | 100% | 100% | 1.37 |
| code-reviewer | 1 | 100% | 100% | 1.37 |

## Guardrails

The daily pipeline fails closed if leave-one-vendor-out ensemble MAE rises above 8, estimator Spearman falls below 0.70, or any coding-role final-ranking Spearman falls below 0.95 / top-5 recovery below 80%.
