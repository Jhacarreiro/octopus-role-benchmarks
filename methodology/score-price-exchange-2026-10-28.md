# Score/price exchange: policy v16

Policy v16 supersedes the bounded v15 Budget pass and applies cost optimization to Balanced as well. On the same 2026-10-28 15:13 UTC source input, each role is compared with its fixed initial selection before cost optimization. A point is one absolute point on the 0–100 role-quality scale.

- Budget: price reduction percentage must be at least twice the positive role-score loss.
- Balanced: price reduction percentage must be at least five times that loss.
- Fractional points scale continuously. No separate role-loss, mean-loss, swap-count or minimum total-savings cap applies. Each swap must be no more expensive. A free initial selection permits only free equal-or-better replacements.
- Directly measured role scores and observed Intelligence v5 remain required for new replacements, including exceptions below the initial cutoff. Price, generation, five-family diversity, maximum two seats per family, coding independence and Heavy improvement remain enforced. Statistical Intelligence and CAI estimators remain disabled.
- Joint portfolio search minimizes total adjusted cost. The one-million-state computation bound remains; incomplete search preserves the initial selection. Quality is unchanged.

Large savings now permit substantial losses. A move from a paid model to a free model can justify up to 50 quality points in Budget or 20 in Balanced. These are score/price policy results, not measured task-completion outcomes. All costs below are comparative plan-adjusted eight-task cycle estimates, not subscription fees.

| Mode | Fixed initial cost | Previous published cost | New cost | Savings vs initial | Changed roles | Largest positive role loss |
|---|---:|---:|---:|---:|---:|---:|
| balanced | $10.717514 | $10.717514 | $1.134480 | 89.415% | 8 | 17.432 |
| budget | $6.539957 | $4.911977 | $0.188976 | 97.110% | 8 | 20.157 |

## balanced

Search completed in 158 visited states. 5 families remain; 7 seats are below the initial Intelligence threshold. Losses and savings below are relative to the fixed initial role selection.

| Role | Initial | New | Positive score loss | Role cost reduction |
|---|---|---|---:|---:|
| Architect | Muse Wonder | MiniMax M3.1 Flash | 7.032 | 100.000% |
| Strategist | Claude Sonnet 5.5 | MiMo V2.6 Flash | 15.977 | 96.032% |
| Security Reviewer | Kimi K3.1 Pro | GPT-6 Luna | 11.380 | 94.668% |
| Code Reviewer | Gemini 4 Argon | MiniMax M3.1 Flash | 17.432 | 100.000% |
| Implementer | Claude Sonnet 5.5 | MiMo V2.6 Pro | 17.197 | 88.826% |
| Implementer Heavy | Kimi K3.1 Pro | Claude Sonnet 5.5 | 0.000 | 13.059% |
| Synthesizer | GPT-6.1 Sol | Beam 1.0 | 15.935 | 100.000% |
| Researcher | GPT-6.1 Sol | Beam 1.0 | 15.684 | 100.000% |

## budget

Search completed in 9226 visited states. 5 families remain; 7 seats are below the initial Intelligence threshold. Losses and savings below are relative to the fixed initial role selection.

| Role | Initial | New | Positive score loss | Role cost reduction |
|---|---|---|---:|---:|
| Architect | Claude Haiku 5.5 | MiniMax M3.1 Flash | 2.538 | 100.000% |
| Strategist | Kimi K3.1 Pro | MiMo V2.6 Flash | 14.251 | 96.550% |
| Security Reviewer | Grok 4.7 | GPT-6 Luna | 3.747 | 96.355% |
| Code Reviewer | GPT-6.1 Terra | MiMo V2.6 Flash | 17.332 | 94.709% |
| Implementer | Gemini 4 Argon | MiniMax M3.1 Flash | 20.157 | 100.000% |
| Implementer Heavy | Kimi K3.1 Pro | Claude Haiku 5.5 | 17.980 | 94.668% |
| Synthesizer | GPT-6.1 Terra | Beam 1.0 | 12.902 | 100.000% |
| Researcher | Claude Haiku 5.5 | Beam 1.0 | 7.119 | 100.000% |

## Budget changes since the previous publication

The previous publication already used v15 optimization. Every seat changes again; the new $0.188976 cycle is 96.153% cheaper than its $4.911977 cycle. The formula still uses the original $6.539957 lineup as its reference.

| Role | Previous publication | New |
|---|---|---|
| Architect | MiMo V2.6 Pro | MiniMax M3.1 Flash |
| Strategist | Claude Sonnet 5.5 | MiMo V2.6 Flash |
| Security Reviewer | MiMo V2.6 Pro | GPT-6 Luna |
| Code Reviewer | GPT-6.1 Terra | MiMo V2.6 Flash |
| Implementer | Claude Sonnet 5.5 | MiniMax M3.1 Flash |
| Implementer Heavy | Kimi K3.1 Pro | Claude Haiku 5.5 |
| Synthesizer | GPT-6.1 Terra | Beam 1.0 |
| Researcher | Step 5 Preview | Beam 1.0 |

## Public identity and offer validation

The CommandCode Max table still lists MiniMax M3.1 Flash and Beam as free offers; model pages describe other plans and may show paid prices. Only the Max offer is used here. The public routing artifact identifies the model; publishing it does not configure or execute a runtime.

- [CommandCode Max offers](https://commandcode.ai/docs/plans/max)
- [MiniMax M3.1 Flash identity](https://commandcode.ai/models/minimax-m3-1-flash): `minimax/minimax-m3.1-flash`.
- [MiMo V2.6 Flash identity](https://commandcode.ai/models/mimo-v2-6-flash): `xiaomi/mimo-v2.6-flash`.
- [GPT-6 Luna identity](https://commandcode.ai/models/gpt-6-luna): `gpt-6-luna`.
- [Beam identity](https://commandcode.ai/models/beam-free): `reflection/beam:free`.
