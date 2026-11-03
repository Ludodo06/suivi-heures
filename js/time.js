// Date and duration helpers. No access to the page or to the storage here.

const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;

const pad = (value) => String(value).padStart(2, "0");

/**
 * Returns the start of the day of a date (local time).
 *
 * Args:
 *   date: Any moment of the day.
 *
 * Returns:
 *   A new Date at 00:00.
 */
export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Returns the Monday 00:00 of the week of a date (local time).
 *
 * Args:
 *   date: Any moment of the week.
 *
 * Returns:
 *   A new Date on the Monday at 00:00.
 */
export function startOfWeek(date) {
  const daysSinceMonday = (date.getDay() + 6) % 7;
  return addDays(startOfDay(date), -daysSinceMonday);
}

/**
 * Moves a date by a number of days. It stays correct on clock change days.
 *
 * Args:
 *   date: The date to move.
 *   days: The number of days, negative to go back.
 *
 * Returns:
 *   A new Date.
 */
export function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Returns the key of a day.
 *
 * Args:
 *   date: Any moment of the day.
 *
 * Returns:
 *   A text like "2026-11-03". Sorting these texts also sorts the days.
 */
export function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Reads a day key.
 *
 * Args:
 *   key: A text like "2026-11-03".
 *
 * Returns:
 *   A new Date at 00:00 on that day (local time).
 */
export function parseKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Formats a duration with hours and minutes.
 *
 * Args:
 *   duration: The duration in milliseconds.
 *
 * Returns:
 *   A text like "7h 05m".
 */
export function formatHoursMinutes(duration) {
  const hours = Math.floor(duration / MS_PER_HOUR);
  const minutes = Math.floor((duration % MS_PER_HOUR) / MS_PER_MINUTE);
  return `${hours}h ${pad(minutes)}m`;
}

/**
 * Formats a duration that can be negative, always with its sign.
 *
 * Args:
 *   duration: The duration in milliseconds.
 *
 * Returns:
 *   A text like "+0h 30m" or "-1h 20m".
 */
export function formatSigned(duration) {
  return `${duration < 0 ? "-" : "+"}${formatHoursMinutes(Math.abs(duration))}`;
}

/**
 * Formats a duration with hours, minutes and seconds.
 *
 * Args:
 *   duration: The duration in milliseconds.
 *
 * Returns:
 *   A text like "7h 05m 12s".
 */
export function formatWithSeconds(duration) {
  const seconds = Math.floor((duration % MS_PER_MINUTE) / MS_PER_SECOND);
  return `${formatHoursMinutes(duration)} ${pad(seconds)}s`;
}

/**
 * Formats the time of day of a date.
 *
 * Args:
 *   date: The date to format.
 *
 * Returns:
 *   A text like "08:30".
 */
export function formatClock(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Formats a day for the page.
 *
 * Args:
 *   date: The date to format.
 *
 * Returns:
 *   A text like "mar. 3 nov.".
 */
export function formatDay(date) {
  return date.toLocaleDateString("fr-CH", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Formats a day in full.
 *
 * Args:
 *   date: The date to format.
 *
 * Returns:
 *   A text like "mardi 3 novembre".
 */
export function formatLongDay(date) {
  return date.toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long" });
}
