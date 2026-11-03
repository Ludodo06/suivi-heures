// Looks at the data to find averages, records and the next events.
// No access to the page or to the storage here.

import { holidaysOf } from "./holidays.js";
import { addDays, dateKey, parseKey, startOfWeek } from "./time.js";

const MS_PER_DAY = 86400000;

/**
 * Counts the days between two day keys.
 *
 * Args:
 *   fromKey: The key of the first day.
 *   toKey: The key of the second day.
 *
 * Returns:
 *   The number of days. It stays correct on clock change days.
 */
export function daysBetween(fromKey, toKey) {
  return Math.round((parseKey(toKey) - parseKey(fromKey)) / MS_PER_DAY);
}

/**
 * Finds the next public holiday on a working day.
 *
 * Args:
 *   today: The key of the current day.
 *
 * Returns:
 *   { key, name, days }, or null.
 */
export function nextHoliday(today) {
  const year = parseKey(today).getFullYear();
  const all = [...holidaysOf(year), ...holidaysOf(year + 1)].sort(([a], [b]) => a.localeCompare(b));
  for (const [key, name] of all) {
    const weekDay = parseKey(key).getDay();
    if (key > today && weekDay !== 0 && weekDay !== 6) {
      return { key, name, days: daysBetween(today, key) };
    }
  }
  return null;
}

/**
 * Finds the next planned vacation day.
 *
 * Args:
 *   absences: The absences of the data.
 *   today: The key of the current day.
 *
 * Returns:
 *   { key, days }, or null.
 */
export function nextVacation(absences, today) {
  const keys = Object.keys(absences)
    .filter((key) => key > today && (absences[key] === "vacation" || absences[key] === "halfVacation"))
    .sort();
  return keys.length ? { key: keys[0], days: daysBetween(today, keys[0]) } : null;
}

/**
 * Computes the averages and the records of a period.
 *
 * Args:
 *   calculator: The calculator of the data.
 *   fromKey: The key of the first day.
 *
 * Returns:
 *   An object with:
 *   - daysWorked, totalWorked, totalPause, bestDay: the basic counts. `bestDay`
 *     is the details of the longest day, or null.
 *   - averageWorked, averagePause: in milliseconds per worked day.
 *   - averageArrival, averageDeparture: minutes since midnight, or null.
 *   - byWeekDay: the average work in milliseconds, Monday first (7 values).
 */
export function periodStats(calculator, fromKey) {
  const stats = { daysWorked: 0, totalWorked: 0, totalPause: 0, bestDay: null };
  const arrivals = [];
  const departures = [];
  const weekDayTotals = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));

  for (let date = parseKey(fromKey); dateKey(date) <= calculator.today; date = addDays(date, 1)) {
    const info = calculator.day(dateKey(date));
    if (info.worked === 0) {
      continue;
    }
    stats.daysWorked += 1;
    stats.totalWorked += info.worked;
    stats.totalPause += info.pause;
    if (!stats.bestDay || info.worked > stats.bestDay.worked) {
      stats.bestDay = info;
    }
    arrivals.push(info.first.getHours() * 60 + info.first.getMinutes());
    if (info.key !== calculator.today && info.last) {
      departures.push(info.last.getHours() * 60 + info.last.getMinutes());
    }
    const bucket = weekDayTotals[(date.getDay() + 6) % 7];
    bucket.sum += info.worked;
    bucket.count += 1;
  }

  const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
  return {
    ...stats,
    averageWorked: stats.daysWorked ? stats.totalWorked / stats.daysWorked : 0,
    averagePause: stats.daysWorked ? stats.totalPause / stats.daysWorked : 0,
    averageArrival: mean(arrivals),
    averageDeparture: mean(departures),
    byWeekDay: weekDayTotals.map(({ sum, count }) => (count ? sum / count : 0)),
  };
}

/**
 * Counts the last working days in a row that reached their target.
 * Weekends, holidays, full absences and the unfinished current day are skipped.
 *
 * Args:
 *   calculator: The calculator of the data.
 *   startDate: The key of the first day of the tracking.
 *
 * Returns:
 *   The number of days.
 */
export function targetStreak(calculator, startDate) {
  let streak = 0;
  for (let date = addDays(parseKey(calculator.today), -1); dateKey(date) >= startDate; date = addDays(date, -1)) {
    const info = calculator.day(dateKey(date));
    if (info.target === 0) {
      continue;
    }
    if (info.delta < 0) {
      break;
    }
    streak += 1;
  }
  return streak;
}

/**
 * Sums the work and the target of a number of past weeks.
 *
 * Args:
 *   calculator: The calculator of the data.
 *   count: The number of weeks, the current one included.
 *
 * Returns:
 *   An array of { monday, worked }, oldest first.
 */
export function weeklyTotals(calculator, count) {
  const currentMonday = startOfWeek(parseKey(calculator.today));
  return Array.from({ length: count }, (_, index) => {
    const monday = addDays(currentMonday, (index - count + 1) * 7);
    let worked = 0;
    for (let offset = 0; offset < 7; offset += 1) {
      worked += calculator.day(dateKey(addDays(monday, offset))).worked;
    }
    return { monday, worked };
  });
}
