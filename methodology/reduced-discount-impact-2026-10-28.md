# Reduced discount impact: policy v18

Balanced requires at least 15% lower role cost per positive role-quality point lost; Budget requires 10%. All comparisons retain the fixed initial selection for the same snapshot. Fractional points scale continuously. A free replacement can lose at most 100/15 points in Balanced or 10 in Budget. There is no swap-count cap.

Price exclusions, generation eligibility, five-family diversity, coding independence, Heavy +2 on the Implementer metric and Reviewer +2 over both workers on the Reviewer metric remain enforced. Statistical estimators remain disabled. Source observations and prices are unchanged from the preceding publication.

| Role | Quality | Balanced | Budget |
|---|---|---|---|
| Architect | Claude Opus 5.5 | Claude Sonnet 5.5 | Claude Haiku 5.5 |
| Strategist | Claude Opus 5.5 | Claude Sonnet 5.5 | DeepSeek V4.1 Flash (latest) |
| Security Reviewer | Kimi K3.1 Pro | Kimi K3.1 Pro | GPT-6 Luna |
| Code Reviewer | Kimi K3.1 Pro | Gemini 4 Argon | Kimi K3.1 Pro |
| Implementer | Muse Wonder | Muse Wonder | MiniMax M3.1 Flash |
| Implementer Heavy | GPT-6 Astra | GPT-6.1 Terra | DeepSeek V4.1 Flash (latest) |
| Synthesizer | GPT-6.1 Sol | GPT-6.1 Terra | Claude Haiku 5.5 |
| Researcher | Gemini 4 Argon | Kimi K3.1 Pro | MiniMax M3.1 Flash |

| Mode | Previous adjusted cycle | New adjusted cycle | Largest positive loss vs fixed initial |
|---|---:|---:|---:|
| quality | $21.661604 | $21.661604 | 0 |
| balanced | $3.731163 | $9.314314 | 3.033333 |
| budget | $0.249115 | $1.348285 | 9.151005 |

## balanced changes from previous publication

| Role | Previous | New |
|---|---|---|
| Architect | DeepSeek V4.1 Flash (latest) | Claude Sonnet 5.5 |
| Security Reviewer | MiMo V2.6 Pro | Kimi K3.1 Pro |
| Code Reviewer | Kimi K3.1 Pro | Gemini 4 Argon |
| Implementer | MiMo V2.6 Pro | Muse Wonder |
| Researcher | Claude Haiku 5.5 | Kimi K3.1 Pro |

## budget changes from previous publication

| Role | Previous | New |
|---|---|---|
| Architect | MiniMax M3.1 Flash | Claude Haiku 5.5 |
| Strategist | MiMo V2.6 Flash | DeepSeek V4.1 Flash (latest) |
| Code Reviewer | MiMo V2.6 Pro | Kimi K3.1 Pro |
| Synthesizer | Beam 1.0 | Claude Haiku 5.5 |
| Researcher | Beam 1.0 | MiniMax M3.1 Flash |
