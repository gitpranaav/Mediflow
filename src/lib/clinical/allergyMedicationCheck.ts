import type { EMRMedication } from "@/src/lib/emr/types";

function norm(s: string) {
  return s.toLowerCase().trim();
}

/** Heuristic cross-allergy checks (not a substitute for clinical decision support). */
export function findAllergyMedicationWarnings(allergies: string[], medications: EMRMedication[]): string[] {
  if (!allergies?.length) return [];
  const blob = allergies.map((a) => norm(String(a))).filter(Boolean).join(" ");
  if (!blob) return [];

  const warnings: string[] = [];

  for (const med of medications) {
    const drug = norm(med.name || "");
    if (!drug) continue;

    const pen =
      blob.includes("penicillin") || blob.includes("pcn") || blob.includes("beta-lactam") || blob.includes("β-lactam");
    if (
      pen &&
      /amoxicillin|ampicillin|penicillin|piperacillin|tazobactam|cloxacillin|flucloxacillin|cephalexin|cefazolin|ceftriaxone|cefuroxime|cefepime|cef/i.test(
        drug
      )
    ) {
      warnings.push(`Allergy alert: ${med.name} may cross-react with beta-lactam allergy.`);
    }

    const sulfa =
      blob.includes("sulfa") ||
      blob.includes("sulpha") ||
      blob.includes("sulfonamide") ||
      blob.includes("sulfamethoxazole") ||
      blob.includes("cotrimoxazole");
    if (sulfa && /sulfamethoxazole|trimethoprim|cotrimoxazole|bactrim|sulfasalazine|dapsone|silver sulfadiazine/i.test(drug)) {
      warnings.push(`Allergy alert: ${med.name} may be contraindicated with sulfa allergy.`);
    }

    const aspirin =
      blob.includes("aspirin") ||
      blob.includes("salicylate") ||
      blob.includes("nsaid") ||
      blob.includes("ibuprofen") ||
      blob.includes("naproxen");
    if (
      aspirin &&
      /ibuprofen|naproxen|diclofenac|aspirin|ketorolac|celecoxib|meloxicam|indomethacin|nsaid/i.test(drug)
    ) {
      warnings.push(`Allergy alert: ${med.name} may be inappropriate with aspirin/NSAID allergy.`);
    }

    if (blob.includes("morphine") || blob.includes("opioid") || blob.includes("codeine")) {
      if (/morphine|codeine|oxycodone|hydrocodone|tramadol|fentanyl/i.test(drug)) {
        warnings.push(`Allergy alert: ${med.name} is an opioid — verify against recorded opioid allergy.`);
      }
    }
  }

  return [...new Set(warnings)];
}
