# CAI estimation — reverse validation

Snapshot: **2026-10-28**
Observed Coding Agent families: **13**

## Selected estimator

`CAI* estimate = 50% Ridge + 50% inverse-distance 5-nearest-neighbours`.

- Ridge: λ=1; SciCode, GPQA, HLE, LCR, GDPval, AA-Omniscience Index (normalized to 0–100), log(Output Tokens/Task).
- 5NN: SciCode, GPQA, HLE, LCR; standardized features; Euclidean distance; inverse-distance weighting.
- Production coding-role blend: `2/3 universal role score + 1/3 CAI*`.

## Leave-one-vendor-out

An entire vendor/family group is removed from training before predicting it. This is deliberately harder than normal random cross-validation.

| Method | MAE | RMSE | Spearman | Pairwise accuracy |
|---|---:|---:|---:|---:|
| Ridge | 5.97 | 7.26 | 0.604 | 74.4% |
| 5NN | 5.67 | 7.19 | 0.736 | 74.4% |
| **50/50 ensemble** | **5.43** | **6.97** | **0.797** | **79.5%** |

## Random 30.8% holdout × 500

- MAE median: **5.77**; p90: **9.15**.
- Spearman median: **0.8**; p10: **0.4**.
- Pairwise ranking accuracy median: **83.3%**.

## Effect on final ranking

For each observed family, the real CAI is hidden using leave-one-vendor-out; the estimated CAI is then inserted into the production `2/3 + 1/3` quality formula.

| Role | Spearman | Pairwise accuracy | Top-5 recovered | Quality MAE |
|---|---:|---:|---:|---:|
| implementer | 1 | 100% | 100% | 1.81 |
| implementer-heavy | 1 | 100% | 100% | 1.81 |
| code-reviewer | 1 | 100% | 100% | 1.81 |

## Guardrails

The daily pipeline fails closed if leave-one-vendor-out ensemble MAE rises above 8, estimator Spearman falls below 0.70, or any coding-role final-ranking Spearman falls below 0.95 / top-5 recovery below 80%.
