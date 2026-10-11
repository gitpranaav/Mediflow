/** Existing live heuristic, extracted unchanged so synthetic events can replay it. */
export function detectRealtimeAllergyAlert(allergies: string[], liveTranscript: string): string | null {
  const text = liveTranscript.toLowerCase().trim();
  if (!text) return null;
  const allergyBlob = allergies.map((item) => String(item).toLowerCase().trim()).filter(Boolean).join(" ");
  if (!allergyBlob) return null;
  const hasPenicillinAllergy = /penicillin|pcn|beta[-\s]?lactam|β[-\s]?lactam/.test(allergyBlob);
  const mentionsPenicillinFamily = /penic[a-z]*|amoxi[a-z]*|ampi[a-z]*|piper[a-z]*|augmentin|clavulanate|cef[a-z]+/.test(text);
  if (hasPenicillinAllergy && mentionsPenicillinFamily) {
    return "Live allergy alert: beta-lactam/penicillin family drug mentioned in transcript. Verify before prescribing.";
  }
  return null;
}
