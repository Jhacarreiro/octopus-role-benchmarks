# CAI estimation — reverse validation

Snapshot: **2026-10-26**
Observed Coding Agent families: **18**

## Selected estimator

`CAI* estimate = 50% Ridge + 50% inverse-distance 5-nearest-neighbours`.

- Ridge: λ=1; SciCode, GPQA, HLE, LCR, GDPval, AA-Omniscience Index (normalized to 0–100), log(Output Tokens/Task).
- 5NN: SciCode, GPQA, HLE, LCR; standardized features; Euclidean distance; inverse-distance weighting.
- Production coding-role blend: `2/3 universal role score + 1/3 CAI*`.

## Leave-one-vendor-out

An entire vendor/family group is removed from training before predicting it. This is deliberately harder than normal random cross-validation.

| Method | MAE | RMSE | Spearman | Pairwise accuracy |
|---|---:|---:|---:|---:|
| Ridge | 4.97 | 6.16 | 0.723 | 79.7% |
| 5NN | 6.59 | 7.91 | 0.697 | 73.2% |
| **50/50 ensemble** | **5.84** | **7.1** | **0.787** | **81%** |

## Random 27.8% holdout × 500

- MAE median: **5.44**; p90: **7.91**.
- Spearman median: **0.8**; p10: **0.3**.
- Pairwise ranking accuracy median: **80%**.

## Effect on final ranking

For each observed family, the real CAI is hidden using leave-one-vendor-out; the estimated CAI is then inserted into the production `2/3 + 1/3` quality formula.

| Role | Spearman | Pairwise accuracy | Top-5 recovered | Quality MAE |
|---|---:|---:|---:|---:|
| implementer | 0.996 | 98.7% | 80% | 1.95 |
| implementer-heavy | 0.998 | 99.4% | 80% | 1.95 |
| code-reviewer | 0.998 | 99.4% | 100% | 1.95 |

## Guardrails

The daily pipeline fails closed if leave-one-vendor-out ensemble MAE rises above 8, estimator Spearman falls below 0.70, or any coding-role final-ranking Spearman falls below 0.95 / top-5 recovery below 80%.
