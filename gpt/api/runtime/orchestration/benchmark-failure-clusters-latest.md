# Benchmark Failure Clusters

Updated: 2026-04-26

## Summary
- profile: local-darwin-arm64-64gb
- machine: darwin:arm64:10cpu:64gb
- evidence bundle: self-edit-2026-04-26-packet-90
- clusters: 1
- repeated clusters: 1

## Clusters
- gate:local-darwin-arm64-64gb:darwin:arm64:10cpu:64gb:delivery_handoff_escalated:omission_pressure:warn: severity=warning count=6 first=2026-04-26T07:14:18.446Z latest=2026-04-26T12:25:36.504Z examples=Escalated delivery handoff warned gate omission_pressure

## Rules
- Scenario statuses cluster by profile, machine, scenario id, and status.
- Quality gates cluster by profile, machine, scenario id, gate id, and fail/warn state.
- Regression signals cluster by profile, machine, and normalized signal text.

## Limitations
- Passing high-cost scenarios are not failures and stay in scenario-cost artifacts.
- Text normalization is intentionally conservative; semantically similar but differently worded failures may remain separate.
- Legacy benchmark artifacts without profile identity are grouped under the current fallback identity only when read through this run.
