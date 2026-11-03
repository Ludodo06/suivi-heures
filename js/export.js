// Builds the Excel file of the hours and gives it to the user.

import { dayNote } from "./calculator.js";
import { addDays, dateKey, formatClock, formatSigned, parseKey } from "./time.js";
import { STYLE, buildXlsx } from "./xlsx.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const COLUMN_WIDTHS = [12, 8, 32, 9, 9, 10, 10, 10, 11, 11];
const HEADERS = ["Date", "Jour", "Note", "Arrivée", "Départ", "Travail", "Pauses", "Objectif", "Écart", "Banque"];

const excelDate = (date) => (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(1899, 11, 30)) / MS_PER_DAY;
const duration = (ms, style = STYLE.DURATION) => ({ value: ms / MS_PER_DAY, style });

/**
 * Builds the Excel file of a period. It stops at today.
 * Weekends, holidays and days before the start of the tracking only appear when
 * they have work hours.
 *
 * Args:
 *   calculator: The calculator of the data.
 *   title: The title on the first row.
 *   fromKey: The key of the first day.
 *   toKey: The key of the last day.
 *   notes: The notes of the user, from day key to text.
 *
 * Returns:
 *   A Blob with the content of the file.
 */
export function buildReport(calculator, title, fromKey, toKey, notes = {}) {
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
  return buildXlsx("Heures", COLUMN_WIDTHS, rows);
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
