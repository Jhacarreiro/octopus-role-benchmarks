# CAI estimation — reverse validation

Snapshot: **2026-10-16**
Observed Coding Agent families: **24**

## Selected estimator

`CAI* estimate = 50% Ridge + 50% inverse-distance 5-nearest-neighbours`.

- Ridge: λ=1; SciCode, GPQA, HLE, LCR, GDPval, AA-Omniscience Index (normalized to 0–100), log(Output Tokens/Task).
- 5NN: SciCode, GPQA, HLE, LCR; standardized features; Euclidean distance; inverse-distance weighting.
- Production coding-role blend: `2/3 universal role score + 1/3 CAI*`.

## Leave-one-vendor-out

An entire vendor/family group is removed from training before predicting it. This is deliberately harder than normal random cross-validation.

| Method | MAE | RMSE | Spearman | Pairwise accuracy |
|---|---:|---:|---:|---:|
| Ridge | 4.16 | 5.11 | 0.889 | 85.5% |
| 5NN | 4.3 | 5.58 | 0.822 | 81.2% |
| **50/50 ensemble** | **3.91** | **5.18** | **0.857** | **84.1%** |

## Random 29.2% holdout × 500

- MAE median: **4.13**; p90: **6.08**.
- Spearman median: **0.857**; p10: **0.679**.
- Pairwise ranking accuracy median: **85.7%**.

## Effect on final ranking

For each observed family, the real CAI is hidden using leave-one-vendor-out; the estimated CAI is then inserted into the production `2/3 + 1/3` quality formula.

| Role | Spearman | Pairwise accuracy | Top-5 recovered | Quality MAE |
|---|---:|---:|---:|---:|
| implementer | 0.998 | 99.3% | 100% | 1.3 |
| implementer-heavy | 0.998 | 99.3% | 100% | 1.3 |
| code-reviewer | 0.998 | 99.3% | 100% | 1.3 |

## Guardrails

The daily pipeline fails closed if leave-one-vendor-out ensemble MAE rises above 8, estimator Spearman falls below 0.70, or any coding-role final-ranking Spearman falls below 0.95 / top-5 recovery below 80%.
