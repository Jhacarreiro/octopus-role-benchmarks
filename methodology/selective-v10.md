# Selective role methodology v10

Status: implemented for isolated comparison only. The default `config/roles.json`, published snapshots, production portfolios and refresh workflow remain on v9. Statistical Intelligence and CAI estimators remain disabled. Explicit role analogies are enabled only in the isolated v10 candidate, including conservative portfolio eligibility authorized by the user.

## Entry points and activation boundary

The opt-in configuration is `config/roles-v10.json`. Run an offline comparison using the frozen, public source observations:

```sh
npm ci
npm run test:selective
npm run compare:methodologies -- --output-dir tmp/migration-comparison
node scripts/validate.mjs --snapshot tmp/migration-comparison/expanded-v10.json
```

The comparison produces five snapshots and portfolios: the published v9 baseline, v9 on the active observed-v5 cohort, v10 on that same cohort with the same costs, v10 with expanded active observed role coverage, and v10 with the documented role analogies. The last pair isolates the effect of approximations. `summary.json` contains ranking correlations, entries/exits, rank movements, portfolio decisions, sensitivity, ablations and correlations between benchmarks. `comparison.json` also includes component contributions and full rank details for Quality, Balanced and Budget.

For an explicitly requested source-only collection into an isolated directory:

```sh
node scripts/update.mjs --methodology-v10 --output-dir tmp/selective-collection
```

This reads existing public evaluations; it does not execute model benchmarks. `--inputs methodology/fixtures/2026-10-28-selective-inputs.json` avoids all network collection. The output directory is mandatory. Published `data/`, `site/`, configuration and Git directories are rejected as output targets. There is no default activation, publication, routing update or new scheduled job.

## Source contract

The parser decodes the public Next.js stream, reads complete JSON model objects, matches the exact slug and UUID, and keeps reasoning efforts separate. Braces inside strings do not terminate an object. Conflicting duplicate source objects fail extraction for that identity. A failed identity does not erase unrelated observations; an entirely failed extraction or invalid score scale blocks generation.

Briefcase is read from `briefcaseElo` or the corresponding `briefcaseBreakdown.overall.elo`/`briefcaseBreakdown.elo` source shape. It is not inferred from another model. GDP.pdf uses `gdpPdfAllPass`, AutomationBench uses its guardrail-gated `automationBenchPartialScore`, and Terminal-Bench uses `terminalBench40`. GDPval's raw Elo is retained only as an unnormalized diagnostic comparator; the former `gdpvalNormalized` is never silently substituted.

Every accepted value records its raw value/range, exact source field, model UUID, effort, source URL, capture timestamp, implementation, metric version and lifecycle. Evaluation timestamps remain null when unpublished. Dataset/harness changes require a new version binding, rather than assigning the previous metric to a similarly named new field. The frozen input file includes source HTML hashes and capture times; it contains no private operational data.

