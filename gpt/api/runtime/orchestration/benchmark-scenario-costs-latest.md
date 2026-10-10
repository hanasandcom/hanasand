# Benchmark Scenario Costs

Updated: 2026-04-26

## Context
- profile: local-darwin-arm64-64gb
- warmup baseline: model_warmup:validation
- warmup status: ready
- warmup ms: 61
- memory pressure: 0.9645

## Totals
- scenarios: 8
- cost score: 3118
- wall ms: 1611
- node active ms: 1118
- packed tokens: 153025
- omitted tokens: 299501
- artifact bytes: 9408

## Highest-cost scenarios
- Escalated delivery handoff: cost=780 share=0.2502 wall=198ms node=124ms packed=35784 omitted=100075 events=20 artifacts=5 dominant=context:708
- Delivery handoff under noisy verification pressure: cost=716 share=0.2296 wall=181ms node=123ms packed=35544 omitted=83895 events=20 artifacts=4 dominant=context:649
- Context-pressure triage: cost=593 share=0.1902 wall=185ms node=125ms packed=36750 omitted=46641 events=19 artifacts=3 dominant=context:531
- Pressure plus blocked release: cost=436 share=0.1398 wall=180ms node=122ms packed=29333 omitted=21586 events=20 artifacts=4 dominant=context:369
- Adaptive noise escalation: cost=377 share=0.1209 wall=264ms node=186ms packed=14387 omitted=47304 events=19 artifacts=3 dominant=context:309
- Deploy diagnosis: cost=76 share=0.0244 wall=221ms node=168ms packed=477 omitted=0 events=20 artifacts=4 dominant=events:52
- Contested merge decision: cost=73 share=0.0234 wall=191ms node=131ms packed=468 omitted=0 events=20 artifacts=4 dominant=events:52
- Delivery and handoff: cost=67 share=0.0215 wall=191ms node=139ms packed=282 omitted=0 events=19 artifacts=3 dominant=events:47

## Missing inputs
- No real model prompt/completion token usage is available for these demo workers.
- Wall time includes child process and filesystem overhead, not only worker reasoning.
- Warmup context is read from the latest Mac validation smoke artifact and may predate this benchmark run.
