// All day/week math below uses Date's local-timezone methods (setHours,
// getDay, etc.), which resolve to the `TZ` env var the Node process was
// started with -- see .env.example. Every restaurant is currently assumed
// to be in that one timezone; a multi-timezone restaurant base would need
// per-restaurant timezone-aware date handling instead.
export function getDayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay(); // 0 = Sunday ... 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

// `date.toISOString().slice(0, 10)` converts to UTC first, which silently
// shifts to the wrong calendar day near local midnight whenever the local
// timezone offset is non-zero. This reads the LOCAL date components instead.
export function toLocalDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
