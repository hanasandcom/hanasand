# Self-Edit Evidence Bundle

Updated: 2026-04-26

## Candidate
- id: self-edit-2026-04-26-packet-90
- status: ready_for_review
- packet: 90
- title: Evidence Bundle For Self-Edits
- score: 85
- confidence: high
- profile: local-darwin-arm64-64gb

## Primary evidence
- packet_selection: Packet 90 ranked first with score 85 and high confidence. (benchmark-packet-selection-latest.json)
- scenario_cost: Escalated delivery handoff is the highest-cost scenario at 780 cost score and 0.2502 share. (benchmark-scenario-costs-latest.json)
- profile_trend: Profile-aware trend is stable for local-darwin-arm64-64gb. (benchmark-trend-latest.json)
- warmup: Warmup baseline is model_warmup:validation with status ready. (mac-validation-profile-smoke-latest.json)

## Cost context
- total cost score: 3118
- top scenario: Escalated delivery handoff (780, context:708)
- packed / omitted tokens: 35784 / 100075

## Trend context
- status: stable
- baseline: matched_profile_baseline (2026-04-26T07:29:58.478Z)
- regression signals: 0
- improvement signals: 0

## Difficulty context
- state: increase
- reason: All scenarios passed with a near-perfect average score; the next benchmark loop should add harder pressure cases.
- next seed: Combine context pressure, partial failure, and contradictory reviewer evidence in one run.

## Review checklist
- Confirm the selected packet dependency gate is satisfied.
- Read the selected packet file before editing code.
- Use the linked benchmark artifacts as evidence, not as automatic approval.
- Rerun the benchmark after the self-edit path changes.
