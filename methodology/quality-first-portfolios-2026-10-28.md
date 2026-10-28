# Quality-first portfolios: policy v19

Balanced and Budget now maximize total role quality for the initial complete portfolio, within their existing price and diversity constraints. Their requested and effective relative Intelligence floors are zero. Known or previously eligible conservative Intelligence evidence remains required; unknown Intelligence does not enter. Quality retains its existing Intelligence eligibility.

The subsequent cost pass still compares every role with its fixed initial selection: Balanced requires 15% savings per positive quality point lost; Budget requires 10%. Fractional points scale continuously and there is no swap-count cap. Heavy must improve the Implementer metric by at least two points; Reviewer must exceed both workers by at least two on the Reviewer metric, using upper bounds for estimated workers. Initial placement can only break exact quality ties. Statistical Intelligence and CAI estimators remain disabled.

Ranking tables retain their independent 75%/25% Balanced and 40%/60% Budget views; those weighted scores do not select recommended portfolios. Source observations and prices were reused unchanged for comparison.

## Validation

The production quality-first solver uses an exact optimistic-bound search, including the one-estimated-seat cap in its bound. All three published selections and costs reproduce the earlier isolated simulation. Behavioral tests demonstrate that a low-Intelligence, higher-quality specialist seeds both modes ahead of a free competitor with stronger price-weighted table scores, while unknown Intelligence remains excluded and Quality preserves its original eligibility. Existing tests exercise diversity, coding hierarchy, measured replacements, free-price boundaries, fixed references and failed-publication preservation.

| Role | Quality | Balanced | Budget |
|---|---|---|---|
| Architect | Claude Opus 5.5 | Claude Sonnet 5.5 | DeepSeek V4.1 Flash (latest) |
| Strategist | Claude Opus 5.5 | Claude Sonnet 5.5 | Claude Sonnet 5.5 |
| Security Reviewer | Kimi K3.1 Pro | Kimi K3.1 Pro | MiMo V2.6 Pro |
| Code Reviewer | Kimi K3.1 Pro | Kimi K3.1 Pro | Kimi K3.1 Pro |
| Implementer | Muse Wonder | Muse Wonder | MiniMax M3.1 Flash |
| Implementer Heavy | GPT-6 Astra | Gemini 4 Argon | DeepSeek V4.1 Flash (latest) |
| Synthesizer | GPT-6.1 Sol | GPT-6.1 Terra | Claude Haiku 5.5 |
| Researcher | Gemini 4 Argon | GPT-6.1 Sol | MiMo V2.6 Pro |

| Mode | Adjusted eight-task cycle USD | Heavy advantage on Implementer metric | Reviewer advantage over Implementer | Reviewer advantage over Heavy |
|---|---:|---:|---:|---:|
| quality | 21.661604 | 4.930561 | 6.932752 | 4.303838 |
| balanced | 10.015914 | 3.829886 | 6.932752 | 3.338686 |
| budget | 2.378064 | 4.903396 | 20.770505 | 16.030833 |
