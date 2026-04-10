/** First ICD-10-CM hit from NIH Clinical Tables (same source as /api/icd/search). */
export async function nihIcdFirstMatch(query: string): Promise<{ code: string; description: string } | null> {
  const q = query.trim();
  if (q.length < 2) return null;
  try {
    const nihUrl = `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&terms=${encodeURIComponent(q)}&maxList=8`;
    const res = await fetch(nihUrl);
    const fallbackData = (await res.json()) as unknown[];
    const rows = Array.isArray(fallbackData?.[3]) ? (fallbackData[3] as [string, string][]) : [];
    const first = rows[0];
    if (!first?.[0]) return null;
    return { code: first[0], description: String(first[1] ?? "") };
  } catch {
    return null;
  }
}
