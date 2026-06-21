/**
 * Normalizes framework display strings from API/DB/config so SOC 2 is always shown consistently.
 */
export function normalizeFrameworkLabel(label: string): string {
  return label
    .replace(/soc\s*2\s*(type\s*(i{1,2}|1|2))?/gi, 'SOC 2')
    .trim();
}
