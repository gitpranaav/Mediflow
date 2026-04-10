import type { EMRSnapshot } from "@/src/lib/emr/types";

/** Clinical phrases to try for ICD lookup (chart + heuristics). Safe for client or server. */
export function buildIcdQueryPhrases(snapshot: EMRSnapshot, medName: string): string[] {
  const out: string[] = [];
  const blob = [
    ...(snapshot.diagnosis_text ?? []).map((x) => String(x)),
    snapshot.chief_complaint ?? "",
    medName,
  ]
    .join(" ")
    .toLowerCase();

  for (const d of snapshot.diagnosis_text ?? []) {
    const t = String(d).trim();
    if (t.length >= 2) out.push(t);
  }
  const cc = (snapshot.chief_complaint ?? "").trim();
  if (cc.length >= 2) out.push(cc);

  if (/throat|sore throat|pharyngit|strep|tonsill/i.test(blob)) {
    out.push("Acute streptococcal pharyngitis", "Acute pharyngitis", "Streptococcal sore throat");
  }
  if (/uti|urinary|dysuria|cystitis|burning.*urin/i.test(blob)) {
    out.push("Urinary tract infection", "Acute cystitis");
  }
  if (/cough|cold|upper respiratory|uri\b/i.test(blob)) {
    out.push("Acute upper respiratory infection");
  }

  const mn = medName.trim();
  if (mn.length >= 2) out.push(mn);

  const seen = new Set<string>();
  return out.filter((q) => {
    const k = q.trim().toLowerCase();
    if (k.length < 2 || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
