# Selective v10 implementation validation

Frozen baseline: `24b7d71fd27df2fe1428207bc153bab35b5f7aa6`, `data/2026-10-28.json`. Public source captures: 2026-10-28. No merge, activation, production refresh, routing change or website publication. The statistical Intelligence estimator remains disabled. User-authorized role analogies are enabled only in the isolated v10 candidate, including conservative portfolio eligibility.

## Active coverage

The catalog has 99 raw offers, 97 after free-offer preference, and 68 active after excluding 29 historical offers. Of those, 56 offers (48 verified AA identities) have at least one complete measured role. Ten additional offers have documented analogies, including two partially measured AA targets. Thus 66/68 have some role coverage; this does not mean complete coverage of all eight roles. Only the two Jev offers remain unranked. Historical evidence remains stored outside active rankings and coverage denominators.

| Role | Complete measured identities | Measured offers | Also observed Intelligence v5 | Estimated offers |
| --- | ---: | ---: | ---: | ---: |
| architect | 48/50 | 56 | 29 | 1 |
| strategist | 32/50 | 36 | 29 | 1 |
| security-reviewer | 19/50 | 23 | 14 | 0 |
| code-reviewer | 32/50 | 36 | 29 | 3 |
| implementer | 48/50 | 56 | 29 | 9 |
| implementer-heavy | 48/50 | 56 | 29 | 8 |
| synthesizer | 32/50 | 36 | 29 | 1 |
| researcher | 32/50 | 36 | 29 | 2 |

There are 50 active matched AA identities and 29 with observed v5 Intelligence; security has 14. Beam 1.0 is now bound to its exact public Reflection AA identity and uses direct observations. The same-cohort methodology comparison retains 28 identities with pre-existing v9 role scores, while Beam enters the separate expanded-measured-coverage scenario.

## Conservative approximations

| Model | Supported roles | Observed anchors | Policy haircut | Conservative Intelligence |
| --- | --- | --- | ---: | ---: |
| Laguna S 2.1 | implementer, implementer-heavy | inkling | 20 points | 0.000 |
| Glyph Cluster | implementer | nvidia-nemotron-3-ultra-550b-a55b, inkling-small | 30 points | 0.000 |
| Tencent Hy4 Preview | implementer, implementer-heavy | glm-5-3 | 20 points | 11.653 |
| Ornith 1.5 122B | implementer, implementer-heavy, code-reviewer | qwen3-8-27b, nemotron-3-5-super-vl | 20 points | 0.000 |
| Qwen 3.8 Omni Flash | implementer, implementer-heavy | qwen3-8-flash-next | 15 points | unavailable |
| Qwen 3.8 Max Prime | architect, strategist, code-reviewer, implementer, implementer-heavy, synthesizer, researcher | qwen3-8-max | 5 points | 28.555 |
| Qwen 3.7 Flash | researcher | inkling, nvidia-nemotron-3-ultra-550b-a55b | 25 points | 0.000 |
| Step 3.7 Flash | code-reviewer, implementer, implementer-heavy | inkling, nvidia-nemotron-3-ultra-550b-a55b | 25 points | 0.000 |
| Claude Haiku 4.5 | implementer, implementer-heavy | claude-haiku-5-5 | 45 points | 0.000 |
| Fugu Ultra | implementer, implementer-heavy | claude-fable-5 | 30 points | unavailable |

Eight unmatched targets keep a null AA identity and empty raw benchmark fields. Step 3.7 Flash and Haiku 4.5 preserve their real AA identity, observed contributions and original partial calculations; only missing contributions receive analogies. Known measured values are never replaced, and a complete new observed role takes precedence. Policy margins vary with evidence quality and are not calibrated confidence bounds. No security estimate is allowed. Source failure, insufficient target evidence, historical anchors and expiry fail closed.

