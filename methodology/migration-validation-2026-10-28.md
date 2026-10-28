# Selective v10 implementation validation

Frozen baseline: `24b7d71fd27df2fe1428207bc153bab35b5f7aa6`, `data/2026-10-28.json`. Public source captures: 2026-10-28. No merge, activation, production refresh, routing change or website publication. The statistical Intelligence estimator remains disabled. User-authorized role analogies are enabled only in the isolated v10 candidate, including conservative portfolio eligibility.

## Active coverage

The catalog contains 99 raw offers and 97 after free-offer preference. The two-generation window marks 29 offers historical, leaving 68 active. Of these, 55 offers (47 verified AA identities) have at least one complete measured role; five further public models have explicitly labeled role analogies. Thus 60/68 active offers have some role coverage, not complete coverage of all eight roles. Observed coverage denominators contain 49 active matched AA identities. Historical observations remain available in the candidate snapshot, outside active rankings and denominators.

| Role | Complete measured identities | Measured offers | Also observed Intelligence v5 | Estimated offers |
| --- | ---: | ---: | ---: | ---: |
| architect | 47/49 | 55 | 28 | 1 |
| strategist | 31/49 | 35 | 28 | 1 |
| security-reviewer | 19/49 | 23 | 14 | 0 |
| code-reviewer | 31/49 | 35 | 28 | 2 |
| implementer | 47/49 | 55 | 28 | 5 |
| implementer-heavy | 47/49 | 55 | 28 | 5 |
| synthesizer | 31/49 | 35 | 28 | 1 |
| researcher | 31/49 | 35 | 28 | 1 |

Only 28 active measured identities have observed v5 Intelligence; security has 14. Coverage does not imply portfolio eligibility. Missing factuality still limits four roles. Two matched models, Step 3.7 Flash and Claude Haiku 4.5, have no complete current role. The remaining unmatched active offers are two public models awaiting evidence (Qwen 3.7 Flash, Fugu Ultra), two Decision offers (Jev/Jev 1.14.0) and two unidentified stealth offers (Glyph Cluster, Beam 1.0).

## Conservative approximations

| Public model | Supported roles | Observed anchors | Policy haircut | Conservative Intelligence |
| --- | --- | --- | ---: | ---: |
| Laguna S 2.1 | implementer, implementer-heavy | inkling | 20 points | 0.000 |
| Tencent Hy4 Preview | implementer, implementer-heavy | glm-5-3 | 20 points | 11.653 |
| Ornith 1.5 122B | implementer, implementer-heavy, code-reviewer | qwen3-8-27b, nemotron-3-5-super-vl | 20 points | 0.000 |
| Qwen 3.8 Omni Flash | implementer, implementer-heavy | qwen3-8-flash-next | 15 points | unavailable |
| Qwen 3.8 Max Prime | architect, strategist, code-reviewer, implementer, implementer-heavy, synthesizer, researcher | qwen3-8-max | 5 points | 28.555 |

No target AA identity or raw benchmark is fabricated. These are role analogies with heuristic policy ranges, not measured benchmark results, calibrated error bounds or confidence intervals. Serving variants, related architecture and external vendor comparisons receive progressively wider haircuts. No security estimate is allowed. Only complete observed anchors are used; unavailable/historical anchors and evidence expiry fail closed. Recipes expire after 2026-11-27 unless reviewed.

Portfolio selection uses the lower policy role and Intelligence values, with at most one estimated seat. Unknown anchor Intelligence stays unavailable. Coding independence includes shared anchor evidence, and the Heavy advantage must survive an estimated Implementer's upper policy value. Proxies do not define observed percentile populations, Intelligence baselines or statistical price cutoffs. The existing base policy, including family diversity and Intelligence-floor relaxation, is unchanged.

In this frozen run none of the five approximations is selected. Four have usable observed v5 anchors but their conservative values remain below the effective floors; Omni Flash has no observed anchor Intelligence. The observed-only versus approximation-enabled comparison has zero changed seats, equal costs, equal Intelligence baselines and equal price cutoffs in all modes. A hypothetical-candidate behavior test independently proves that a qualifying estimate can actually win a seat and that a second cannot be selected.

