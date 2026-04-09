import type { EMROp, EMRSnapshot } from "@/src/lib/emr/types";

function ensureArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return [];
}

function parsePath(path: string): Array<string | number> {
  // Very small JSONPath-like parser: "vitals.bp_systolic" or "symptoms[0]"
  const out: Array<string | number> = [];
  const parts = path.split(".").filter(Boolean);
  for (const part of parts) {
    const match = part.match(/^([a-zA-Z0-9_]+)(\\[(\\d+)\\])?$/);
    if (!match) {
      out.push(part);
      continue;
    }
    out.push(match[1]);
    if (match[3]) out.push(Number(match[3]));
  }
  return out;
}

function setAtPath(root: any, path: string, value: unknown) {
  const keys = parsePath(path);
  let obj = root;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const k = keys[i];
    const next = keys[i + 1];
    if (typeof k === "number") {
      if (!Array.isArray(obj)) return;
      if (!obj[k]) obj[k] = typeof next === "number" ? [] : {};
      obj = obj[k];
    } else {
      if (obj[k] == null) obj[k] = typeof next === "number" ? [] : {};
      obj = obj[k];
    }
  }
  const last = keys[keys.length - 1];
  if (typeof last === "number") {
    if (!Array.isArray(obj)) return;
    obj[last] = value;
  } else {
    obj[last] = value;
  }
}

function deleteAtPath(root: any, path: string) {
  const keys = parsePath(path);
  let obj = root;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const k = keys[i];
    obj = obj?.[k as any];
    if (obj == null) return;
  }
  const last = keys[keys.length - 1];
  if (typeof last === "number") {
    if (Array.isArray(obj)) obj.splice(last, 1);
  } else {
    if (obj && typeof obj === "object") delete obj[last];
  }
}

export function applyEMROps(snapshot: EMRSnapshot | null | undefined, ops: EMROp[]) {
  const next: EMRSnapshot = JSON.parse(JSON.stringify(snapshot ?? {}));
  const needs = new Set<string>(ensureArray(next.needs_confirmation).filter((x) => typeof x === "string") as string[]);

  for (const op of ops ?? []) {
    if (!op || typeof op !== "object") continue;
    if (op.op === "set_fact" || op.op === "update_fact") {
      setAtPath(next as any, op.path, op.value);
      // If we have a value now, remove from needs_confirmation (best-effort).
      needs.delete(op.path);
      continue;
    }
    if (op.op === "retract_fact") {
      deleteAtPath(next as any, op.path);
      continue;
    }
    if (op.op === "mark_uncertain") {
      needs.add(op.path);
      continue;
    }
  }

  next.needs_confirmation = Array.from(needs);
  return next;
}

