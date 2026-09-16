# CAI estimation — reverse validation

Snapshot: **2026-09-16**
Observed Coding Agent families: **12**

## Selected estimator

`CAI* estimate = 50% Ridge + 50% inverse-distance 5-nearest-neighbours`.

- Ridge: λ=1; SciCode, GPQA, HLE, LCR, GDPval, AA-Omniscience Index (normalized to 0–100), log(Output Tokens/Task).
- 5NN: SciCode, GPQA, HLE, LCR; standardized features; Euclidean distance; inverse-distance weighting.
- Production coding-role blend: `2/3 universal role score + 1/3 CAI*`.

## Leave-one-vendor-out

An entire vendor/family group is removed from training before predicting it. This is deliberately harder than normal random cross-validation.

| Method | MAE | RMSE | Spearman | Pairwise accuracy |
|---|---:|---:|---:|---:|
| Ridge | 3.43 | 4.43 | 0.86 | 84.9% |
| 5NN | 6.09 | 7.49 | 0.189 | 59.1% |
| **50/50 ensemble** | **4.43** | **5.42** | **0.804** | **81.8%** |

## Random 33.3% holdout × 500

- MAE median: **4.79**; p90: **6.66**.
- Spearman median: **0.8**; p10: **0.4**.
- Pairwise ranking accuracy median: **83.3%**.

## Effect on final ranking

For each observed family, the real CAI is hidden using leave-one-vendor-out; the estimated CAI is then inserted into the production `2/3 + 1/3` quality formula.

| Role | Spearman | Pairwise accuracy | Top-5 recovered | Quality MAE |
|---|---:|---:|---:|---:|
| implementer | 0.965 | 93.9% | 80% | 1.48 |
| implementer-heavy | 0.986 | 97% | 80% | 1.48 |
| code-reviewer | 0.958 | 92.4% | 80% | 1.48 |

## Guardrails

The daily pipeline fails closed if leave-one-vendor-out ensemble MAE rises above 8, estimator Spearman falls below 0.70, or any coding-role final-ranking Spearman falls below 0.95 / top-5 recovery below 80%.
