// Table numbers are free-text ("1", "10", "Patio-3"), so a plain string sort
// puts "10" before "2". This compares alternating digit/non-digit chunks,
// treating digit chunks numerically, so "2" sorts before "10".
export function compareTableNumbers(a: string, b: string): number {
  const chunks = (s: string) => s.match(/\d+|\D+/g) ?? [];
  const aParts = chunks(a);
  const bParts = chunks(b);
  const len = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < len; i++) {
    const aPart = aParts[i] ?? "";
    const bPart = bParts[i] ?? "";
    const isNumeric = /^\d+$/.test(aPart) && /^\d+$/.test(bPart);
    const diff = isNumeric ? Number(aPart) - Number(bPart) : aPart.localeCompare(bPart);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function sortTablesByNumber<T extends { number: string }>(tables: T[]): T[] {
  return [...tables].sort((a, b) => compareTableNumbers(a.number, b.number));
}
