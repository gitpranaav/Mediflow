import type { Db } from "mongodb";

import type { EMRSnapshot } from "@/src/lib/emr/types";

import { buildIcdQueryPhrases } from "./icdQueryPhrases";
import { findFirstIcdMatch } from "./mongoMatch";
import { nihIcdFirstMatch } from "./nihSearch";

/** Resolve best ICD-10 for a medication row: local DB first, then NIH, trying several clinical phrases. */
export async function resolveIcdForMedication(
  db: Db,
  snapshot: EMRSnapshot,
  medName: string
): Promise<{ code: string; description: string } | null> {
  for (const q of buildIcdQueryPhrases(snapshot, medName)) {
    const local = await findFirstIcdMatch(db, q);
    if (local) return local;
    const nih = await nihIcdFirstMatch(q);
    if (nih) return nih;
  }
  return null;
}
