/** Today in the user's time zone, as `YYYY-MM-DD` (value of a date input). */
export function todayIsoDate(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** `YYYY-MM-DD` date shifted by `days` (calendar arithmetic, no time zone involved). */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` part of a backend date (dates are stored at midnight UTC). */
export function toDateInput(value: string | undefined | null): string {
  return value ? value.slice(0, 10) : '';
}