The six-model follow-up is documented [separately](coverage-followup-2026-10-28.md), with [structured source facts](fixtures/2026-10-28-coverage-research.json). Qwen 3.7 Flash now has a narrow reasoning/research analogy; Glyph has a weak implementation analogy from a published nine-task suite. Fugu uses only the original launch report as an explicitly uncertain coding analogy, without importing current v2 results. Its current served revision remains unconfirmed.

Portfolio selection uses conservative role and Intelligence values, at most one estimated seat, shared-anchor/worker coding independence, and the upper policy value of an estimated Implementer for the Heavy advantage check. Unknown anchor Intelligence stays unavailable. Estimates do not define observed percentiles, Intelligence baselines or price-filter reference populations.

None of the ten analogies is selected in this frozen run. Eight have complete v5 anchors but their conservative values are below the effective floors; Omni Flash and Fugu have no observed v5 anchor Intelligence. The observed-only versus analogy-enabled comparisons have equal seats, costs, Intelligence baselines and cutoffs. A hypothetical-candidate behavior test proves that a qualifying analogy can actually win a seat while a second cannot.

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

Quality relaxes the requested 85% Intelligence floor to 74% to satisfy all constraints; Balanced relaxes 80% to 79%, and Budget remains at 75%. The observed Intelligence reference is 58.406 before price filtering and 54.5087 after the Balanced/Budget outlier filter. The latter cutoff is 9.872448, derived from 26 latest-generation measured offers across 17 families. Beam's newly measured free offer changes this reference population; the same three high-cost offers remain excluded. Approximate rows do not enter that reference population.

The age window removes the apparent small Budget saving in the earlier comparison: final Budget now costs 31.606593, the same as Balanced and 9.87% above published v9. Expanding active observed role ranks changes three Budget seats at the same total cost; adding analogies changes none. These are consequences of the unchanged percentile objectives and constraints, not a claim that the new method minimizes dollar cost.

## Reproduction and validation

```sh
npm ci
npm run check:all
npm run compare:methodologies -- --output-dir tmp/migration-comparison
node scripts/validate.mjs --snapshot tmp/migration-comparison/expanded-v10.json
git diff --check
```

The five scenarios isolate methodology, observed coverage and approximation effects. Compact statistics, generation exclusions, remaining gaps, source recipes and per-seat deltas are in [the evidence JSON](validation/selective-v10-2026-10-28.json). Candidate and published comparison portfolio files reside only under `methodology/validation/`.

Local validation: Windows x64 / Node 24.13.1, full `check:all` passed; dependency audit found zero vulnerabilities. The canonical parser also reproduces all 77 frozen observations from the original captured HTML. Supported Briefcase representations and Intelligence evaluation metadata are canonicalized before duplicate comparison, with conflicts rejected and equivalent representations accepted. The focused behavior checks cover age windows driven by unmeasured releases, missingness/version/scale integrity, expiry, missing anchors, no fake benchmark observations, exact Beam UUID binding, preserved partial target observations, unchanged measured percentiles, conservative values, shared-worker evidence independence and one estimated seat. The default v9 snapshot and generated lineups still match. Candidate site DOM smoke confirms historical rows are hidden, approximations are labeled, provenance is visible, methodology explains heuristic uncertainty and mixed snapshot/portfolio versions are rejected.

The existing Linux/Node 22 CI job runs the focused behavior checks through `check:snapshot`; no workflow or paid-job expansion was added. This is code/provenance/policy validation, not empirical validation of external-model transfer accuracy. DOM smoke is not a pixel-level browser check. A real rendered-browser check remains necessary before activation.

## Activation boundary

Published `data/**`, `site/data/**`, default `config/roles.json`, base portfolio policy, routing aliases and workflow files remain unchanged. Production activation remains withheld. A separately approved activation must recheck public source versions and serving identities, refresh coherently, inspect actual browser rendering and preserve rollback hashes. The residual Intelligence estimator and CAI estimators stay disabled in v10. No model evaluation or model API run was triggered.
