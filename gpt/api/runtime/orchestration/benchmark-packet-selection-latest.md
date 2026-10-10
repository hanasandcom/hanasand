# Benchmark Packet Selection

Updated: 2026-04-26

## Selected
- packet: 90
- title: Evidence Bundle For Self-Edits
- score: 85
- confidence: high

## Evidence inputs
- benchmark family: orchestration_benchmark_v2
- trend status: stable
- profile: local-darwin-arm64-64gb
- warmup baseline: model_warmup:validation
- top cost scenario: Escalated delivery handoff (780, context:708)

## Ranked packets
- packet 90: Evidence Bundle For Self-Edits score=85 confidence=high evidence=scenario cost score=3118 | top scenario=Escalated delivery handoff share=0.2502 | warmup baseline=model_warmup:validation | next packet depends directly on ranking evidence
- packet 94: Verified Self-Improvement Candidate Flow score=40 confidence=medium evidence=difficulty=increase | difficulty reason=All scenarios passed with a near-perfect average score; the next benchmark loop should add harder pressure cases.
- packet 91: Cross-Machine Profile Normalization score=30 confidence=low evidence=trend status=stable | profile=local-darwin-arm64-64gb | machine=darwin/arm64
- packet 93: Regression Root-Cause Shortlisting score=20 confidence=low evidence=trend status=stable | highest costs are context dominated
- packet 92: Eval Failure Clustering And Dedup score=15 confidence=low evidence=regression signals=0 | recommendations=0
- packet 95: Reviewed Self-Improvement Release Candidate score=5 confidence=low evidence=release-candidate flow should wait for evidence bundle and candidate generation outputs

## Manual override notes
- Dependency gates still override the numeric score.
- User-directed product work can supersede self-improvement packet ranking.
- Low-confidence candidates should not be implemented without reading their packet file.
