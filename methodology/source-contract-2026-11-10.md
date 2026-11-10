# Intelligence source revision and catalogue coverage — 2026-11-10

## Failure and revised evidence contract

The November 9 refresh retained 98 offers but failed portfolio generation. All 77 fetched model records omitted `intelligenceIndexIsEstimated`, including 38 numeric Intelligence values. The old strict-false gate rejected every value, leaving no Intelligence-qualified portfolio candidates. The publication wrapper also discarded the child diagnostic.

Current official [Intelligence Index](https://artificialanalysis.ai/evaluations/artificial-analysis-intelligence-index) and [version history](https://artificialanalysis.ai/methodology/intelligence-benchmarking#version-history) identify **v5.0.1**: CritPt-author grading robustness improvements and regrading on CritPt v2. Two component names cannot distinguish this revision from v5.0. No index is reconstructed or statistically estimated.

For every mapped model, independently of whether it appears in the leaderboard's default visible subset, the collector reads its exact slug/UUID/effort object and the explicit index title on its model page. Missing source flags stay null. A numeric index is accepted through either the legacy explicit observed flag or a separate `versioned-source-complete-suite` contract requiring an explicit supported page revision and exactly nine unique finite component results: AA-Briefcase, AutomationBench-AA, GDP.pdf, FrontierCode2.0, TerminalBench4.0, Terminal-Bench-Science, CritPt v2 Hard, Omniscience and HLE-Diamond. Zero is a valid result.

Explicit source estimates, incomplete or duplicate components, unsupported revisions and conflicting source objects remain unavailable. Mixed supported Intelligence revisions abort a snapshot. Published provenance retains the original value, revision, nullable flag and evaluation evidence; validation reconstructs eligibility from that evidence. v5.0 fixtures remain readable without relabeling historical data. Role weights and the observed-only Intelligence policy are unchanged.

## Whole-catalogue accounting

`data/catalogue-assessment.json` and its same-origin site mirror account for **every raw commercial offer**, including a paid offer superseded by an identical free option. Each retained offer has eight observed/estimated/unavailable role entries. Complete measured profiles, complete profiles with analogies, partial evidence, unavailable evidence and non-comparable models have separate counts. Historical-generation exclusion affects ranking admission, not assessment. Historical targets now receive the same conservative profile completion when sufficient measured features exist, using current fully measured anchors. They remain excluded from active percentiles and portfolios, their estimated profiles cannot become anchors, and no missing Intelligence is invented.

All available measurements remain measured; estimates never replace raw missing values. Complete eight-role assessments can include conservative cross-role analogies under the existing v10 policy. They are not eight independent observed benchmarks. Jev decision models remain explicitly non-comparable.

Reviewed coverage on November 10:

- Qwen3.7 Flash: re-read [Epoch](https://epoch.ai/models/qwen3-7-flash); renewed existing narrow reasoning analogy, with no imported AA score.
- Glyph Cluster: re-read [named task artifacts](https://stealthmodels.com/benchmarks/models/glyph-cluster); renewed existing weak implementation analogy. Anonymous backend identity remains unverified.
- Fugu Ultra: re-read [original report v1](https://arxiv.org/html/2606.21228v1); renewed launch-version analogy, preserving uncertainty about the current unversioned route. Later revisions are not substituted. This reviewed launch comparison may use the historical Fable5 observation as evidence: the anchor itself remains excluded from current rankings, and its unavailable Intelligence cannot be estimated or imported from another revision.
- DeepSeek V4.1 Flash Ultrafast: [exact catalogue route](https://commandcode.ai/models/deepseek-v4-1-flash-ultrafast) describes an accelerated V4.1 Flash. A serving-variant analogy uses the observed October17 reference with a ten-point haircut; date/effort equivalence is not asserted.
- Crouton Alpha: [nine named-route artifacts](https://stealthmodels.com/benchmarks/models/crouton-alpha) support a weak implementation analogy against lower-scoring measured-profile references, with a thirty-point haircut. The page's later “Muse Ember (early version)” label is not used to infer a current AA/backend identity. The [independent hands-on report](https://www.mindstudio.ai/blog/crouton-alpha-stealth-model-test) is anecdotal corroboration only.

- Qwen3.6 Max Preview: the [CommandCode page](https://commandcode.ai/models/qwen3-6-max-preview) links directly to [AA qwen3-6-max](https://artificialanalysis.ai/models/qwen3-6-max). UUID `6000692c-f9a6-47f8-a5c0-e0874ac488bb` and exact source name confirm this historical identity. The deprecated source still publishes HLE/LCR; profile completion can use those observations, while the absent current Intelligence stays absent.

These reviewed recipes expire November17; no automatic evidence renewal is introduced. Cross-role profile completion, including estimated security, remains explicit and heuristic. Portfolio constraints, estimated-seat limits and live runtime routing are unchanged. The public execution map adds the verified CommandCode `claude-opus-5-5` identity so a newly selected Balanced model cannot block publication.

## Operational safeguards

All publication artifacts are generated in isolated staging and promoted only after portfolio construction succeeds. Failures now include bounded child stderr, exit status and signal. Error-status snapshot reads accommodate the full committed JSON instead of falling through the default subprocess buffer limit. The source manifest now includes the actual AA parser, identity aliases and extraction dependencies.

Behavior tests cover the retired flag, explicit revision, complete/missing/duplicate/zero components, explicit estimates, unsupported and mixed revisions, corrupted stored provenance, complete offer accounting and preservation of every publication artifact on failure. A fresh complete-source refresh and the full validation suite are required before production publication.
