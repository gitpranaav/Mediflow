import type { Db } from "mongodb";

import type { EMRMedication, EMRSnapshot } from "@/src/lib/emr/types";

import { resolveIcdForMedication } from "./resolveForMedication";

/** Fill empty medication ICD fields using diagnosis, chief complaint, patterns, local DB, then NIH. */
export async function enrichMedicationsWithIcd(db: Db, snapshot: EMRSnapshot): Promise<EMRSnapshot> {
  const meds = snapshot.medications ?? [];
  if (!meds.length) return snapshot;

  const nextMeds: EMRMedication[] = [];

  for (const m of meds) {
    const name = (m.name ?? "").trim();
    if (!name || String(m.icd10_code ?? "").trim()) {
      nextMeds.push(m);
      continue;
    }
    const hit = await resolveIcdForMedication(db, snapshot, name);
    if (!hit) {
      nextMeds.push(m);
      continue;
    }
    nextMeds.push({
      ...m,
      icd10_code: hit.code,
      icd10_description: hit.description,
      confidence: "low",
    });
  }

  return { ...snapshot, medications: nextMeds };
}
