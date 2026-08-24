/**
 * Build the data fields to write when the AI mitigation generator emits a
 * fresh treatment plan. Always lands the plan under the `mitigate` slot
 * (the plan IS a mitigation plan), forces the active strategy to
 * mitigate so the user sees the new plan in the correct column, and
 * preserves any existing non-mitigate description under its own slot so
 * the user's prior Accept / Transfer / Avoid rationale isn't lost.
 *
 * Used by both generate-risk-mitigation and generate-vendor-mitigation.
 * Without this guarantee, entities created with a non-mitigate default
 * have the AI plan stored under the wrong strategy and switching back
 * to mitigate looks empty (the bug fixed in this commit).
 */
export function applyMitigationPlanFields({
  plan,
  currentStrategy,
  currentDescription,
  currentMap,
}: {
  plan: string;
  currentStrategy: string;
  currentDescription: string | null;
  currentMap: unknown;
}): {
  treatmentStrategy: 'mitigate';
  treatmentStrategyDescription: string;
  strategyDescriptions: Record<string, string>;
} {
  const map: Record<string, string> = {};
  if (currentMap && typeof currentMap === 'object' && !Array.isArray(currentMap)) {
    for (const [k, v] of Object.entries(currentMap as Record<string, unknown>)) {
      if (typeof v === 'string' && v.length > 0) map[k] = v;
    }
  }
  if (currentStrategy !== 'mitigate' && currentDescription && currentDescription.length > 0) {
    map[currentStrategy] = currentDescription;
  }
  map.mitigate = plan;
  return {
    treatmentStrategy: 'mitigate',
    treatmentStrategyDescription: plan,
    strategyDescriptions: map,
  };
}
