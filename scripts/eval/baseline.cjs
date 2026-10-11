require('./register.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { detectRealtimeAllergyAlert } = require('../../src/lib/clinical/realtimeAllergyAlert.ts');
const { findAllergyMedicationWarnings } = require('../../src/lib/clinical/allergyMedicationCheck.ts');
const { buildDeltaExtractionRequest, buildFullExtractionRequest, BASELINE_PROMPT_VERSION, BASELINE_MODEL } = require('../../src/lib/emr/extractionRequest.ts');
const { applyEMROps } = require('../../src/lib/emr/merge.ts');
const { normalizeMedicationsArray } = require('../../src/lib/emr/normalizeMedications.ts');
const { measureAllergyCheck, startExtractionMetric } = require('../../src/lib/observability/baseline.ts');
const { summarizeChecks, scoreAssertions, percentile } = require('../../src/lib/evaluation/baselineScoring.ts');
const root = path.resolve(__dirname, '../..');
const fixtures = JSON.parse(fs.readFileSync(path.join(root, 'eval/fixtures/baseline.json'), 'utf8'));

function parseArgs(args) {
  const options = { live: false, mode: 'both', limit: fixtures.cases.length, inputPrice: null, outputPrice: null };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--live') options.live = true;
    else if (arg === '--mode') options.mode = args[++i];
    else if (arg === '--limit') options.limit = Number(args[++i]);
    else if (arg === '--input-price') options.inputPrice = Number(args[++i]);
    else if (arg === '--output-price') options.outputPrice = Number(args[++i]);
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!['delta', 'full', 'both'].includes(options.mode)) throw new Error('--mode must be delta, full or both');
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > fixtures.cases.length) throw new Error('Invalid --limit');
  for (const price of [options.inputPrice, options.outputPrice]) {
    if (price !== null && (!Number.isFinite(price) || price < 0)) throw new Error('Prices must be non-negative numbers per million tokens');
  }
  if ((options.inputPrice === null) !== (options.outputPrice === null)) throw new Error('Supply both input and output prices');
  return options;
}

function summarizeMetrics(metrics, options) {
  const tokensKnown = metrics.every((m) => m.input_tokens !== null && m.output_tokens !== null);
  const input = tokensKnown && metrics.length ? metrics.reduce((sum, m) => sum + m.input_tokens, 0) : null;
  const output = tokensKnown && metrics.length ? metrics.reduce((sum, m) => sum + m.output_tokens, 0) : null;
  return {
    logical_provider_calls: metrics.filter((m) => m.provider_call_attempted).length,
    successful_requests: metrics.filter((m) => m.outcome === 'success').length,
    failed_requests: metrics.filter((m) => m.outcome === 'failed').length,
    calls_with_missing_usage: metrics.filter((m) => m.input_tokens === null || m.output_tokens === null).length,
    input_tokens: input, output_tokens: output,
    cached_input_tokens: metrics.length && metrics.every((m) => m.cached_input_tokens !== null)
      ? metrics.reduce((sum, m) => sum + m.cached_input_tokens, 0) : null,
    provider_p50_ms: percentile(metrics.map((m) => m.provider_duration_ms).filter((m) => m !== null), 0.5),
    provider_p95_ms: percentile(metrics.map((m) => m.provider_duration_ms).filter((m) => m !== null), 0.95),
    estimated_list_price_usd: input === null || options.inputPrice === null ? null
      : (input * options.inputPrice + output * options.outputPrice) / 1_000_000,
  };
}

