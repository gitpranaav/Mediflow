export type TokenUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number } | null;
};

export type MetricSink = (event: Record<string, unknown>) => void;

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function tokenUsage(usage?: TokenUsage | null) {
  return {
    input_tokens: count(usage?.prompt_tokens),
    output_tokens: count(usage?.completion_tokens),
    total_tokens: count(usage?.total_tokens),
    cached_input_tokens: count(usage?.prompt_tokens_details?.cached_tokens),
  };
}

/** Optional logs contain only explicit scalar fields, never prompts, errors or patient IDs. */
function consoleSink(event: Record<string, unknown>) {
  console.info(JSON.stringify(event));
}

export function startExtractionMetric(route: "delta" | "full", sink?: MetricSink) {
  const started = performance.now();
  let providerStarted: number | null = null;
  let providerMs: number | null = null;
  let usage: TokenUsage | null = null;
  let model: string | null = null;
  let promptVersion: string | null = null;
  let inputChars: number | null = null;
  let segmentCount: number | null = null;
  let operationCount: number | null = null;
  let outcome: "success" | "failed" | "skipped" = "failed";
  let failureStage = "request";
  let finished = false;
  return {
    providerStart(request: { model: string; messages: Array<{ content: string }> }, version: string, segments?: number) {
      model = request.model;
      promptVersion = version;
      inputChars = request.messages.reduce((sum, message) => sum + message.content.length, 0);
      segmentCount = count(segments);
      failureStage = "provider";
      providerStarted = performance.now();
    },
    providerEnd(value?: TokenUsage | null) {
      providerMs = providerStarted === null ? null : performance.now() - providerStarted;
      usage = value ?? null;
      failureStage = "parse_and_merge";
    },
    stage(value: "persistence" | "audit") { failureStage = value; },
    success(operations?: number) { outcome = "success"; operationCount = count(operations); },
    skip() { outcome = "skipped"; },
    finish() {
      if (finished) return;
      finished = true;
      const event = {
        event: "mediflow.extraction", schema_version: 1, route, model,
        prompt_version: promptVersion, outcome,
        failure_stage: outcome === "failed" ? failureStage : null,
        duration_ms: performance.now() - started,
        provider_duration_ms: providerMs ?? (providerStarted === null ? null : performance.now() - providerStarted),
        provider_call_attempted: providerStarted !== null,
        input_chars: inputChars, segment_count: segmentCount, operation_count: operationCount,
        ...tokenUsage(usage),
      };
      // Logging failure must never turn a successful clinical write into an HTTP error.
      try { if (sink) sink(event); else if (process.env.MEDIFLOW_METRICS === "1") consoleSink(event); } catch { /* best effort */ }
    },
  };
}

export function measureAllergyCheck<T>(
  check: () => T,
  metadata: { path: "transcript" | "medications"; input_chars?: number; allergy_count: number; medication_count?: number },
  alerts: (result: T) => number,
  sink?: MetricSink,
): T {
  if (!sink && process.env.NEXT_PUBLIC_MEDIFLOW_METRICS !== "1") return check();
  const started = performance.now();
  const result = check();
  const event = {
    event: "mediflow.allergy_check", schema_version: 1, path: metadata.path,
    duration_ms: performance.now() - started, alert_count: count(alerts(result)),
    input_chars: count(metadata.input_chars), allergy_count: count(metadata.allergy_count),
    medication_count: count(metadata.medication_count),
  };
  try { (sink ?? consoleSink)(event); } catch { /* best effort */ }
  return result;
}