Source evidence: [Laguna S 2.1](https://huggingface.co/poolside/Laguna-S-2.1), [Tencent Hy4 Preview](https://huggingface.co/tencent/Hy4-preview), [Ornith 1.5 122B](https://huggingface.co/ornith-ai/Ornith-1.5-122B), [Qwen 3.8 Omni Flash](https://www.qwencloud.com/models/qwen3.8-omni-flash), [Qwen 3.8 Max Prime](https://commandcode.ai/models/qwen3-8-max-prime). Public-source comparison tests have different versions/harnesses; their numerical scores are not converted into AA observations.

Qwen 3.7 Flash has a verified public identity but no retrieved numerical comparison suitable for a defensible anchor. Fugu Ultra is an unversioned multi-agent catalog route; current Fugu v2 results cannot be assigned to it without version binding. Sources: [Alibaba](https://www.alibabacloud.com/help/en/model-studio/qwen3-7-flash), [catalog route](https://commandcode.ai/models/fugu-ultra), [current Fugu](https://sakana.ai/fugu/).

## Ranking comparison

aligned-v9 versus aligned-v10: same 28 active observed v5 identities, exact existing task costs, unchanged base policy. Historical and estimated components in the published v9 baseline retain their provenance; prior partial scores remain labeled in rank movements. Security uses 14 common measured identities. Absolute composite totals across versions are not measured task-accuracy improvements.

| Role | Common identities | Spearman | Kendall tau-b | Top-5 overlap | Top-10 overlap |
| --- | ---: | ---: | ---: | ---: | ---: |
| architect | 28 | 0.868 | 0.728 | 100% | 70% |
| strategist | 28 | 0.868 | 0.735 | 80% | 90% |
| security-reviewer | 14 | 1.000 | 1.000 | 100% | 100% |
| code-reviewer | 28 | 0.865 | 0.794 | 80% | 90% |
| implementer | 28 | 0.836 | 0.720 | 60% | 90% |
| implementer-heavy | 28 | 0.857 | 0.746 | 80% | 80% |
| synthesizer | 28 | 0.905 | 0.741 | 80% | 80% |
| researcher | 28 | 0.870 | 0.757 | 60% | 80% |

Large GPT-6.1 Terra movements are associated with its formerly partial v9 roles, direct agentic/professional-work observations and removal of the CAI missingness penalty. Security retains identical raw Cyber Index ordering. Under component-weight perturbations of five percentage points, top-5 overlap is 100% in six weighted roles and at least 80% in Strategist. Sensitivity, ablations and benchmark correlations use active measured identities only; they do not validate the numerical accuracy of external analogies or authorize weight changes.

## Portfolio comparison

All candidates meet the existing Intelligence, cost, diversity, reviewer independence and Heavy-advantage constraints. Existing per-offer task costs are copied exactly. Newly scoreable offers use frozen reference workload/rates. Dollar figures estimate an eight-task portfolio cycle, not invoices or runtime performance.

| Mode | Requested floor | Effective floor | Published cost | Candidate cost | Cost change | Changed seats |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| quality | 0.850 | 0.740 | $43.290777 | $34.962383 | -19.24% | 4 |
| balanced | 0.800 | 0.790 | $28.767515 | $31.606593 | +9.87% | 5 |
| budget | 0.750 | 0.750 | $28.767515 | $31.606593 | +9.87% | 6 |

| Role | Quality | Balanced | Budget |
| --- | --- | --- | --- |
| architect | Muse Wonder | Muse Wonder | Muse Wonder |
| strategist | Claude Opus 5.5 | Claude Sonnet 5.5 | Claude Sonnet 5.5 |
| security-reviewer | Kimi K3.1 Pro | Kimi K3.1 Pro | Kimi K3.1 Pro |
| code-reviewer | Gemini 4 Argon | Claude Sonnet 5.5 | Kimi K3.1 Pro |
| implementer | Claude Sonnet 5.5 | Gemini 4 Argon | Gemini 4 Argon |
| implementer-heavy | Kimi K3.1 Pro | Kimi K3.1 Pro | Claude Sonnet 5.5 |
| synthesizer | GPT-6.1 Sol | GPT-6.1 Sol | GPT-6.1 Sol |
| researcher | GPT-6.1 Sol | GPT-6.1 Sol | GPT-6.1 Sol |

Quality relaxes the requested 85% Intelligence floor to 74% to satisfy all constraints; Balanced relaxes 80% to 79%, and Budget remains at 75%. The observed Intelligence reference is 58.406 before price filtering and 54.5087 after the Balanced/Budget outlier filter. The latter cutoff is 10.016849, derived from 25 latest-generation measured offers across 16 families. Approximate rows do not enter that reference population.

The age window removes the apparent small Budget saving in the earlier comparison: final Budget now costs 31.606593, the same as Balanced and 9.87% above published v9. Expanding active observed role ranks changes three Budget seats at the same total cost; adding analogies changes none. These are consequences of the unchanged percentile objectives and constraints, not a claim that the new method minimizes dollar cost.

## Reproduction and validation

```sh
npm ci
npm run check:all
npm run compare:methodologies -- --output-dir tmp/migration-comparison
node scripts/validate.mjs --snapshot tmp/migration-comparison/expanded-v10.json
git diff --check
```

The five scenarios isolate methodology, observed coverage and approximation effects. Compact statistics, generation exclusions, remaining gaps, source recipes and per-seat deltas are in [the evidence JSON](validation/selective-v10-2026-10-28.json). Candidate and aligned portfolio files reside only under `methodology/validation/`.

Local validation: Windows x64 / Node 24.13.1, full `check:all` passed; dependency audit found zero vulnerabilities. The canonical parser also reproduces all 76 frozen observations from the original captured HTML. Supported Briefcase representations and Intelligence evaluation metadata are canonicalized before duplicate comparison, with conflicts rejected and equivalent representations accepted. The focused behavior checks cover age windows driven by unmeasured releases, missingness/version/scale integrity, expiry, missing anchors, no fake benchmark observations, unchanged observed percentiles, conservative values, evidence independence and one estimated seat. The default v9 snapshot and generated lineups still match. Candidate site DOM smoke confirms historical rows are hidden, approximations are labeled, provenance is visible, methodology explains heuristic uncertainty and mixed snapshot/portfolio versions are rejected.

The existing Linux/Node 22 CI job runs the focused behavior checks through `check:snapshot`; no workflow or paid-job expansion was added. This is code/provenance/policy validation, not empirical validation of external-model transfer accuracy. DOM smoke is not a pixel-level browser check. A real rendered-browser check remains necessary before activation.

## Activation boundary

Published `data/**`, `site/data/**`, default `config/roles.json`, base portfolio policy, routing aliases and workflow files remain unchanged. Production activation remains withheld. A separately approved activation must recheck public source versions and serving identities, refresh coherently, inspect actual browser rendering and preserve rollback hashes. The residual Intelligence estimator and CAI estimators stay disabled in v10. No model evaluation or model API run was triggered.