async function extract(groq, route, request, segments, metrics) {
  const metric = startExtractionMetric(route, (event) => metrics.push(event));
  metric.providerStart(request, BASELINE_PROMPT_VERSION, segments);
  try {
    const response = await groq.chat.completions.create(request);
    metric.providerEnd(response.usage);
    if (response.choices[0]?.finish_reason !== 'stop') return null;
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? 'null');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if (route === 'delta' && !Array.isArray(parsed.operations)) return null;
    metric.success(route === 'delta' ? parsed.operations.length : undefined);
    return parsed;
  } catch { return null; }
  finally { metric.finish(); }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cases = fixtures.cases.slice(0, options.limit);
  let groq;
  if (options.live) {
    require('dotenv').config({ path: path.join(root, '.env.local'), quiet: true });
    if (!process.env.GROQ_API_KEY) throw new Error('Live replay requires GROQ_API_KEY');
    const Groq = require('groq-sdk').default;
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 30000 });
  }
  const report = {
    schema_version: 1, generated_at: new Date().toISOString(), mode: options.live ? 'live-synthetic' : 'offline-alerts',
    fixture_sha256: createHash('sha256').update(JSON.stringify(fixtures)).digest('hex'),
    model: BASELINE_MODEL, prompt_version: BASELINE_PROMPT_VERSION,
    prompt_sha256: {
      delta: createHash('sha256').update(buildDeltaExtractionRequest({ segments_delta: [] }).messages[0].content).digest('hex'),
      full: createHash('sha256').update(buildFullExtractionRequest({}).messages[0].content).digest('hex'),
    },
    limitations: [
      'Synthetic development fixtures; not a held-out clinical evaluation.',
      'Alert gold labels describe active proposals; mention-only false positives are intentionally counted.',
      'Alert latency is synchronous detector time, not audio-to-alert or browser rendering latency.',
      'Delta replay makes one logical call per finalized segment; production backlog coalescing is not simulated.',
      'Live extraction bypasses auth, database, ICD enrichment, audit, and browser rendering.',
      'Logical provider calls exclude any additional HTTP attempts from SDK retries.',
      'Gold assertion accuracy is selected-field exact matching, not comprehensive extraction precision/recall.',
      'Estimated list price uses supplied rates without cached-token discounts; it is not a billed cost.',
    ], cases: [],
  };
  const alertChecks = [], medicationChecks = [], alertMetrics = [], extractionMetrics = { delta: [], full: [] };
  for (const fixture of cases) {
    const metricOffsets = { delta: extractionMetrics.delta.length, full: extractionMetrics.full.length };
    const finalTexts = [], alertResults = [];
    let snapshot = fixture.initial_snapshot ?? {};
    let deltaFailed = false;
    const liveResults = {};
    for (let i = 0; i < fixture.events.length; i++) {
      const event = fixture.events[i];
      const text = [...finalTexts, event.text].join(' ');
      const alert = measureAllergyCheck(
        () => detectRealtimeAllergyAlert(fixture.allergies, text),
        { path: 'transcript', input_chars: text.length, allergy_count: fixture.allergies.length },
        (value) => value ? 1 : 0, (metric) => alertMetrics.push(metric),
      );
      const check = { expected: event.expected_alert, actual: Boolean(alert) };
      alertChecks.push(check);
      alertResults.push({ at_ms: event.at_ms, final: event.final, ...check });
      if (!event.final) continue;
      finalTexts.push(event.text);
      if (groq && options.mode !== 'full') {
        const request = buildDeltaExtractionRequest({
          segments_delta: [{ id: `${fixture.id}-${i}`, text: event.text, is_final: true }],
          emr_snapshot: snapshot, patient_allergies: fixture.allergies,
        });
        const result = await extract(groq, 'delta', request, 1, extractionMetrics.delta);
        if (result === null) { deltaFailed = true; continue; }
        try {
          snapshot = applyEMROps(snapshot, result.operations);
        } catch { deltaFailed = true; }
      }
    }
    const warnings = measureAllergyCheck(
      () => findAllergyMedicationWarnings(fixture.allergies, fixture.medications),
      { path: 'medications', allergy_count: fixture.allergies.length, medication_count: fixture.medications.length },
      (value) => value.length, (metric) => alertMetrics.push(metric),
    );
    const medCheck = { expected: fixture.expected_medication_alert, actual: warnings.length > 0 };
    medicationChecks.push(medCheck);
    if (groq && options.mode !== 'full') liveResults.delta = {
      status: deltaFailed ? 'failed' : 'success', assertions: deltaFailed ? [] : scoreAssertions(snapshot, fixture.gold),
    };
    if (groq && options.mode !== 'delta') {
      if (fixture.initial_snapshot) liveResults.full = { status: 'skipped', reason: 'Full baseline does not receive previous EMR state' };
      else {
        const transcript = fixture.events.filter((e) => e.final).map((e) => e.text).join(' ');
        const parsed = await extract(groq, 'full', buildFullExtractionRequest({ transcript_text: transcript }), undefined, extractionMetrics.full);
        liveResults.full = parsed === null ? { status: 'failed', assertions: [] } : {
          status: 'success', assertions: scoreAssertions({ ...parsed, diagnosis_text: parsed.diagnosis ?? [], medications: normalizeMedicationsArray(parsed.medications) }, fixture.gold),
        };
      }
    }
    for (const route of ['delta', 'full']) {
      if (liveResults[route]) liveResults[route].request_metrics = extractionMetrics[route].slice(metricOffsets[route]);
    }
    report.cases.push({ id: fixture.id, alerts: alertResults, medication_alert: medCheck, extraction: liveResults });
  }
  report.alerts = {
    transcript: summarizeChecks(alertChecks), medications: summarizeChecks(medicationChecks),
    detector_p50_ms: percentile(alertMetrics.map((m) => m.duration_ms), 0.5),
    detector_p95_ms: percentile(alertMetrics.map((m) => m.duration_ms), 0.95),
  };
  report.extraction = {};
  for (const route of ['delta', 'full']) {
    const results = report.cases.map((c) => c.extraction[route]).filter(Boolean);
    const assertions = results.flatMap((r) => r.assertions ?? []);
    report.extraction[route] = {
      ...summarizeMetrics(extractionMetrics[route], options),
      evaluated_cases: results.filter((r) => r.status === 'success').length,
      failed_cases: results.filter((r) => r.status === 'failed').length,
      skipped_cases: results.filter((r) => r.status === 'skipped').length,
      assertion_count: assertions.length,
      assertion_accuracy: assertions.length ? assertions.filter((a) => a.passed).length / assertions.length : null,
    };
  }
  const output = path.join(root, 'eval/results');
  fs.mkdirSync(output, { recursive: true });
  const filename = `${new Date().toISOString().replace(/[:.]/g, '-')}-${options.live ? 'live' : 'offline'}.json`;
  fs.writeFileSync(path.join(output, filename), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ report: `eval/results/${filename}`, alerts: report.alerts, extraction: report.extraction }, null, 2));
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { parseArgs, summarizeMetrics, extract };
