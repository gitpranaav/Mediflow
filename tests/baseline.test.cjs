const test = require('node:test');
const assert = require('node:assert/strict');
const { startExtractionMetric, measureAllergyCheck, tokenUsage } = require('../src/lib/observability/baseline.ts');
const { detectRealtimeAllergyAlert } = require('../src/lib/clinical/realtimeAllergyAlert.ts');
const { buildDeltaExtractionRequest, buildFullExtractionRequest } = require('../src/lib/emr/extractionRequest.ts');
const { scoreAssertions, summarizeChecks, percentile } = require('../src/lib/evaluation/baselineScoring.ts');
const { parseArgs, summarizeMetrics, extract } = require('../scripts/eval/baseline.cjs');
const fixtures = require('../eval/fixtures/baseline.json');

test('metrics retain usage without clinical payload or patient identifiers', () => {
  const events = [];
  const metric = startExtractionMetric('delta', (event) => events.push(event));
  metric.providerStart({ model: 'baseline-model', messages: [{ content: 'SECRET PATIENT TRANSCRIPT' }] }, 'baseline-v1', 2);
  metric.providerEnd({ prompt_tokens: 20, completion_tokens: 5, total_tokens: 25, prompt_tokens_details: { cached_tokens: 10 } });
  metric.success(3); metric.finish(); metric.finish();
  assert.equal(events.length, 1);
  assert.equal(events[0].input_tokens, 20);
  assert.equal(events[0].cached_input_tokens, 10);
  assert.equal(events[0].operation_count, 3);
  assert.equal(events[0].outcome, 'success');
  assert.ok(events[0].provider_duration_ms >= 0);
  assert.ok(!JSON.stringify(events).includes('SECRET'));
  assert.equal(events[0].consultation_id, undefined);
});

test('missing usage stays unknown and zero usage is preserved', () => {
  assert.equal(tokenUsage().input_tokens, null);
  assert.equal(tokenUsage({ prompt_tokens: 0 }).input_tokens, 0);
  assert.equal(tokenUsage({ prompt_tokens: NaN }).input_tokens, null);
  assert.equal(tokenUsage({ prompt_tokens_details: null }).cached_input_tokens, null);
});

test('live replay scores actual provider responses and rejects truncation/invalid JSON', async () => {
  const request = buildDeltaExtractionRequest({ segments_delta: [{ id: 's1', text: 'synthetic' }] });
  const responses = [
    { choices: [{ finish_reason: 'stop', message: { content: '{"operations":[]}' } }], usage: { prompt_tokens: 20, completion_tokens: 5 } },
    { choices: [{ finish_reason: 'length', message: { content: '{"operations":[]}' } }] },
    { choices: [{ finish_reason: 'stop', message: { content: '{bad json' } }] },
  ];
  const metrics = [];
  const groq = { chat: { completions: { create: async (actualRequest) => {
    assert.equal(actualRequest, request); return responses.shift();
  } } } };
  assert.deepEqual(await extract(groq, 'delta', request, 1, metrics), { operations: [] });
  assert.equal(await extract(groq, 'delta', request, 1, metrics), null);
  assert.equal(await extract(groq, 'delta', request, 1, metrics), null);
  assert.deepEqual(metrics.map((m) => m.outcome), ['success', 'failed', 'failed']);
  assert.equal(metrics[0].input_tokens, 20);
});

test('live replay failures never leak raw provider error text', async () => {
  const metrics = [];
  const groq = { chat: { completions: { create: async () => { throw new Error('SECRET RESPONSE'); } } } };
  assert.equal(await extract(groq, 'full', buildFullExtractionRequest({}), undefined, metrics), null);
  assert.equal(metrics[0].failure_stage, 'provider');
  assert.ok(!JSON.stringify(metrics).includes('SECRET'));
});

test('provider failures and skipped requests are distinguishable', () => {
  const events = [];
  const failed = startExtractionMetric('full', (event) => events.push(event));
  failed.providerStart({ model: 'baseline', messages: [] }, 'baseline-v1'); failed.finish();
  const skipped = startExtractionMetric('delta', (event) => events.push(event));
  skipped.skip(); skipped.finish();
  assert.equal(events[0].failure_stage, 'provider');
  assert.equal(events[0].input_tokens, null);
  assert.equal(events[1].outcome, 'skipped');
  assert.equal(events[1].provider_call_attempted, false);
});

