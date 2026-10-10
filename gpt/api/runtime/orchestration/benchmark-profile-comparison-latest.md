# Benchmark Profile Comparison

Updated: 2026-04-26

## Current profile
- tag: local-darwin-arm64-64gb
- source: derived_from_machine
- model: unspecified
- endpoint: unspecified
- machine: darwin/arm64, 10 CPUs, 64 GB

## Profiles
- local-darwin-arm64-64gb: runs=6 latest=100 best=100 worst=100 warnings=0 failures=0 comparable=yes machine=darwin:arm64:10cpu:64gb weakest=Escalated delivery handoff (99)

## Normalization
- rule: Compare score deltas freely only when profile tag and machine key match; otherwise treat results as adjacent evidence, not a regression baseline.
- current machine key: darwin:arm64:10cpu:64gb
- cross-machine profiles: none
