# Baseline evaluation

Step 1 adds measurements, not clinical behavior changes. Both routes use shared
request builders with the original model, prompt content and request shape. The
existing transcript detector is extracted unchanged; its negation and coverage
gaps are deliberately visible in the baseline.

## Run offline

```sh
npm run test:baseline
npm run eval:baseline
```

The default replay uses 16 synthetic development cases and makes **no network
requests**, reads no credentials, and writes no database records. It replays
interim replacements and finalized text against the actual live detector, then
checks fixture medication lists against the existing medication checker.

Reports are timestamped JSON files in `eval/results/` (ignored by Git). Reports
contain case IDs, counts, timings and assertion outcomes, not transcripts,
patient identifiers, raw model responses or provider error messages. Expected
alerts represent active medication proposals, so historical/negated mentions
show up as false positives rather than passing as desired behavior.

Detector p50/p95 measures synchronous computation only. Fixture timestamps order
events; replay does not sleep between them. This is not audio-to-alert, DOM
rendering, or a realistic concurrency/load benchmark. React development renders
may run a detector multiple times; client logs count evaluations, not encounters.

## Enable production-path measurements

Set these variables in your local environment, then restart the development app:

```text
MEDIFLOW_METRICS=1
NEXT_PUBLIC_MEDIFLOW_METRICS=1
```

Server extraction logs use `event: mediflow.extraction` and record route,
model/prompt version, logical provider-call attempt, elapsed/provider duration,
input character count, segment/operation counts, success/failure stage and
provider-reported input/output/cached tokens. Missing usage is `null`, not zero.
Authorized skipped or failed requests are recorded. Authentication rejection is
outside the extraction measurement. A malformed HTTP request is a request-stage
failure. Metrics are disabled by default and logging errors are non-blocking.

Browser logs use `event: mediflow.allergy_check` and record the transcript or
medication path, detector duration and counts. They contain no drug names or
transcript strings. This step does not add a telemetry ingestion endpoint or
patient/session correlation IDs. Keep full request-body logging disabled in your
hosting environment independently of these safe metric records.

## Optional live extraction replay

```sh
npm run eval:baseline -- --live --mode delta --limit 3
npm run eval:baseline -- --live --mode both
```

`--live` explicitly makes billable Groq requests using `GROQ_API_KEY` from the
environment or `.env.local`. The default model is unchanged. Each finalized
segment is one logical delta call with the previous merged result, and full mode
uses all finalized text. Full replay skips fixtures that need an initial EMR,
because the existing final-call contract does not receive that state. Actual
production backlog coalescing, SDK retry attempts, ASR quality, ICD enrichment,
auth, persistence, audit and rendering are not simulated. The timeout is 30s per
SDK attempt; the SDK's existing retry defaults are retained. Failed cases are
reported separately and excluded from successful-case assertion accuracy.

Gold assertions check selected fields after whitespace/case normalization.
Medication gold paths currently assume the fixture's first medication. They are
not synonym-aware and do not establish comprehensive clinical precision/recall.
Keep these cases for development; add separately held-out cases before tuning.

Token and latency totals are available only for actual provider calls. If any
call's usage is missing, token totals and estimated cost stay unknown. Optional
`--input-price` and `--output-price` take your chosen USD rates per million tokens
and report estimated list price without cache discounts, not actual billed cost.
No pricing is hardcoded. Reports contain fixture and prompt hashes for comparison.

## What to compare next

Compare unchanged fixtures, prompt hashes, routes and modes between revisions.
Track alert TP/FP/FN/TN, extraction failures, selected gold assertion accuracy,
logical calls, actual tokens and provider latency separately. Do not interpret
passing instrumentation tests as passing the clinical scenarios: the offline
report intentionally exposes known misses and false alerts.

The Node 20 runner uses a development-only CommonJS loader with the already
installed TypeScript compiler. It transpiles imported TypeScript in memory;
`npx tsc --noEmit --incremental false` remains the separate type check.
