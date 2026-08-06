export type DayHours = { dayOfWeek: number; isOpen: boolean; openTime: string | null; closeTime: string | null };

const DEFAULT_OPEN_HOUR = 7;
const DEFAULT_CLOSE_HOUR = 23;

function parseMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h! * 60 + (m || 0);
}

// startHour/endHour are floor/ceil-rounded to the whole hour -- Timeline,
// Reports, and the Dashboard only render whole-hour axis marks, so a chart
// window only needs to fully contain the real (possibly half-hour) range.
// startMinutes/endMinutes carry the exact value for anything that actually
// books against it (slot generation).
export function getHoursForDay(
  hours: DayHours[],
  dayOfWeek: number
): { isOpen: boolean; startHour: number; endHour: number; startMinutes: number; endMinutes: number } {
  const day = hours.find((h) => h.dayOfWeek === dayOfWeek);
  if (!day) {
    return {
      isOpen: true,
      startHour: DEFAULT_OPEN_HOUR,
      endHour: DEFAULT_CLOSE_HOUR,
      startMinutes: DEFAULT_OPEN_HOUR * 60,
      endMinutes: DEFAULT_CLOSE_HOUR * 60,
    };
  }
  if (!day.isOpen || !day.openTime || !day.closeTime) {
    return { isOpen: false, startHour: 0, endHour: 0, startMinutes: 0, endMinutes: 0 };
  }
  const startMinutes = parseMinutes(day.openTime);
  const endMinutes = parseMinutes(day.closeTime);
  return {
    isOpen: true,
    startHour: Math.floor(startMinutes / 60),
    endHour: Math.ceil(endMinutes / 60),
    startMinutes,
    endMinutes,
  };
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
