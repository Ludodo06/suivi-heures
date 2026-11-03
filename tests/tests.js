// Tests of the calculations. Open tests/index.html through the local server.

import { createCalculator } from "../js/calculator.js";
import { holidaysOf } from "../js/holidays.js";
import { formatHoursMinutes, formatSigned } from "../js/time.js";
import { buildReport } from "../js/export.js";
import { listChanges } from "../js/storage.js";
import { daysBetween, nextHoliday, periodStats, targetStreak } from "../js/insights.js";

const lines = [];
function check(name, actual, expected) {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  lines.push(`${passed ? "PASS" : "FAIL"} ${name}${passed ? "" : `: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
}

const session = (day, start, end) => ({
  id: `${day}-${start}`,
  start: new Date(`${day}T${start}:00`).toISOString(),
  end: end ? new Date(`${day}T${end}:00`).toISOString() : null,
});
const settings = { dailyHours: 8, vacationDays: 20, startDate: "2026-11-02", startBalanceMinutes: 0 };
const makeData = (sessions, absences = {}, extra = {}, closedDays = {}, holidayOverrides = {}) => ({ sessions, absences, closedDays, notes: {}, holidayOverrides, settings: { ...settings, ...extra } });

// Holidays of the canton of Vaud in 2026.
check(
  "holidays 2026",
  [...holidaysOf(2026).keys()].sort(),
  ["2026-01-01", "2026-01-02", "2026-04-03", "2026-04-06", "2026-05-14", "2026-05-25", "2026-08-01", "2026-09-21", "2026-12-25"],
);

// The example of the user: 8h of work and 1h35 of pause.
const fullDay = [
  session("2026-11-02", "08:00", "12:00"),
  session("2026-11-02", "13:00", "15:00"),
  session("2026-11-02", "15:35", "17:35"),
];
const afterDay = createCalculator(makeData(fullDay), new Date("2026-11-03T00:30:00"));
check("work of the day", formatHoursMinutes(afterDay.day("2026-11-02").worked), "8h 00m");
check("pauses of the day", formatHoursMinutes(afterDay.day("2026-11-02").pause), "1h 35m");
check("a full day leaves the bank at zero", formatSigned(afterDay.bank), "+0h 00m");

// Today only adds its extra time.
const midDay = createCalculator(makeData([session("2026-11-02", "08:00", null)]), new Date("2026-11-02T10:00:00"));
check("an unfinished day does not lower the bank", formatSigned(midDay.bank), "+0h 00m");
const longDay = createCalculator(makeData([session("2026-11-02", "08:00", "17:00")]), new Date("2026-11-02T18:00:00"));
check("extra hours of today count", formatSigned(longDay.bank), "+1h 00m");

// Holidays changed by the user: Monday half holiday, Tuesday half holiday with a
// half day of vacation, Wednesday full holiday, then Christmas removed.
const changed = createCalculator(
  makeData(
    [],
    { "2026-11-03": "halfVacation", "2026-11-04": "vacation" },
    {},
    {},
    { "2026-11-02": { kind: "half", name: "Test" }, "2026-11-03": { kind: "half", name: "Test" }, "2026-11-04": { kind: "full", name: "Test" }, "2026-12-25": { kind: "none" } },
  ),
  new Date("2026-11-05T09:00:00"),
);
check("a half holiday leaves half a day", formatHoursMinutes(changed.day("2026-11-02").target), "4h 00m");
check("a half holiday and a half vacation leave nothing", changed.day("2026-11-03").target, 0);
check("a full holiday leaves nothing", changed.day("2026-11-04").target, 0);
check("the bank follows the changed holidays", formatSigned(changed.bank), "-4h 00m");
check("only the half day of vacation counts", changed.vacationTaken(2026), 0.5);
check("a removed holiday is a normal day", changed.day("2026-12-25").holiday, null);
check("a half holiday costs half a vacation day", createCalculator(makeData([], { "2026-11-02": "vacation" }, {}, {}, { "2026-11-02": { kind: "half", name: "Test" } }), new Date("2026-11-03T09:00:00")).vacationTaken(2026), 0.5);
check("next holiday skips a removed one", nextHoliday("2026-11-03", { "2026-12-25": { kind: "none" } }).key, "2027-01-01");

// A finished day counts in full, even when it is the current day.
const closed = createCalculator(makeData([session("2026-11-02", "08:00", "12:00")], {}, {}, { "2026-11-02": true }), new Date("2026-11-02T18:00:00"));
check("a finished short day lowers the bank at once", formatSigned(closed.bank), "-4h 00m");

// An empty working day takes its hours from the bank.
const emptyDay = createCalculator(makeData([]), new Date("2026-11-03T09:00:00"));
check("an empty day lowers the bank", formatSigned(emptyDay.bank), "-8h 00m");

// Absences.
const absences = createCalculator(
  makeData([session("2026-11-03", "08:00", "12:00")], { "2026-11-02": "vacation", "2026-11-03": "halfVacation", "2026-11-04": "sick", "2026-11-05": "recovery" }),
  new Date("2026-11-06T09:00:00"),
);
check("vacation, half day, sick and recovery", formatSigned(absences.bank), "-8h 00m");
check("vacation days of the year", absences.vacationTaken(2026), 1.5);

// Weekends, holidays, days before the start and the starting balance.
const special = createCalculator(
  makeData([session("2026-12-25", "08:00", "09:00"), session("2026-12-26", "08:00", "09:00")], {}, { startDate: "2026-12-25", startBalanceMinutes: 90 }),
  new Date("2026-12-28T09:00:00"),
);
check("work on a holiday or a weekend adds to the bank", formatSigned(special.bank), "+3h 30m");

// A session over midnight is split between the two days.
const night = createCalculator(
  makeData([{ id: "n", start: new Date("2026-11-02T23:00:00").toISOString(), end: new Date("2026-11-03T01:00:00").toISOString() }]),
  new Date("2026-11-03T02:00:00"),
);
check("first part of the night", formatHoursMinutes(night.day("2026-11-02").worked), "1h 00m");
check("second part of the night", formatHoursMinutes(night.day("2026-11-03").worked), "1h 00m");

// Only the changed fields are sent to the other devices.
const before = { sessions: { a: { start: "1", end: null } }, settings: { dailyHours: 8 }, notes: { x: "old" } };
const after = { sessions: { a: { end: "2", start: "1" }, b: { start: "3", end: null } }, settings: { dailyHours: 8 }, notes: {} };
check(
  "changed fields",
  listChanges(before, after).map(({ group, key, value }) => [group, key, value === undefined ? "removed" : "set"]),
  [["sessions", "a", "set"], ["sessions", "b", "set"], ["notes", "x", "removed"]],
);
check("the order of the fields does not count", listChanges({ sessions: { a: { start: "1", end: null } } }, { sessions: { a: { end: null, start: "1" } } }), []);

// Averages, records and next events.
const stats = periodStats(afterDay, "2026-11-02");
check("worked days", stats.daysWorked, 1);
check("average arrival", stats.averageArrival, 480);
check("average departure", stats.averageDeparture, 17 * 60 + 35);
check("streak", targetStreak(afterDay, "2026-11-02"), 1);
check("days between over a clock change", daysBetween("2026-10-24", "2026-10-26"), 2);
check("next holiday", nextHoliday("2026-11-03").key, "2026-12-25");

// The Excel file is a ZIP archive.
const blob = buildReport(afterDay, "Test", "2026-11-01", "2026-11-30");
const signature = [...new Uint8Array(await blob.slice(0, 2).arrayBuffer())];
check("the Excel file is a ZIP archive", signature, [0x50, 0x4b]);

window.__xlsx = blob;
const failed = lines.filter((line) => line.startsWith("FAIL")).length;
document.getElementById("results").textContent = `${lines.join("\n")}\n\n${failed} failed, ${lines.length - failed} passed`;
