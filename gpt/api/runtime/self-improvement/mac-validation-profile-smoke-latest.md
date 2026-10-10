# Mac Validation Profile Warmup

Updated: 2026-04-30

## Summary
- ok: no
- status: failed
- profile: validation
- baseline key: model_warmup:validation
- model API: http://127.0.0.1:18081
- total warmup/readiness ms: 11
- actual model: unknown
- context size: 0

## Probes
- props ms: n/a
- slots ms: n/a

## Memory
- before used/free GB: n/a
- after used/free GB: 62.938/1.062
- delta used GB: n/a
- pressure delta: n/a

## Failure
- Error: Command failed: curl -sS --max-time 8 -w 
%{http_code} http://127.0.0.1:18081/props
curl: (7) Failed to connect to 127.0.0.1 port 18081 after 0 ms: Couldn't connect to server

