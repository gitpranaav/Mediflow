# Initial offline allergy baseline

Measured on 7 October 2026 with `npm run eval:baseline`, before changing the
clinical heuristics. Dataset: 16 synthetic development cases, 20 transcript
events, and 16 medication-list checks from `fixtures/baseline.json`.

| Path | True positives | False positives | False negatives | True negatives | Precision | Recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Live transcript heuristic | 6 | 2 | 4 | 8 | 75% | 60% |
| Medication-list heuristic | 5 | 0 | 2 | 9 | 100% | 71.4% |

The transcript misses are sulfa, NSAID, opioid, and an uncovered direct allergy
(paracetamol). Its false alerts are negated and historical amoxicillin mentions.
The medication checker misses Augmentin and the uncovered direct allergy.
Interim correction and fragmented penicillin fixtures are also included.

These labels measure active medication proposals, so a generic mention alert is
counted as a false positive when no current prescription is proposed. This
defines the intended future behavior; it does not retroactively change the old
detector's implementation. Precision/recall is event-level for transcripts and
case-level for medication checks, not a clinical validation claim.

No live model requests were made for this initial run. LLM token usage, cost,
extraction quality, ASR delay and audio-to-visible-alert latency remain unmeasured.
Detector timings in generated JSON measure synchronous Node computation only.
Use the documented optional live replay to establish the extraction baseline.
