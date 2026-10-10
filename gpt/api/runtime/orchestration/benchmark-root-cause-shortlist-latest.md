# Benchmark Root-Cause Shortlist

Updated: 2026-04-26

## Summary
- profile: local-darwin-arm64-64gb
- machine: darwin:arm64:10cpu:64gb
- evidence bundle: self-edit-2026-04-26-packet-90
- candidates: 1

## Candidates
- 1. Context packing is probably dropping hot evidence under pressure. score=100 confidence=high
  - evidence: cluster=gate:local-darwin-arm64-64gb:darwin:arm64:10cpu:64gb:delivery_handoff_escalated:omission_pressure:warn count=6 | trend omission delta=0 | top cost scenario=Escalated delivery handoff dominant=context:708 packed=35784 omitted=100075 | evidence bundle=self-edit-2026-04-26-packet-90
  - next review: Open the top-cost scenario replay and inspect which hot context segments were omitted before changing pack budgets or priority rules.
  - false-positive risks: Omission warnings can repeat because the benchmark intentionally stresses the same pressure path. | A high context cost can be expected for larger scenarios and is not automatically a regression.
  - human review: Confirm the omitted segments were actually needed by the worker that produced the warning.

## Trusted Inputs
- Deduped failure clusters with profile and machine keys.
- The latest self-edit evidence bundle ID and selected packet context.
- Scenario cost attribution for locating expensive pressure points.
- Profile-aware trend signals, only when a matched profile baseline exists.

## Review Policy
- Treat the shortlist as triage guidance, not automatic permission to edit.
- Prefer the highest-ranked candidate only after checking its cited artifact fields.
- If all candidates are low confidence, collect one more benchmark run before acting.
