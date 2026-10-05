# CAI estimation — reverse validation

Snapshot: **2026-10-05**
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
| Ridge | 3.54 | 4.69 | 0.791 | 82.5% |
| 5NN | 4.94 | 6 | 0.718 | 75% |
| **50/50 ensemble** | **4.55** | **5.51** | **0.762** | **79.2%** |

## Random 31.3% holdout × 500

- MAE median: **4.01**; p90: **5.6**.
- Spearman median: **0.9**; p10: **0.7**.
- Pairwise ranking accuracy median: **90%**.

## Effect on final ranking

For each observed family, the real CAI is hidden using leave-one-vendor-out; the estimated CAI is then inserted into the production `2/3 + 1/3` quality formula.

| Role | Spearman | Pairwise accuracy | Top-5 recovered | Quality MAE |
|---|---:|---:|---:|---:|
| implementer | 0.994 | 98.3% | 100% | 1.52 |
| implementer-heavy | 0.994 | 98.3% | 100% | 1.52 |
| code-reviewer | 0.985 | 96.7% | 100% | 1.52 |

## Guardrails

The daily pipeline fails closed if leave-one-vendor-out ensemble MAE rises above 8, estimator Spearman falls below 0.70, or any coding-role final-ranking Spearman falls below 0.95 / top-5 recovery below 80%.
