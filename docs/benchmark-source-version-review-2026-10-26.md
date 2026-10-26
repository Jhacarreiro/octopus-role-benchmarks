# Benchmark source version review — 2026-10-26

## Scope and evidence

Review of source version metadata and extraction contract following the failed weekly refresh. This is a **compatibility assessment, not approval to change scoring definitions**.

- `config/roles.json` declares `gdpval` source field `gdpvalNormalized`, labelled **GDPval-AA v2 (normalized)** with a 0–100 output scale.
- `opencli/clis/artificial-analysis/models.js` extracts the exact `gdpvalNormalized` field and `terminalbenchV21`, not an arbitrary latest-version alias.
- `scripts/update.mjs` has a secondary source for **observed GDPval v2.1** when the model-page field is missing. It records its provenance as `observed_same_benchmark_secondary`; estimated same-family and cross-variant GDPval fallbacks are separately identified.
- The current AA model-page HTML inspected during this incident does not expose the literal `gdpvalNormalized` or `terminalbenchV21` tokens; AA page copy refers to GDPval-AA v2.1 and Terminal-Bench 4.0. **Absence of a literal token alone does not prove metric deletion or version equivalence.**
- Terminal-Bench is not an active weighted metric in `config/roles.json`; upgrading its parser must not implicitly alter role scores.

## Compatibility decisions

1. **Do not silently substitute** GDPval-AA v2.1 for v2 or Terminal-Bench 4.0 for v2.1. Validate metric definitions, normalisation, sample overlap, score distribution and provenance before any scoring-version migration.
2. Preserve the exact declared `sourceField` for current methodology; a missing field must be reported as missing rather than inferred from a similarly named current metric.
3. Keep secondary GDPval observed values and proxy estimates distinguishable in output provenance. They must not be presented as direct model-page observations.
4. During failed refreshes, log field-missing and CAI eligibility counts before calibration; do not lower the eight-family estimator threshold.

## Pending decision / required evidence

Retrieve versioned primary-source methodology for GDPval-AA v2 and v2.1, including scoring/normalisation and paired-model samples. Compare overlap and distribution before deciding whether this constitutes the same scoring series. Likewise compare Terminal-Bench v2.1 versus 4.0 only if Terminal-Bench is later made an active score. Metric-version substitution without provenance remains not approved; the explicitly labelled historical-fallback continuity policy below is authorized.

## Migration decision — 2026-10-26

Operator approved a pragmatic migration: prefer verified GDPval-AA v2.1 observations and use the previous snapshot's last genuine GDPval observation for models missing current v2.1 data. Historical legacy-v2 values are explicitly marked `historical_fallback`, include original observation date, and carry `versionComparable:false`; they are not represented as v2.1 observations. The scale remains 0–100. Proxy estimates remain separate and visibly estimated.

**Caveat:** this is a continuity policy, not proof that v2 and v2.1 are methodologically equivalent. Scores combining both vintages should be labelled as provisional until overlap calibration is validated. The current secondary GDPval v2.1 adapter only admits explicitly verified model/configuration pairs; it must not guess a model identity to increase coverage.
