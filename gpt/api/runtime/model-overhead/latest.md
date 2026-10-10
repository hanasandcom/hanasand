# Model Overhead Latest

- Sample ID: rustfs-beehive-public-1777523189345:1777523393650
- Sample source: runtime_prompt_loop
- Profile: unspecified
- Recorded at: 2026-04-30T04:29:53.650Z
- Conversation: rustfs-beehive-public-1777523189345
- Client: codex-local-handoff
- Prompt tokens: 318
- Prompt token source: tokenize
- Generated tokens: 143
- Generated token source: tokenize
- TPS: 3.8142319663846136
- Next optimization target: completionMs
- Reason: Model completion time is the largest measured slice. Reduce completion calls, shrink completion prompts, or improve decode throughput first.

## Stages

- renderPromptMs: 8
- tokenizePromptMs: 2
- fetchContextMs: 1
- toolLoopMs: 204096
- tokenizeOutputMs: 1
- syncOutputContextMs: 1
- streamEmitMs: 198
- totalMs: 204305

## Loop

- iterations: 4
- completionCalls: 4
- completionMs: 203206
- toolCalls: 3
- toolMs: 887
