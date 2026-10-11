type Assertion = { path: string; value?: unknown; absent?: boolean };

export function atPath(value: unknown, path: string): unknown {
  return path.replace(/\[(\d+)\]/g, ".$1").split(".").reduce<unknown>((current, key) => {
    if (current === null || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

function normalized(value: unknown): unknown {
  if (typeof value === "string") return value.trim().toLowerCase().replace(/\s+/g, " ");
  if (Array.isArray(value)) return value.map(normalized);
  return value;
}

/** Gold assertions, not a claim of comprehensive clinical precision/recall. */
export function scoreAssertions(snapshot: unknown, assertions: Assertion[]) {
  return assertions.map((assertion) => {
    const actual = atPath(snapshot, assertion.path);
    const passed = assertion.absent
      ? actual == null || actual === "" || (Array.isArray(actual) && actual.length === 0)
      : JSON.stringify(normalized(actual)) === JSON.stringify(normalized(assertion.value));
    return { path: assertion.path, passed, kind: assertion.absent ? "absence" : "value" };
  });
}

export function summarizeChecks(checks: Array<{ expected: boolean; actual: boolean }>) {
  const tp = checks.filter((c) => c.expected && c.actual).length;
  const fp = checks.filter((c) => !c.expected && c.actual).length;
  const fn = checks.filter((c) => c.expected && !c.actual).length;
  const tn = checks.filter((c) => !c.expected && !c.actual).length;
  return { tp, fp, fn, tn, precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null };
}

export function percentile(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}
