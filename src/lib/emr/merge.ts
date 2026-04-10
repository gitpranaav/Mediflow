import type { EMRMedication, EMROp, EMRSnapshot } from "@/src/lib/emr/types";

import { normalizeMedicationsArray } from "./normalizeMedications";

function ensureArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return [];
}

/** Parse paths like vitals.bp_systolic, medications[0], medications[0].dosage */
export function parsePath(path: string): Array<string | number> {
  const out: Array<string | number> = [];
  const parts = path.split(".").filter(Boolean);
  for (const part of parts) {
    const bracketed = part.match(/^([a-zA-Z0-9_]+)\[(\d+)\]$/);
    if (bracketed) {
      out.push(bracketed[1], Number(bracketed[2]));
      continue;
    }
    out.push(part);
  }
  return out;
}

function emptyMedSlot(): EMRMedication {
  return {
    name: "",
    dosage: "",
    frequency: "",
    duration: "",
    route: "",
    instructions: "",
    icd10_code: "",
    icd10_description: "",
  };
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
    obj = obj?.[k as keyof typeof obj];
    if (obj == null) return;
  }
  const last = keys[keys.length - 1];
  if (typeof last === "number") {
    if (Array.isArray(obj)) obj.splice(last, 1);
  } else {
    if (obj && typeof obj === "object") delete obj[last];
  }
}

function coerceMedPartial(partial: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(partial)) {
    if (v === undefined || v === null) continue;
    const s = typeof v === "string" ? v.trim() : String(v).trim();
    if (!s) continue;
    out[k] = s;
  }
  return out;
}

function mergeMedicationIndex(root: EMRSnapshot, index: number, partial: Record<string, unknown>) {
  if (!Array.isArray(root.medications)) root.medications = [];
  while (root.medications.length <= index) {
    root.medications.push(emptyMedSlot());
  }
  const prev = root.medications[index] ?? emptyMedSlot();
  const coerced = coerceMedPartial(partial);
  root.medications[index] = { ...prev, ...coerced } as EMRMedication;
}

export function applyEMROps(snapshot: EMRSnapshot | null | undefined, ops: EMROp[]) {
  const next: EMRSnapshot = JSON.parse(JSON.stringify(snapshot ?? {}));
  const needs = new Set<string>(ensureArray(next.needs_confirmation).filter((x) => typeof x === "string") as string[]);

  for (const op of ops ?? []) {
    if (!op || typeof op !== "object") continue;
    if (op.op === "set_fact" || op.op === "update_fact") {
      const medWhole = op.path.match(/^medications\[(\d+)\]$/);
      if (medWhole && op.value && typeof op.value === "object" && !Array.isArray(op.value)) {
        mergeMedicationIndex(next, Number(medWhole[1]), op.value as Record<string, unknown>);
        needs.delete(op.path);
        continue;
      }

      if (op.op === "set_fact" && op.path === "medications" && Array.isArray(op.value)) {
        next.medications = normalizeMedicationsArray(op.value);
        needs.delete(op.path);
        continue;
      }

      setAtPath(next as any, op.path, op.value);
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