Sources: [AA methodology](https://artificialanalysis.ai/methodology/intelligence-benchmarking), [AA v5 announcement](https://artificialanalysis.ai/articles/artificial-analysis-intelligence-index-v5), [AA Cyber Index](https://artificialanalysis.ai/evaluations/artificial-analysis-cyber-index).

## Core role weights

| Role | Weights |
| --- | --- |
| Architect | Briefcase 45%; GDP.pdf 25%; LCR 20%; HLE 10% |
| Strategist | Briefcase 45%; GDP.pdf 20%; AutomationBench 15%; Omniscience 20% |
| Security Reviewer | AA Cyber Index v1 directly |
| Code Reviewer | Terminal-Bench 4.0 35%; SciCode 30%; LCR 20%; Omniscience 15% |
| Implementer | Terminal-Bench 4.0 60%; LCR 25%; HLE 15% |
| Implementer Heavy | Terminal-Bench 4.0 45%; Briefcase 35%; LCR 20% |
| Synthesizer | GDP.pdf 45%; LCR 25%; Omniscience 30% |
| Researcher | GDP.pdf 30%; LCR 25%; Omniscience 25%; HLE 20% |

SciCode, text-only HLE and LCR retain their explicitly named legacy series. FrontierCode 2.0, HLE-Diamond, Terminal-Bench-Science and CritPt v2 hard are separate diagnostics. Missing diagnostic values never change core scores. Code generation and scientific reasoning remain imperfect proxies for independent code review, and professional deliverables are not a direct software-architecture evaluation.

The v10 coding roles use observed agentic benchmarks directly. CAI* has no scoring weight and no CAI estimator runs. The proposed residual Intelligence estimator is not part of the production code path; configuration validation rejects enabling it. Existing v9 snapshot provenance is retained only in baseline comparisons.

## Normalization and missingness

Fractions are multiplied by 100 after range validation. Briefcase uses the official fixed transform `100 * clamp((Elo - 500) / 2000, 0, 1)`. Omniscience v1.1 uses `50 + rawIndex / 2`. Cyber Index is already on 0–100. These transformations do not establish equivalence between tests or historical dataset versions. GDP.pdf all-pass is not criterion pass rate, and HLE-Diamond is not text-only HLE.

A measured role enters point rankings only with all its core components observed. Explicit role analogies follow the separate policy below. Missing inputs produce a separate interval: the sum of known weighted contributions through that sum plus the missing weight times 100. The missing observation remains absent; no point score, percentile or redistributed weight is created for that role. Other complete roles remain independently scoreable. `measurementKind`, `lifecycle` and `completeness` distinguish observed/estimated/unavailable, current/legacy, and complete/partial/unavailable.

## Generation window and documented role analogies

The full retained catalog defines the two newest distinct numeric generations in each series, including new models without benchmarks. Versions are ordered as components, not subtracted as decimals. Duplicate offers do not add generations. GPT-6.1 and GPT-6 therefore exclude GPT-5.6/5.4/5.3 in this catalog. Claude Opus, Sonnet, Haiku and Fable have independent release series; Haiku 4.5 remains the previous catalog Haiku generation and still lacks complete current role evidence. Unversioned names remain eligible for evidence review. Explicit superseded releases are historical.

Historical rows and their source evidence remain in the snapshot with an exclusion reason. They do not enter current rankings, percentile reference populations, coverage denominators, source-gap issues or portfolios. Within the active window, the existing portfolio preference for the latest measured generation or a better previous-generation role score still applies. It cannot revive historical rows.

Five configured public models have `anchor-envelope-v1` role analogies. They preserve empty target benchmark fields and a null target AA identity. Coding-only external evidence cannot fill professional deliverables, factuality or security. Serving-variant analogies use a 5-point policy haircut; related architecture uses 15; external comparison uses 20. These are intentionally conservative policy choices without a measured transfer-error calibration. Their displayed ranges are heuristic envelopes, not statistical confidence intervals or guaranteed lower performance bounds.

For each supported role, the reference point is the minimum complete observed anchor score; ranking uses that minimum minus the haircut, clamped to 0-100. The upper policy value uses the maximum anchor plus the haircut. Intelligence eligibility similarly uses the minimum observed v5 anchor Intelligence minus the haircut. If any required anchor or its Intelligence is unavailable, expired or historical, the affected approximation or portfolio eligibility fails closed. No residual Intelligence fit runs, and estimated values never train another estimator or serve as anchors.

Only one estimated seat is allowed per portfolio, even when the Intelligence floor relaxes. The estimated role and Intelligence use conservative values. The Heavy advantage compares its lower value against an estimated Implementer's upper value. Proxy/anchor evidence cannot satisfy coding independence, even if the public names belong to different families. Security always requires direct Cyber Index. Analogies are placed against the observed quality/cost percentile distributions; they cannot move those distributions or define the Intelligence reference and price cutoff populations.

Recipes, role scope, sources, margins and review dates are in `config/roles-v10.json`. They expire on 2026-11-27 unless reviewed with new evidence. Qwen 3.7 Flash lacks a comparable numerical reference; the Fugu Ultra catalog route cannot yet be bound to current Fugu v2 evaluations. Both remain pending instead of receiving unsupported numbers. Decision variants and unidentified stealth offers are not approximated.

## Intelligence, cost and portfolios

Measured candidates require finite, explicitly non-estimated AA Intelligence with a v5 evaluation binding. A documented role analogy may instead use its conservative policy Intelligence value derived only from observed v5 anchors. Unknown Intelligence is not converted to zero; an unknown anchor blocks portfolio eligibility. Role rankings can therefore show useful observed capability for more models than the portfolio candidate pool. The reference is still the most intelligent model in the eligible universe, recomputed after the existing cost filter when applicable.

The portfolio policy is unchanged: requested floors 85/80/75%, descent by 0.005, statistical cost filter, family diversity, reviewer family independence and the Heavy model's minimum two-point advantage on the Implementer score. A higher Intelligence value is not substituted for that last constraint. Free offers supersede paid offers with the same model name. Unresolved identities remain unranked unless an explicit, evidence-backed role analogy is configured; those analogies never create an AA identity or raw benchmark observations.

Existing task costs are copied exactly in comparisons. Newly scoreable offers use the existing frozen reference profile repriced with the same frozen effective CommandCode rates. The standalone v10 collector uses that reference profile for all rows; changing from observed model-specific telemetry to a shared profile is a separate cost experiment and must not be mistaken for a quality gain.

## Validation and rollback

`npm run check:snapshot` also runs the v10 behavior checks in the existing CI job. Tests exercise selective missingness, partial intervals, adjacent effort isolation, duplicate conflicts, incompatible Intelligence versions, invalid scales, statistical estimator rejection, age windows driven by unmeasured new releases, free-offer preference, source failures, observed/proxy separation, expiry, conservative eligibility, evidence independence and the one-estimated-seat portfolio limit. They do not pin a ranking snapshot or duplicate a formula to declare correctness.

The checked-in validation report records the current comparison. Large rank movements and top-k changes are reviewed against component contributions. Weight sensitivity and component ablations are diagnostics, not permission to change weights automatically.

Before any future activation, require a reviewed publication change, a supervised refresh, public sanitization, fresh source-version checks and rendered browser verification. Preserve the previous code/data hashes and restore the whole coherent snapshot/portfolio/frontend set on integrity, provenance, policy or rendering failure. No production refresh or deployment is authorized by this implementation PR.
