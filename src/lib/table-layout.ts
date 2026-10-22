// Pure geometry/layout helpers for rendering a table on the Floor Manager
// canvas -- kept separate from table-status.ts (which is about booking
// status, not visual layout).

// Metres -- was pixels (56/80/96) before the floor plan moved to a real 3D
// room; same proportions at the 80px-per-metre ratio the 3D view renders at.
const SIZE_TIERS = [
  { maxCapacity: 2, size: 0.7 },
  { maxCapacity: 4, size: 1.0 },
  { maxCapacity: Infinity, size: 1.2 },
];

// Null width/height means "use the capacity-based default" -- the original
// behavior, before freeform resizing existed.
export function getEffectiveSize(
  capacity: number,
  width: number | null,
  height: number | null
): { width: number; height: number } {
  const defaultSize = SIZE_TIERS.find((t) => capacity <= t.maxCapacity)!.size;
  return { width: width ?? defaultSize, height: height ?? defaultSize };
}

export type ChairCounts = { top: number; right: number; bottom: number; left: number };

// Null on all four means "auto-distribute evenly by capacity" -- the
// original behavior, before per-side chair placement existed. Any side
// explicitly set (including 0, e.g. "no chairs against the wall") means the
// owner has customized placement, so all four are read as explicit (missing
// ones default to 0 rather than falling back to auto-distribute).
export function getChairCounts(
  capacity: number,
  chairsTop: number | null,
  chairsRight: number | null,
  chairsBottom: number | null,
  chairsLeft: number | null
): ChairCounts {
  const explicit = [chairsTop, chairsRight, chairsBottom, chairsLeft].some((c) => c !== null);
  if (explicit) {
    return {
      top: chairsTop ?? 0,
      right: chairsRight ?? 0,
      bottom: chairsBottom ?? 0,
      left: chairsLeft ?? 0,
    };
  }
  const counts: ChairCounts = { top: 0, right: 0, bottom: 0, left: 0 };
  const sides: (keyof ChairCounts)[] = ["top", "right", "bottom", "left"];
  for (let i = 0; i < capacity; i++) counts[sides[i % 4]!]++;
  return counts;
}
