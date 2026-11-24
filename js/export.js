// Builds the Excel file of the hours and gives it to the user.

import { dayNote } from "./calculator.js";
import { UNSET_LABEL, taskName, taskTotals } from "./tasks.js";
import { addDays, dateKey, formatClock, formatSigned, parseKey } from "./time.js";
import { STYLE, buildXlsx } from "./xlsx.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const COLUMN_WIDTHS = [12, 8, 32, 9, 9, 10, 10, 10, 11, 11];
const HEADERS = ["Date", "Jour", "Note", "Arrivée", "Départ", "Travail", "Pauses", "Objectif", "Écart", "Banque"];
const TASK_COLUMN_WIDTHS = [12, 30, 10, 8];

const excelDate = (date) => (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(1899, 11, 30)) / MS_PER_DAY;
const duration = (ms, style = STYLE.DURATION) => ({ value: ms / MS_PER_DAY, style });

/**
 * Builds the Excel file of a period. It stops at today.
 * The first sheet has the hours of each day. Weekends, holidays and days before
 * the start of the tracking only appear when they have work hours. The second
 * sheet has the time of each task.
 *
 * Args:
 *   calculator: The calculator of the data.
 *   title: The title on the first row.
 *   fromKey: The key of the first day.
 *   toKey: The key of the last day.
 *   data: The saved data, for the notes and the tasks.
 *   now: The current moment.
 *
 * Returns:
 *   A Blob with the content of the file.
 */
export function buildReport(calculator, title, fromKey, toKey, data, now = new Date()) {
  const { notes } = data;
  const rows = [
    [{ value: title, style: STYLE.BOLD }],
    [],
    HEADERS.map((value) => ({ value, style: STYLE.BOLD })),
  ];
  const totals = { worked: 0, pause: 0, target: 0, delta: 0 };

  for (let date = parseKey(fromKey); dateKey(date) <= toKey && dateKey(date) <= calculator.today; date = addDays(date, 1)) {
    const info = calculator.day(dateKey(date));
    if (info.worked === 0 && (!info.isWorkingDay || info.key < calculator.startDate)) {
      continue;
    }
    const delta = calculator.settledDelta(info.key);
    const bank = calculator.bankAfter(info.key);
    // An unfinished day only counts the hours that are already done.
    const isUnfinished = info.key === calculator.today && info.delta < 0 && delta === 0;
    totals.worked += info.worked;
    totals.pause += info.pause;
    totals.target += info.worked - delta;
    totals.delta += delta;
    rows.push([
      { value: excelDate(date), style: STYLE.DATE },
      date.toLocaleDateString("fr-CH", { weekday: "short" }),
      [isUnfinished ? "En cours" : dayNote(info), notes[info.key]].filter(Boolean).join(" – "),
      info.first ? formatClock(info.first) : null,
      info.last ? formatClock(info.last) : null,
      duration(info.worked),
      duration(info.pause),
      isUnfinished ? null : duration(info.target),
      formatSigned(delta),
      bank === null ? null : formatSigned(bank),
    ]);
  }

  rows.push([]);
  rows.push([
    { value: "Total", style: STYLE.BOLD },
    null,
    null,
    null,
    null,
    duration(totals.worked, STYLE.BOLD_DURATION),
    duration(totals.pause, STYLE.BOLD_DURATION),
    duration(totals.target, STYLE.BOLD_DURATION),
    { value: formatSigned(totals.delta), style: STYLE.BOLD },
    { value: formatSigned(calculator.bankAfter(toKey) ?? calculator.bank), style: STYLE.BOLD },
  ]);
  return buildXlsx([
    { name: "Heures", columnWidths: COLUMN_WIDTHS, rows },
    { name: "Tâches", columnWidths: TASK_COLUMN_WIDTHS, rows: taskRows(data, title, fromKey, toKey < calculator.today ? toKey : calculator.today, now) },
  ]);
}

// The rows of the tasks sheet: the time of each task on each day, then the totals.
function taskRows(data, title, fromKey, toKey, now) {
  const { byTask, byDay, unset } = taskTotals(data, fromKey, toKey, now);
  const total = [...byTask.values()].reduce((sum, value) => sum + value, 0);
  const rows = [
    [{ value: `${title} – tâches`, style: STYLE.BOLD }],
    [],
    ["Date", "Tâche", "Durée"].map((value) => ({ value, style: STYLE.BOLD })),
  ];
  const byName = (a, b) => taskName(data.tasks, a[0]).localeCompare(taskName(data.tasks, b[0]), "fr");
  for (const key of [...byDay.keys()].sort()) {
    for (const [taskId, time] of [...byDay.get(key).entries()].sort(byName)) {
      rows.push([{ value: excelDate(parseKey(key)), style: STYLE.DATE }, taskName(data.tasks, taskId), duration(time)]);
    }
  }
  rows.push([]);
  rows.push(["", "Total par tâche", "Durée", "Part"].map((value) => ({ value, style: STYLE.BOLD })));
  for (const [taskId, time] of [...byTask.entries()].sort((a, b) => b[1] - a[1])) {
    rows.push([null, taskName(data.tasks, taskId), duration(time), `${Math.round((time / total) * 100)} %`]);
  }
  rows.push([null, { value: "Total", style: STYLE.BOLD }, duration(total, STYLE.BOLD_DURATION)]);
  if (unset > 0) {
    rows.push([]);
    rows.push([null, `${UNSET_LABEL} (hors répartition)`, duration(unset)]);
  }
  return rows;
}

/**
 * Gives a file to the user. On a phone it opens the share menu, because a plain
 * download does not work well in an app installed on an iPhone.
 *
 * Args:
 *   blob: The content of the file.
 *   fileName: The name of the file.
 */
export async function deliverFile(blob, fileName) {
  const file = new File([blob], fileName, { type: blob.type });
  if (navigator.maxTouchPoints > 0 && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
    } catch (error) {
      if (error.name !== "AbortError") {
        throw error;
      }
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
