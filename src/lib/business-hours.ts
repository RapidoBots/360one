export type DayHours = { dayOfWeek: number; isOpen: boolean; openTime: string | null; closeTime: string | null };

// ponytail: whole-hour precision only -- the Settings UI offers an
// on-the-hour picker, since every hour-bucketing consumer (Timeline,
// Reports, Dashboard) already only renders whole-hour marks and finer
// precision would be discarded downstream anyway.
const DEFAULT_OPEN_HOUR = 7;
const DEFAULT_CLOSE_HOUR = 23;

function parseHour(time: string): number {
  return Number(time.split(":")[0]);
}

export function getHoursForDay(
  hours: DayHours[],
  dayOfWeek: number
): { isOpen: boolean; startHour: number; endHour: number } {
  const day = hours.find((h) => h.dayOfWeek === dayOfWeek);
  if (!day) return { isOpen: true, startHour: DEFAULT_OPEN_HOUR, endHour: DEFAULT_CLOSE_HOUR };
  if (!day.isOpen || !day.openTime || !day.closeTime) return { isOpen: false, startHour: 0, endHour: 0 };
  return { isOpen: true, startHour: parseHour(day.openTime), endHour: parseHour(day.closeTime) };
}

export function getWidestOpenWindow(hours: DayHours[]): { startHour: number; endHour: number } {
  const openDays = Array.from({ length: 7 }, (_, dayOfWeek) => getHoursForDay(hours, dayOfWeek)).filter(
    (d) => d.isOpen
  );
  if (openDays.length === 0) return { startHour: DEFAULT_OPEN_HOUR, endHour: DEFAULT_CLOSE_HOUR };
  return {
    startHour: Math.min(...openDays.map((d) => d.startHour)),
    endHour: Math.max(...openDays.map((d) => d.endHour)),
  };
}
