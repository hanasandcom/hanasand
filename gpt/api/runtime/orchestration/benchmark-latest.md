# Orchestration Benchmark

Updated: 2026-04-26

## Summary
- profile: local-darwin-arm64-64gb
- profile source: derived_from_machine
- model: unspecified
- endpoint: unspecified
- machine: darwin/arm64, 10 CPUs, 64 GB
- difficulty level: 2 (previous benchmark saturated at 100 with 0 warnings)
- repeat multiplier: 1.35
- adaptive scenario enabled: yes
- average score: 100
- scenarios: 8
- pass / warn / fail: 8 / 0 / 0
- weakest scenario: Escalated delivery handoff (99)

## Scenario results
- Delivery and handoff: pass (100) role=1.00 pack=1.00 evidence=1.00 export=1.00 pressure=1.00 blocked=1.00 contradiction=1.00
- Delivery handoff under noisy verification pressure: pass (100) role=1.00 pack=1.00 evidence=1.00 export=1.00 pressure=1.00 blocked=1.00 contradiction=1.00
- Context-pressure triage: pass (100) role=1.00 pack=1.00 evidence=1.00 export=1.00 pressure=1.00 blocked=1.00 contradiction=1.00
- Deploy diagnosis: pass (100) role=1.00 pack=1.00 evidence=1.00 export=1.00 pressure=1.00 blocked=1.00 contradiction=1.00
- Pressure plus blocked release: pass (100) role=1.00 pack=1.00 evidence=1.00 export=1.00 pressure=1.00 blocked=1.00 contradiction=1.00
- Escalated delivery handoff: pass (99) role=1.00 pack=1.00 evidence=1.00 export=0.90 pressure=1.00 blocked=1.00 contradiction=1.00
- Adaptive noise escalation: pass (100) role=1.00 pack=1.00 evidence=1.00 export=1.00 pressure=1.00 blocked=1.00 contradiction=1.00
- Contested merge decision: pass (100) role=1.00 pack=1.00 evidence=1.00 export=1.00 pressure=1.00 blocked=1.00 contradiction=1.00

## Highest-cost scenarios
- Escalated delivery handoff: cost=780 wall=198ms packed=35784 omitted=100075 dominant=context:708
- Delivery handoff under noisy verification pressure: cost=716 wall=181ms packed=35544 omitted=83895 dominant=context:649
- Context-pressure triage: cost=593 wall=185ms packed=36750 omitted=46641 dominant=context:531
- Pressure plus blocked release: cost=436 wall=180ms packed=29333 omitted=21586 dominant=context:369
- Adaptive noise escalation: cost=377 wall=264ms packed=14387 omitted=47304 dominant=context:309
- Deploy diagnosis: cost=76 wall=221ms packed=477 omitted=0 dominant=events:52
- Contested merge decision: cost=73 wall=191ms packed=468 omitted=0 dominant=events:52
- Delivery and handoff: cost=67 wall=191ms packed=282 omitted=0 dominant=events:47

## Evidence-ranked packet selection
- packet 90: Evidence Bundle For Self-Edits score=85 confidence=high evidence=scenario cost score=3118; top scenario=Escalated delivery handoff share=0.2502; warmup baseline=model_warmup:validation; next packet depends directly on ranking evidence
- packet 94: Verified Self-Improvement Candidate Flow score=40 confidence=medium evidence=difficulty=increase; difficulty reason=All scenarios passed with a near-perfect average score; the next benchmark loop should add harder pressure cases.
- packet 91: Cross-Machine Profile Normalization score=30 confidence=low evidence=trend status=stable; profile=local-darwin-arm64-64gb; machine=darwin/arm64
- packet 93: Regression Root-Cause Shortlisting score=20 confidence=low evidence=trend status=stable; highest costs are context dominated
- packet 92: Eval Failure Clustering And Dedup score=15 confidence=low evidence=regression signals=0; recommendations=0
- packet 95: Reviewed Self-Improvement Release Candidate score=5 confidence=low evidence=release-candidate flow should wait for evidence bundle and candidate generation outputs

## Self-edit evidence bundle
- id: self-edit-2026-04-26-packet-90
- packet: 90
- status: ready_for_review
- primary evidence: Packet 90 ranked first with score 85 and high confidence.; Escalated delivery handoff is the highest-cost scenario at 780 cost score and 0.2502 share.; Profile-aware trend is stable for local-darwin-arm64-64gb.; Warmup baseline is model_warmup:validation with status ready.

## Failure clusters
- gate:local-darwin-arm64-64gb:darwin:arm64:10cpu:64gb:delivery_handoff_escalated:omission_pressure:warn: count=6 latest=2026-04-26T12:25:36.504Z severity=warning examples=Escalated delivery handoff warned gate omission_pressure

## Root-cause shortlist
- 1. Context packing is probably dropping hot evidence under pressure.: score=100 confidence=high evidence=cluster=gate:local-darwin-arm64-64gb:darwin:arm64:10cpu:64gb:delivery_handoff_escalated:omission_pressure:warn count=6; trend omission delta=0; top cost scenario=Escalated delivery handoff dominant=context:708 packed=35784 omitted=100075; evidence bundle=self-edit-2026-04-26-packet-90

## Verified self-improvement candidate
- status: candidate_rejected
- id: verified-2026-04-26-context-packing-omission-pressure
- confidence: high
- next action: Open the top-cost scenario replay and inspect which hot context segments were omitted before changing pack budgets or priority rules.

## Self-improvement release candidate
- status: reviewed_rejected
- id: rc-verified-2026-04-26-context-packing-omission-pressure
- review owner: A human reviewer must accept or reject after inspecting the cited replay and validation artifacts.
- outcome: rejected

## Self-improvement replay inspection
- status: inspection_ready
- target: Escalated delivery handoff
- recommendation: keep_rejected_until_human_replay_review
- omitted hot segments: 2

## Recommended next packets


## Draft packet queue
none

## Adaptive difficulty
- state: increase
- reason: All scenarios passed with a near-perfect average score; the next benchmark loop should add harder pressure cases.
- next scenario seed: Combine context pressure, partial failure, and contradictory reviewer evidence in one run.

## Trend and regression
- status: stable
- profile: local-darwin-arm64-64gb
- baseline: matched_profile_baseline (2026-04-26T07:29:58.478Z)
- rule: Compare regressions only against the previous benchmark with the same profile tag; withhold regression status when only cross-profile history exists.
- summary: No regression detected across the current weakest-scenario and omission-pressure checks.
- average score delta: 0
- weakest scenario delta: Escalated delivery handoff 0
- omission hot-segment delta: 0
