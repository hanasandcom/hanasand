# Context Export Sweep

- Run: run-2026-04-24T23-56-37-859Z
- Verdict: pass
- Summary: Healthy export meets the baseline while the degraded export trips stricter gates as expected.

## Healthy export gates
- pack_coverage: pass (Every worker node has a stored context pack.)
- hot_segment_coverage: pass (Hot task context is represented across the exported scopes.)
- budget_discipline: pass (No stored pack exceeded its token budget.)
- omission_pressure: pass (The average scope kept omission pressure under control.)
- graph_integrity: pass (Every child node has at least one inbound graph edge.)

## Degraded export gates
- pack_coverage: fail (Most worker nodes are missing context packs.)
- hot_segment_coverage: pass (Hot task context is represented across the exported scopes.)
- budget_discipline: pass (No stored pack exceeded its token budget.)
- omission_pressure: pass (The average scope kept omission pressure under control.)
- graph_integrity: fail (One or more child nodes are disconnected from the orchestration graph.)

## Deltas
- pack_coverage: pass -> fail
- hot_segment_coverage: pass -> pass
- graph_integrity: pass -> fail
- omission_pressure: pass -> pass
