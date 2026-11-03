// Builds example data, to see the app with a few months of history.

import { holidaysOf } from "./holidays.js";
import { addDays, dateKey, parseKey } from "./time.js";

const DEMO_DAYS = 150;

/**
 * Creates the example data.
 *
 * Args:
 *   now: The current moment.
 *
 * Returns:
 *   Data in the same format as the saved data.
 */
export function createDemoData(now) {
  // A small fixed random generator: the example is the same on each opening.
  let seed = 42;
  const random = (min, max) => {
    seed = (seed * 16807) % 2147483647;
    return min + (seed % (max - min + 1));
  };

  const today = dateKey(now);
  const first = addDays(now, -DEMO_DAYS);
  const sessions = [];
  const absences = {};
  const at = (date, minutes) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, minutes).toISOString();
  const addSession = (date, start, end) => sessions.push({ id: crypto.randomUUID(), start: at(date, start), end: end === null ? null : at(date, end) });

  for (let date = first; dateKey(date) <= today; date = addDays(date, 1)) {
    const key = dateKey(date);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    if (isWeekend || holidaysOf(date.getFullYear()).has(key)) {
      continue;
    }
    const daysAgo = Math.round((parseKey(today) - date) / 86400000);
    if (daysAgo >= 60 && daysAgo < 67) {
      absences[key] = "vacation";
      continue;
    }
    if (daysAgo === 30) {
      absences[key] = "sick";
      continue;
    }
    const arrival = 7 * 60 + random(35, 85);
    const lunchStart = 12 * 60 + random(0, 30);
    const lunchEnd = lunchStart + random(40, 70);
    if (key === today) {
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      if (nowMinutes <= arrival) {
        continue;
      }
      if (nowMinutes < lunchStart) {
        addSession(date, arrival, null);
      } else {
        addSession(date, arrival, lunchStart);
        if (nowMinutes > lunchEnd) {
          addSession(date, lunchEnd, null);
        }
      }
      continue;
    }
    const breakStart = 15 * 60 + random(0, 30);
    const breakEnd = breakStart + random(5, 20);
    const worked = 8 * 60 + random(-35, 55);
    const departure = breakEnd + worked - (lunchStart - arrival) - (breakStart - lunchEnd);
    addSession(date, arrival, lunchStart);
    addSession(date, lunchEnd, breakStart);
    addSession(date, breakEnd, departure);
  }

  for (let offset = 25, marked = 0; marked < 5; offset += 1) {
    const date = addDays(now, offset);
    if (date.getDay() !== 0 && date.getDay() !== 6 && !holidaysOf(date.getFullYear()).has(dateKey(date))) {
      absences[dateKey(date)] = "vacation";
      marked += 1;
    }
  }

  return {
    sessions,
    absences,
    notes: {},
    closedDays: {},
    settings: { dailyHours: 8, vacationDays: 20, startDate: dateKey(first), startBalanceMinutes: 0 },
  };
}
