// Turns the saved data into day totals, the hour bank and the vacation count.
// No access to the page or to the storage here.

import { effectiveHolidays } from "./holidays.js";
import { MS_PER_HOUR, MS_PER_MINUTE, addDays, dateKey, parseKey, startOfDay, startOfWeek } from "./time.js";

/**
 * The kinds of absence.
 * `targetShare` is the part of the normal day that is still due.
 * `vacationDays` is what the absence takes from the yearly vacation days.
 * A recovery day is still due: it takes its hours from the bank.
 */
export const ABSENCE_TYPES = {
  vacation: { label: "Vacances", targetShare: 0, vacationDays: 1 },
  halfVacation: { label: "Demi-journée de vacances", targetShare: 0.5, vacationDays: 0.5 },
  sick: { label: "Maladie ou accident", targetShare: 0, vacationDays: 0 },
  recovery: { label: "Récupération (pris sur la banque)", targetShare: 1, vacationDays: 0 },
};

/**
 * Adds up the work and the pauses of each day.
 *
 * A pause is the time between two work periods of the same day. The time after
 * the last period of a day is not a pause.
 *
 * Args:
 *   sessions: The array of sessions.
 *   now: The current moment. It is the end of a session that still runs.
 *
 * Returns:
 *   A Map from day key to { worked, pause, first, last }. `worked` and `pause`
 *   are in milliseconds. `first` and `last` are Dates. `last` is null while the
 *   session runs.
 */
function collectWork(sessions, now) {
  const days = new Map();
  const entry = (key) => {
    if (!days.has(key)) {
      days.set(key, { worked: 0, pause: 0, first: null, last: null });
    }
    return days.get(key);
  };

  const sorted = [...sessions].sort((a, b) => a.start.localeCompare(b.start));
  let previousEnd = null;
  for (const session of sorted) {
    const start = new Date(session.start);
    const end = session.end ? new Date(session.end) : now;

    if (previousEnd && dateKey(previousEnd) === dateKey(start)) {
      entry(dateKey(start)).pause += Math.max(start - previousEnd, 0);
    }

    let cursor = start;
    while (cursor < end) {
      const nextDay = addDays(startOfDay(cursor), 1);
      const partEnd = end < nextDay ? end : nextDay;
      const day = entry(dateKey(cursor));
      day.worked += partEnd - cursor;
      day.first = day.first ?? cursor;
      day.last = session.end ? partEnd : null;
      cursor = partEnd;
    }
    previousEnd = session.end ? end : null;
  }
  return days;
}

/**
 * Creates the calculator for the given data and moment.
 *
 * Args:
 *   data: The saved data: { sessions, absences, closedDays, notes, settings }.
 *   now: The current moment.
 *
 * Returns:
 *   An object with:
 *   - today: the key of the current day.
 *   - startDate: the key of the first day of the tracking.
 *   - bank: the current hour bank in milliseconds.
 *   - day(key): the details of a day.
 *   - settledDelta(key): what the day adds to the bank so far.
 *   - bankAfter(key): the bank at the end of a day, if known.
 *   - vacationTaken(year): the vacation days marked in the year.
 *   - weekWorked(): the work of the current week in milliseconds.
 */
export function createCalculator(data, now) {
  const { absences, closedDays, holidayOverrides, sessions, settings } = data;
  const holidaysByYear = new Map();
  const holidaysFor = (year) => {
    if (!holidaysByYear.has(year)) {
      holidaysByYear.set(year, effectiveHolidays(year, holidayOverrides));
    }
    return holidaysByYear.get(year);
  };
  const today = dateKey(now);
  const work = collectWork(sessions, now);

  function day(key) {
    const date = parseKey(key);
    const entry = holidaysFor(date.getFullYear()).get(key) ?? null;
    const holiday = entry && !entry.isHalf ? entry.name : null;
    const halfHoliday = entry?.isHalf ? entry.name : null;
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const isWorkingDay = !holiday && !weekend;
    const absence = isWorkingDay ? (absences[key] ?? null) : null;
    // A half holiday leaves half a day. An absence then takes from that half.
    const openShare = halfHoliday ? 0.5 : 1;
    const absenceType = absence ? ABSENCE_TYPES[absence] : null;
    const share = absenceType ? Math.max(openShare - (1 - absenceType.targetShare), 0) : openShare;
    const vacationCost = absenceType ? Math.min(absenceType.vacationDays, openShare) : 0;
    const isDue = isWorkingDay && key >= settings.startDate;
    const target = isDue ? settings.dailyHours * MS_PER_HOUR * share : 0;
    const { worked, pause, first, last } = work.get(key) ?? { worked: 0, pause: 0, first: null, last: null };
    return { key, date, holiday, halfHoliday, weekend, isWorkingDay, absence, vacationCost, target, worked, pause, first, last, delta: worked - target };
  }

  // An open today only adds its extra time: the day is not over yet.
  function settledDelta(key) {
    if (key > today) {
      return 0;
    }
    const { delta } = day(key);
    return key === today && !closedDays[key] ? Math.max(delta, 0) : delta;
  }

  const bankByDay = new Map();
  let bank = settings.startBalanceMinutes * MS_PER_MINUTE;
  const firstKey = [settings.startDate, ...work.keys()].sort()[0];
  for (let date = parseKey(firstKey); dateKey(date) <= today; date = addDays(date, 1)) {
    const key = dateKey(date);
    bank += settledDelta(key);
    bankByDay.set(key, bank);
  }

  function vacationTaken(year) {
    let total = 0;
    for (const key of Object.keys(absences)) {
      if (key.startsWith(`${year}-`)) {
        total += day(key).vacationCost;
      }
    }
    return total;
  }

  function weekWorked() {
    let total = 0;
    for (let date = startOfWeek(now); dateKey(date) <= today; date = addDays(date, 1)) {
      total += day(dateKey(date)).worked;
    }
    return total;
  }

  return {
    today,
    startDate: settings.startDate,
    bank,
    day,
    settledDelta,
    bankAfter: (key) => bankByDay.get(key) ?? null,
    vacationTaken,
    weekWorked,
  };
}

/**
 * Returns the short text that describes a special day.
 *
 * Args:
 *   info: The details of a day, from `calculator.day(key)`.
 *
 * Returns:
 *   A text like "Noël" or "Vacances", or an empty text for a normal day.
 */
export function dayNote(info) {
  if (info.holiday) {
    return info.holiday;
  }
  const parts = [
    info.halfHoliday && `${info.halfHoliday} (demi-journée fériée)`,
    info.absence && ABSENCE_TYPES[info.absence].label,
    info.weekend && "Week-end",
  ];
  return parts.filter(Boolean).join(" · ");
}
