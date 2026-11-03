// The list of the days of a month, grouped by week, with the Excel export.

import { dayNote } from "../calculator.js";
import { card, el, segmented, tile } from "../dom.js";
import { buildReport, deliverFile } from "../export.js";
import { icon } from "../icons.js";
import { addDays, dateKey, formatDay, formatHoursMinutes, formatSigned, startOfWeek } from "../time.js";

const root = document.getElementById("history-root");

const FILTERS = [
  ["all", "Tout"],
  ["extra", "En plus"],
  ["missing", "En moins"],
  ["absence", "Absences"],
];

let activeFilter = "all";

function matchesFilter(info, today) {
  if (activeFilter === "extra") return info.delta > 0 && info.worked > 0;
  if (activeFilter === "missing") return info.delta < 0 && info.key !== today;
  if (activeFilter === "absence") return Boolean(info.absence);
  return true;
}

function weekNumber(monday) {
  const thursday = addDays(monday, 3);
  const firstJanuary = new Date(thursday.getFullYear(), 0, 1);
  return Math.floor((thursday - firstJanuary) / 86400000 / 7) + 1;
}

function dayRow(app, calculator, info) {
  const isToday = info.key === calculator.today;
  const isQuiet = !info.isWorkingDay && info.worked === 0;
  const share = info.target > 0 ? Math.min(info.worked / info.target, 1) : 0;
  const progress = el("span", { className: "day-progress" }, el("span", {}));
  progress.firstChild.style.width = `${share * 100}%`;
  const note = app.data.notes[info.key];
  const isOpen = isToday && !app.data.closedDays[info.key];

  return el(
    "li",
    {},
    el(
      "button",
      { type: "button", className: `day-row ${isQuiet ? "quiet" : ""}`, onclick: () => app.openDay(info.key) },
      el(
        "span",
        { className: "day-name" },
        formatDay(info.date),
        dayNote(info) && el("small", { textContent: dayNote(info) }),
        note && el("small", { textContent: note }),
      ),
      el(
        "span",
        { className: "day-hours" },
        formatHoursMinutes(info.worked),
        info.target > 0 && progress,
        info.pause > 0 && el("small", { textContent: `pause ${formatHoursMinutes(info.pause)}` }),
      ),
      el("span", {
        className: `day-delta ${info.delta < 0 && !isOpen ? "negative" : ""} ${info.delta > 0 ? "positive" : ""}`,
        textContent: isOpen ? "en cours" : isQuiet ? "" : formatSigned(info.delta),
      }),
    ),
  );
}

/**
 * Updates the screen.
 *
 * Args:
 *   app: The app object: { data, month, moveMonth, calculator, openDay }.
 */
export function renderHistory(app) {
  const calculator = app.calculator();
  const first = new Date(app.month.getFullYear(), app.month.getMonth(), 1);
  const last = new Date(app.month.getFullYear(), app.month.getMonth() + 1, 0);
  const year = first.getFullYear();
  const monthName = first.toLocaleDateString("fr-CH", { month: "long", year: "numeric" });

  let worked = 0;
  let pause = 0;
  let delta = 0;
  const weeks = new Map();
  for (let date = first; date <= last && dateKey(date) <= calculator.today; date = addDays(date, 1)) {
    const info = calculator.day(dateKey(date));
    worked += info.worked;
    pause += info.pause;
    delta += calculator.settledDelta(info.key);
    const mondayKey = dateKey(startOfWeek(date));
    if (!weeks.has(mondayKey)) {
      weeks.set(mondayKey, { monday: startOfWeek(date), days: [], worked: 0 });
    }
    const week = weeks.get(mondayKey);
    week.worked += info.worked;
    if (matchesFilter(info, calculator.today)) {
      week.days.unshift(info);
    }
  }

  const exportFile = (title, fromKey, toKey, fileName) => () =>
    deliverFile(buildReport(calculator, title, fromKey, toKey, app.data.notes), fileName);

  const weekCards = [...weeks.values()]
    .reverse()
    .filter((week) => week.days.length > 0)
    .map((week) =>
      card(
        `Semaine ${weekNumber(week.monday)}`,
        formatHoursMinutes(week.worked),
        el("ul", { className: "day-list" }, week.days.map((info) => dayRow(app, calculator, info))),
      ),
    );

  root.replaceChildren(
    el("h1", { className: "screen-title", textContent: "Historique" }),
    el(
      "div",
      { className: "month-nav" },
      el("button", { type: "button", className: "icon-button", ariaLabel: "Mois précédent", onclick: () => app.moveMonth(-1) }, icon("left")),
      el("span", { id: "history-month", textContent: monthName }),
      el("button", { type: "button", className: "icon-button", ariaLabel: "Mois suivant", onclick: () => app.moveMonth(1) }, icon("right")),
    ),
    el(
      "div",
      { className: "tile-grid" },
      tile({ iconName: "today", tone: "blue", label: "Travail du mois", value: formatHoursMinutes(worked) }),
      tile({ iconName: "coffee", tone: "orange", label: "Pauses du mois", value: formatHoursMinutes(pause) }),
      tile({ iconName: "sparkle", tone: "violet", label: "Écart du mois", value: formatSigned(delta) }),
      tile({ iconName: "bank", tone: "green", label: "Banque d'heures", value: formatSigned(calculator.bank) }),
    ),
    el(
      "div",
      { className: "export-actions" },
      el(
        "button",
        { id: "export-month", type: "button", className: "secondary", onclick: exportFile(`Heures de travail – ${monthName}`, dateKey(first), dateKey(last), `heures-${dateKey(first).slice(0, 7)}.xlsx`) },
        icon("download", 16),
        "Excel du mois",
      ),
      el(
        "button",
        { id: "export-year", type: "button", className: "secondary", onclick: exportFile(`Heures de travail – ${year}`, `${year}-01-01`, `${year}-12-31`, `heures-${year}.xlsx`) },
        icon("download", 16),
        `Excel ${year}`,
      ),
    ),
    segmented(FILTERS, activeFilter, (value) => {
      activeFilter = value;
      renderHistory(app);
    }),
    weekCards.length ? el("div", { className: "stack" }, weekCards) : el("p", { className: "empty-state", textContent: "Aucun jour à afficher." }),
  );
}
