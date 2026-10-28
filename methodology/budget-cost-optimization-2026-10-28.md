# Budget cost optimization

Historical policy v15. Superseded by the [v16 score/price exchange](score-price-exchange-2026-10-28.md); the figures below preserve the earlier comparison.

Policy v15 keeps the initial Budget selection and then searches for the cheapest complete portfolio within a fixed quality envelope. Each selected role may lose at most one point on its 0–100 quality-score scale, with at most 0.25 points of average positive loss across eight roles. Gains do not cancel losses. The initial reference is regenerated from the snapshot's original selection rules on every run; a preceding optimized portfolio is never the reference.

New replacements require a directly measured role score and observed Intelligence v5. Any number may fall below the initial Intelligence cutoff. The price-level exclusions, subsequent statistical cutoff, generation rules, family limits, independent coding review and Heavy improvement remain enforced. Existing estimated-seat limits are unchanged. Changes require at least 10% overall plan-adjusted cost savings. The exact search is bounded at one million visited states; an incomplete search retains the initial portfolio.

On the fixed 2026-10-28 15:13 UTC input, the search completes in 90 states and changes the adjusted eight-task cycle from $6.539957 to $4.911977, a 24.892829% reduction in this comparative estimate. Five families remain represented. Quality and Balanced are unchanged. No model inference or statistical Intelligence estimation is involved.

| Role changed | Initial model | Optimized model | Positive score loss |
|---|---|---|---:|
| Architect | Claude Haiku 5.5 | MiMo V2.6 Pro | 0.626587 |
| Strategist | Kimi K3.1 Pro | Claude Sonnet 5.5 | 0 (gain) |
| Security Reviewer | Grok 4.7 | MiMo V2.6 Pro | 0.366739 |
| Implementer | Gemini 4 Argon | Claude Sonnet 5.5 | 0 (gain) |
| Researcher | Claude Haiku 5.5 | Step 5 Preview | 0 (gain) |

The three Intelligence exceptions are MiMo in Architect and Security Reviewer, and Step in Researcher. Positive losses total 0.993326 points, averaging 0.124166. Some individually more expensive assignments enable a cheaper complete portfolio by freeing family seats; this is why the search considers joint replacements.

Tests cover more than one Intelligence exception, fixed references, per-role and global loss bounds, refusal to offset losses with gains, measured replacements, meaningful savings, search-limit fallback and coupled changes. These are benchmark-score bounds, not a guarantee of equal performance on real tasks. The full initial selection, changes and exception records are in each published Budget optimization report.
