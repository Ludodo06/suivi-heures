// Date and duration helpers. No access to the page or to the storage here.

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

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
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysSinceMonday);
}

/**
 * Adds up the time of the sessions from a given moment until now.
 *
 * A session that starts before `from` only counts for its part after `from`.
 * So a night session is split correctly between two days.
 *
 * Args:
 *   sessions: The array of sessions.
 *   from: The start of the period.
 *   now: The current moment. It is the end of a session that still runs.
 *
 * Returns:
 *   The total duration in milliseconds.
 *
 * Example:
 *   A session from 23:00 to 01:00 gives 1 hour for the second day.
 */
export function totalSince(sessions, from, now) {
  let total = 0;
  for (const session of sessions) {
    const start = Math.max(new Date(session.start).getTime(), from.getTime());
    const end = session.end ? new Date(session.end).getTime() : now.getTime();
    total += Math.max(end - start, 0);
  }
  return total;
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
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
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
  return `${formatHoursMinutes(duration)} ${String(seconds).padStart(2, "0")}s`;
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
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
