// Saves the data. All data access goes through this file.
// Today the data stays in this browser. To sync the phone and the computer,
// we only need to change this file.

import { createDemoData } from "./demo.js";

const STORAGE_KEY = "suivi-heures.data";
const DEMO_KEY = "suivi-heures.demo";
const THEME_KEY = "suivi-heures.theme";

/** True when the page shows the example data instead of the real data. */
export const isDemo = new URLSearchParams(location.search).has("demo");

const activeKey = isDemo ? DEMO_KEY : STORAGE_KEY;

/**
 * Adds the missing fields to some saved data.
 *
 * Args:
 *   saved: The saved data, possibly from an older version.
 *
 * Returns:
 *   The data, with these fields:
 *   - sessions: an array of { id, start, end }. The dates are ISO strings.
 *     `end` is null while the session runs.
 *   - absences: an object from day key to a kind of absence.
 *   - closedDays: an object from day key to true, for the finished days.
 *   - notes: an object from day key to a text.
 *   - settings: { dailyHours, vacationDays, startDate, startBalanceMinutes }.
 *     `startDate` is null until the first use.
 */
export function normalizeData(saved) {
  return {
    sessions: saved.sessions ?? [],
    absences: saved.absences ?? {},
    closedDays: saved.closedDays ?? {},
    notes: saved.notes ?? {},
    settings: {
      dailyHours: 8,
      vacationDays: 20,
      startDate: null,
      startBalanceMinutes: 0,
      ...saved.settings,
    },
  };
}

/**
 * Reads the saved data.
 *
 * Returns:
 *   The data. See `normalizeData`.
 */
export async function loadData() {
  const saved = localStorage.getItem(activeKey);
  if (saved) {
    return normalizeData(JSON.parse(saved));
  }
  return normalizeData(isDemo ? createDemoData(new Date()) : {});
}

/**
 * Replaces the saved data.
 *
 * Args:
 *   data: The data to save.
 */
export async function saveData(data) {
  localStorage.setItem(activeKey, JSON.stringify(data));
}

/**
 * Reads the theme chosen on this device.
 *
 * Returns:
 *   "auto", "light" or "dark".
 */
export function loadTheme() {
  return localStorage.getItem(THEME_KEY) ?? "auto";
}

/**
 * Saves the theme chosen on this device.
 *
 * Args:
 *   theme: "auto", "light" or "dark".
 */
export function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}
