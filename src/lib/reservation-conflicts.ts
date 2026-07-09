export type TimeRange = { startsAt: Date; durationMinutes: number };

export function doesOverlap(a: TimeRange, b: TimeRange): boolean {
  const aStart = a.startsAt.getTime();
  const aEnd = aStart + a.durationMinutes * 60_000;
  const bStart = b.startsAt.getTime();
  const bEnd = bStart + b.durationMinutes * 60_000;
  return aStart < bEnd && bStart < aEnd;
}
