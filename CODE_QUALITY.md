# Code quality target

Version 1.

This is the owner's adopted default target for changed code. Explicit project
and task constraints take precedence within platform safety and authorization
boundaries. Identify the adopted house style before implementation or review;
readability, structure and aesthetics are acceptance requirements when adopted.
Keep separately scoped cleanup separate from the requested change.

## Correct behavior is mandatory

Preserve correctness, safety, compatibility, bounded work and explicit failure
handling. Naming and formatting cannot compensate for broken behavior. Passing
tests do not excuse unreadable design; attractive code does not establish
performance. Distinguish behavioral correctness from structural/style acceptance.

## Compose by responsibility

- Start with understandable domain values and contracts that own their
  invariants; compose them into cohesive operations, then thin entrypoints with
  visible orchestration. Bottom-up describes dependencies and responsibilities,
  not a requirement to place every helper before its caller or fragment files.
- Group declarations by responsibility. Use consistent local ordering and
  spacing so readers can find the public story and its supporting detail.
- Name types and operations for domain meaning and effects; expose units,
  ownership and lifecycle/thread boundaries. Prefer direct control flow, early
  validation and named intermediate values that explain intent. Avoid compressed
  clever expressions, deep nesting and hidden work in helpers or properties.
- Keep portable/domain code separate from platform, protocol and storage
  adapters. Make dependency direction visible and reuse existing contracts
  before adding abstractions. Split on distinct invariants or reasons to change,
  not length quotas. Avoid universal manager/helper collections, frameworks for
  one use and a mandatory one-class-per-file rule.

## Design for consumers and maintainers

APIs should read naturally at real call sites. Check a small actual usage example
or consumer test, including Kotlin and Java callers when both are supported.
Builders, receiver lambdas and extension functions are tools for reducing real
calling friction, not required decoration. Preserve existing language, runtime
and API compatibility.

Remove dead logic and duplication where contracts actually match, while keeping
validation, cleanup and ownership. Add wrappers, modules, dependencies, options
or abstractions only for a current need. Do not trade comprehension for fewer
lines. Use the existing formatter/linter for deterministic layout; review names,
ordering, responsibilities, composition and consumer ergonomics directly. A
formatter does not enforce architecture. Add no arbitrary numerical quality
rules, scores or checklist paperwork.

## Substantiate behavior and cost

Tests should cover normal and edge cases, malformed input and error cleanup,
plus concurrency and compatibility where relevant. Use fixed historical inputs
for wire compatibility and assert observable contracts rather than private
implementation structure. Test evidence and design review support each other.

Performance and storage decisions need a named workload and measurements. Assess
hot-path allocation, queue/memory bounds and serialization costs when relevant.
Mocks, compilation and synthetic storage checks do not prove production
performance or fidelity.

## Review the actual change

Trace real use, data flow and lifecycle before judging the cohesive diff and
its affected callers. For each finding give a concrete location, applicable
criterion, consequence and smallest remediation. Classify findings clearly:

- **Correctness/reliability blocker:** a broken contract, safety boundary,
  compatibility requirement, bound or failure path.
- **Adopted structure/style nonconformance:** an explicit accepted requirement
  is unmet; it can block acceptance without being labeled a behavioral bug.
- **Optional suggestion:** a preference not adopted by this target or project;
  it is not a blocker. Label uncertain inferences instead of asserting defects.

Use this short review check as an aid, not a new reporting ceremony:

- Does behavior hold at boundaries, failures and relevant historical inputs?
- Are domain invariants owned, dependencies clear and orchestration thin?
- Are names, effects, units, ordering and control flow easy to follow?
- Do real consumers use the API naturally without speculative layers?
- Do tests and any cost measurements support the actual claims?

From Agent Onboarding. Licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
