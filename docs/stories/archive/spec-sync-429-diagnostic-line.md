---
title: 'Print one diagnostic line for every 429 the trade client receives'
type: 'feature'
created: '2026-10-02'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A live `pnpm sync` session got a 429 although the last State reading showed every declared bucket far below its limit, and the 600 s penalty matches no declared penalty. The governed client folds the 429's headers into the ledger and returns a yield, but nothing records them, so the operator cannot tell which limit refused the request.

**Approach:** On every 429, the governor writes one operator line. The line names the lane, the policy, and the delay the client waited. It also carries the response's raw `Retry-After` and `X-Rate-Limit-*` headers, and the State reading that the pre-request pace was computed from. The chunk composition sends that line to the chunk's operator log (stderr by default). It sends no request and changes no pacing decision.

</frozen-after-approval>

## Implementation Notes

- `packages/sync/src/trade/client.ts`: `TradeClientOptions.log?: (line: string) => void`. In `exchange`, capture the ledger entry for `knownPolicy` before the response is folded in. On `status === 429`, call `log` with one line before returning the yield. When `log` is omitted, nothing is written. The client stays free of `process`.
- Line shape: `sync: the trade API answered 429 on lane <lane> (policy <policy|unknown>) after waiting <n> ms; response headers <json>; paced on <json|no reading>`. The response headers are `retry-after` and every `x-rate-limit-*`, with names lower-cased and sorted. The paced-on reading has one object per rule `{ rule, observedAt, policy: "h:s:p,…", state: "h:s:p,…" }`. Both are JSON, so commas in values stay unambiguous.
- `packages/sync/src/compose-chunk.ts`: pass `log ?? writeStderr` to `createTradeGovernor`. This is the same sink `runChunk` defaults to. Export `writeStderr` from `chunk/run-chunk.ts` so the default exists only once.
- `catalogue-refresh` and `fixtures-record` keep not passing `log`. They abort on their first failure, and the 429 already ends them visibly.
- Tests in `trade/client.test.ts`: a 429 after a seeded reading logs exactly one line that carries the headers and the earlier reading. A cold 429 logs `no reading`. A 200 and a threshold refusal log nothing.
- After review: the line also carries the response instant (`at <iso>`), so the age of each rule's `observedAt` can be read off. The paced-on half names its own policy key (`paced on policy <p> [...]`), which is the lane's remembered policy that `laneDelayMs` read and may differ from the 429's policy. The client test advances the clock between the two requests. `sync-batch.test.ts` pins the `composeChunk` wiring: a gate 429 reaches the `log` given to the command.
- Files changed: `packages/sync/src/trade/client.ts`, `packages/sync/src/trade/client.test.ts`, `packages/sync/src/compose-chunk.ts`, `packages/sync/src/chunk/run-chunk.ts` (exports `writeStderr`), and `packages/sync/src/sync-batch.test.ts`.

## Review Triage Log

- Blind Hunter: a throwing `log` sink turns the yield into a rejection. Verdict: low, rejected. `runChunk`'s own `log` calls are unguarded in the same way. `process.stderr.write` reports EPIPE as an async `error` event, not as a throw. A guard would protect a state no shipped sink reaches.
- Blind Hunter: the line pairs the 429's policy with a reading under another policy. Verdict: medium, patched. The paced-on half now names its own policy key.
- Blind Hunter: the line has no response time. Verdict: medium, patched. `at <respondedAt>` was added.
- Blind Hunter: the fixed clock cannot show that the reading predates the 429. Verdict: low, patched. The test sets a later instant before the 429.
- Blind Hunter: the `composeChunk` wiring is untested. Verdict: low, patched. A new test is in `sync-batch.test.ts`.
- Blind Hunter: the spec is missing the template's sections. Verdict: false. The oneshot route deletes those sections by design (step-02).
- Blind Hunter: the line shape should be recorded in `IMPLEMENTATION-NOTES.md`. Verdict: low, rejected. No operator stderr line of `runChunk` is documented there. That document belongs to the architect, and the Review brief bars a reviewer-driven owner edit.
- Blind Hunter: headers that differ only in case are merged silently. Verdict: false. `fetch`'s `Headers` already combines duplicates, and `createFetchHttpPort` lower-cases the names, so no case-variant duplicates reach the client.
- Blind Hunter: the doc comments overstate what the reading is. Verdict: false for the reading claim, because `laneDelayMs` reads `lanePolicies.get(lane)`, which is the same `knownPolicy` key. The threshold-refusal skip was still added to the `log` doc comment.
- Blind Hunter: the default-sink claim may not hold. Verdict: false. `composeChunk` passes the same `log` into `runChunk`'s ports, and both default to `writeStderr`.
- Deferred Ledger Auditor: zero findings.