test('logging failure never changes extraction or allergy results', () => {
  const broken = () => { throw new Error('sink unavailable'); };
  const metric = startExtractionMetric('full', broken);
  metric.success(); assert.doesNotThrow(() => metric.finish());
  assert.equal(measureAllergyCheck(() => 'warning', { path: 'transcript', allergy_count: 1 }, () => 1, broken), 'warning');
});

test('allergy metrics contain counts rather than warning content', () => {
  const events = [];
  measureAllergyCheck(() => 'SECRET DRUG', { path: 'transcript', input_chars: 12, allergy_count: 1 }, () => 1, (event) => events.push(event));
  assert.equal(events[0].alert_count, 1);
  assert.ok(!JSON.stringify(events).includes('SECRET'));
});

test('request builders preserve baseline fields and exclude client-only metadata', () => {
  const request = buildDeltaExtractionRequest({ segments_delta: [{ id: 's1', text: 'test', speaker: 'doctor', timestamp: 'private' }], patient_allergies: [' Penicillin ', ''] });
  const input = JSON.parse(request.messages[1].content);
  assert.deepEqual(input.segments_delta, [{ id: 's1', text: 'test', confidence: null, language: null, start_ms: null, end_ms: null }]);
  assert.deepEqual(input.patient_allergies, ['Penicillin']);
  assert.equal(request.model, 'llama-3.3-70b-versatile');
  assert.deepEqual(JSON.parse(buildFullExtractionRequest({ transcript_text: 'test' }).messages[1].content), { transcript_text: 'test', patient_context: {} });
});

test('baseline retains known negation false positive and non-penicillin miss', () => {
  assert.ok(detectRealtimeAllergyAlert(['Penicillin'], 'Do not prescribe amoxicillin'));
  assert.equal(detectRealtimeAllergyAlert(['Ibuprofen'], 'Start ibuprofen'), null);
  assert.equal(detectRealtimeAllergyAlert(['Penicillin'], 'Start azithromycin'), null);
});

test('scoring handles missing fields, whitespace and absent predictions', () => {
  assert.deepEqual(scoreAssertions({ medications: [{ name: ' Amoxicillin ' }] }, [
    { path: 'medications[0].name', value: 'amoxicillin' }, { path: 'medications[0].dosage', absent: true },
  ]).map((r) => r.passed), [true, true]);
  assert.equal(scoreAssertions({}, [{ path: 'vitals.pulse_rate', value: 72 }])[0].passed, false);
  assert.equal(summarizeChecks([]).precision, null);
  assert.equal(summarizeChecks([{ expected: true, actual: false }]).fn, 1);
  assert.equal(percentile([], 0.95), null);
  assert.equal(percentile([3, 1, 2], 0.95), 3);
});

test('fixtures cover interim revisions, fragmented prescriptions and absent facts', () => {
  assert.equal(new Set(fixtures.cases.map((c) => c.id)).size, fixtures.cases.length);
  for (const fixture of fixtures.cases) {
    assert.ok(fixture.gold.length);
    assert.ok(fixture.events.some((e) => e.final));
    assert.ok(fixture.events.every((e, i) => i === 0 || e.at_ms >= fixture.events[i - 1].at_ms));
  }
  assert.ok(fixtures.cases.some((c) => c.events.some((e) => !e.final)));
  assert.ok(fixtures.cases.some((c) => c.gold.some((a) => a.absent)));
});

test('live mode is explicit and incomplete token totals/cost stay unknown', () => {
  assert.equal(parseArgs([]).live, false);
  assert.throws(() => parseArgs(['--limit', 'NaN']));
  assert.throws(() => parseArgs(['--input-price', '1']));
  const summary = summarizeMetrics([{ provider_call_attempted: true, input_tokens: null, output_tokens: null, cached_input_tokens: null, provider_duration_ms: 2, outcome: 'failed' }], { inputPrice: 1, outputPrice: 2 });
  assert.equal(summary.input_tokens, null);
  assert.equal(summary.estimated_list_price_usd, null);
  assert.equal(summary.failed_requests, 1);
});
