// The month calendar, the vacation count and the coming holidays.

import { dayNote } from "../calculator.js";
import { splitBar } from "../charts.js";
import { card, el, showToast } from "../dom.js";
import { effectiveHolidays, holidaysOf } from "../holidays.js";
import { icon } from "../icons.js";
import { daysBetween } from "../insights.js";
import { MS_PER_HOUR, addDays, dateKey, formatDay, parseKey } from "../time.js";

const root = document.getElementById("calendar-root");
const dialog = document.getElementById("day-dialog");
const WEEK_DAYS = ["L", "M", "M", "J", "V", "S", "D"];
const UPCOMING_HOLIDAYS = 4;

function dayClass(info, today) {
  const classes = ["calendar-day"];
  if (info.holiday) classes.push("holiday");
  else if (info.absence) classes.push(info.absence);
  else if (info.halfHoliday) classes.push("halfHoliday");
  else if (info.weekend) classes.push("weekend");
  else if (info.worked > 0) classes.push("worked");
  if (info.key === today) classes.push("today");
  return classes.join(" ");
}

function vacationCounts(app, calculator, year) {
  let taken = 0;
  let planned = 0;
  for (const key of Object.keys(app.data.absences)) {
    if (key.startsWith(`${year}-`)) {
      if (key <= calculator.today) taken += calculator.day(key).vacationCost;
      else planned += calculator.day(key).vacationCost;
    }
  }
  return { taken, planned };
}

function vacationCard(app, calculator, year) {
  const allowance = app.data.settings.vacationDays;
  const { taken, planned } = vacationCounts(app, calculator, year);
  const left = allowance - taken - planned;
  const number = (value) => value.toLocaleString("fr-CH");
  return card(
    `Vacances ${year}`,
    left >= 0 ? `${number(left)} j restants` : `${number(-left)} j en trop`,
    splitBar([
      { label: "Prises", value: taken, text: `${number(taken)} j`, className: "split-taken" },
      { label: "Prévues", value: planned, text: `${number(planned)} j`, className: "split-planned" },
      { label: "Restantes", value: Math.max(left, 0), text: `${number(Math.max(left, 0))} j`, className: "split-left" },
    ]),
    el(
      "button",
      { id: "add-vacation", type: "button", className: "secondary full", onclick: () => openVacationDialog(app) },
      icon("plus", 16),
      "Poser des vacances",
    ),
  );
}

function holidaysCard(app, calculator) {
  const overrides = app.data.holidayOverrides;
  const year = parseKey(calculator.today).getFullYear();
  const upcoming = [...effectiveHolidays(year, overrides), ...effectiveHolidays(year + 1, overrides)]
    .filter(([key]) => key > calculator.today)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, UPCOMING_HOLIDAYS);
  return card(
    "Prochains jours fériés",
    "Canton de Vaud",
    el(
      "ul",
      { className: "holiday-list" },
      upcoming.map(([key, { name, isHalf }]) =>
        el(
          "li",
          {},
          el("span", { className: "holiday-name" }, name, el("small", { textContent: `${formatDay(parseKey(key))}${isHalf ? " · demi-journée" : ""}` })),
          el("span", { className: "badge", textContent: `J-${daysBetween(calculator.today, key)}` }),
        ),
      ),
    ),
    el(
      "button",
      { id: "manage-holidays", type: "button", className: "secondary full", onclick: () => openHolidaysDialog(app, app.month.getFullYear()) },
      icon("pencil", 16),
      "Gérer les jours fériés",
    ),
  );
}

/**
 * Opens the window that adds or removes the holidays of a year.
 *
 * Args:
 *   app: The app object: { data, action }.
 *   year: The year to show.
 */
function openHolidaysDialog(app, year) {
  const reopen = (nextYear = year) => openHolidaysDialog(app, nextYear);
  const change = (message, update) => {
    app.action(message, update);
    reopen();
  };
  const overrides = app.data.holidayOverrides;
  const holidays = [...effectiveHolidays(year, overrides)].sort(([a], [b]) => a.localeCompare(b));
  const removed = [...holidaysOf(year)].filter(([key]) => overrides[key]?.kind === "none");

  const dateInput = el("input", { id: "holiday-date", type: "date", value: `${year}-12-31` });
  const kindSelect = el(
    "select",
    { id: "holiday-kind" },
    el("option", { value: "half", textContent: "Demi-journée" }),
    el("option", { value: "full", textContent: "Journée entière" }),
  );
  const nameInput = el("input", { id: "holiday-name", type: "text", maxLength: 60, placeholder: "Ex. : Saint-Sylvestre" });
  const error = el("p", { className: "form-error", hidden: true });

  const add = () => {
    const name = nameInput.value.trim();
    if (!dateInput.value || !name) {
      error.textContent = "Indique une date et un nom.";
      error.hidden = false;
      return;
    }
    change(`${name} ajouté`, () => {
      app.data.holidayOverrides[dateInput.value] = { kind: kindSelect.value, name };
    });
  };

  const removeHoliday = (key, entry) => () =>
    change(`${entry.name} retiré`, () => {
      if (holidaysOf(year).has(key)) {
        app.data.holidayOverrides[key] = { kind: "none" };
      } else {
        delete app.data.holidayOverrides[key];
      }
    });

  const content = [
    el(
      "div",
      { className: "month-nav" },
      el("button", { type: "button", className: "icon-button", ariaLabel: "Année précédente", onclick: () => reopen(year - 1) }, icon("left")),
      el("h2", { id: "holidays-year", textContent: `Jours fériés ${year}` }),
      el("button", { type: "button", className: "icon-button", ariaLabel: "Année suivante", onclick: () => reopen(year + 1) }, icon("right")),
    ),
    el(
      "ul",
      { id: "holiday-rows", className: "holiday-list holiday-manage" },
      holidays.map(([key, entry]) =>
        el(
          "li",
          {},
          el(
            "span",
            { className: "holiday-name" },
            entry.name,
            el("small", { textContent: `${formatDay(parseKey(key))}${entry.isHalf ? " · demi-journée" : ""}${entry.isOfficial ? "" : " · ajouté"}` }),
          ),
          el("button", { type: "button", className: "link-button", textContent: "Retirer", onclick: removeHoliday(key, entry) }),
        ),
      ),
    ),
    removed.length > 0 && el("h3", { textContent: "Retirés" }),
    removed.length > 0 &&
      el(
        "ul",
        { className: "holiday-list holiday-manage" },
        removed.map(([key, name]) =>
          el(
            "li",
            {},
            el("span", { className: "holiday-name" }, name, el("small", { textContent: formatDay(parseKey(key)) })),
            el("button", {
              type: "button",
              className: "restore-button",
              textContent: "Rétablir",
              onclick: () =>
                change(`${name} rétabli`, () => {
                  delete app.data.holidayOverrides[key];
                }),
            }),
          ),
        ),
      ),
    el("h3", { textContent: "Ajouter un jour férié" }),
    el("label", { className: "field", htmlFor: "holiday-date", textContent: "Date" }),
    dateInput,
    el("label", { className: "field", htmlFor: "holiday-kind", textContent: "Durée" }),
    kindSelect,
    el("label", { className: "field", htmlFor: "holiday-name", textContent: "Nom" }),
    nameInput,
    error,
    el(
      "div",
      { className: "dialog-actions" },
      el("button", { type: "button", className: "secondary", textContent: "Fermer", onclick: () => dialog.close() }),
      el("button", { id: "holiday-add", type: "button", className: "primary", textContent: "Ajouter", onclick: add }),
    ),
  ];
  dialog.replaceChildren(...content.filter(Boolean));
  if (!dialog.open) {
    dialog.showModal();
  }
}

/**
 * Lists the working days of a period.
 *
 * Args:
 *   calculator: The calculator of the data.
 *   fromKey: The key of the first day.
 *   toKey: The key of the last day.
 *
 * Returns:
 *   The array of day keys. Weekends and holidays are left out.
 */
function workingDaysBetween(calculator, fromKey, toKey) {
  const MAX_RANGE_DAYS = 366;
  const keys = [];
  if (!fromKey || !toKey || daysBetween(fromKey, toKey) > MAX_RANGE_DAYS) {
    return keys;
  }
  for (let date = parseKey(fromKey); dateKey(date) <= toKey; date = addDays(date, 1)) {
    if (calculator.day(dateKey(date)).isWorkingDay) {
      keys.push(dateKey(date));
    }
  }
  return keys;
}

function openVacationDialog(app) {
  const calculator = app.calculator();
  const startInput = el("input", { id: "vacation-from", type: "date", value: calculator.today });
  const endInput = el("input", { id: "vacation-to", type: "date", value: calculator.today });
  const count = el("p", { id: "vacation-count", className: "muted" });
  const update = () => {
    const keys = workingDaysBetween(calculator, startInput.value, endInput.value);
    const days = keys.reduce((total, key) => total + (calculator.day(key).halfHoliday ? 0.5 : 1), 0);
    count.textContent = days ? `${days.toLocaleString("fr-CH")} jour${days > 1 ? "s" : ""} de vacances. Les week-ends et les jours fériés ne comptent pas.` : "Aucun jour ouvré dans cette période.";
  };
  startInput.addEventListener("change", () => {
    if (endInput.value < startInput.value) endInput.value = startInput.value;
    update();
  });
  endInput.addEventListener("change", update);
  update();

  const save = () => {
    const keys = workingDaysBetween(calculator, startInput.value, endInput.value);
    if (keys.length === 0) {
      showToast("Aucun jour ouvré dans cette période.");
      return;
    }
    dialog.close();
    app.action(`${keys.length} jour${keys.length > 1 ? "s" : ""} de vacances posé${keys.length > 1 ? "s" : ""}`, () => {
      for (const key of keys) {
        app.data.absences[key] = "vacation";
      }
    });
  };

  dialog.replaceChildren(
    el("h2", { textContent: "Poser des vacances" }),
    el("label", { className: "field", htmlFor: "vacation-from", textContent: "Du" }),
    startInput,
    el("label", { className: "field", htmlFor: "vacation-to", textContent: "Au" }),
    endInput,
    count,
    el(
      "div",
      { className: "dialog-actions" },
      el("button", { type: "button", className: "secondary", textContent: "Annuler", onclick: () => dialog.close() }),
      el("button", { id: "vacation-save", type: "button", className: "primary", textContent: "Poser", onclick: save }),
    ),
  );
  dialog.showModal();
}

/**
 * Updates the screen.
 *
 * Args:
 *   app: The app object: { data, month, moveMonth, calculator, openDay, action }.
 */
export function renderCalendar(app) {
  const calculator = app.calculator();
  const year = app.month.getFullYear();
  const first = new Date(year, app.month.getMonth(), 1);
  const last = new Date(year, app.month.getMonth() + 1, 0);

  const cells = [
    ...WEEK_DAYS.map((textContent) => el("span", { className: "calendar-head", textContent })),
    ...Array.from({ length: (first.getDay() + 6) % 7 }, () => el("span")),
  ];
  for (let date = first; date <= last; date = addDays(date, 1)) {
    const info = calculator.day(dateKey(date));
    const hours = info.worked / MS_PER_HOUR;
    const note = dayNote(info);
    cells.push(
      el(
        "button",
        {
          type: "button",
          className: dayClass(info, calculator.today),
          ariaLabel: `${formatDay(date)}${note ? `, ${note}` : ""}`,
          title: note,
          onclick: () => app.openDay(info.key),
        },
        el("span", { textContent: String(date.getDate()) }),
        hours > 0 && el("small", { textContent: `${hours.toLocaleString("fr-CH", { maximumFractionDigits: 1 })}h` }),
      ),
    );
  }

  root.replaceChildren(
    el("h1", { className: "screen-title", textContent: "Calendrier" }),
    el(
      "div",
      { className: "month-nav" },
      el("button", { id: "calendar-previous", type: "button", className: "icon-button", ariaLabel: "Mois précédent", onclick: () => app.moveMonth(-1) }, icon("left")),
      el("span", { id: "calendar-month", textContent: first.toLocaleDateString("fr-CH", { month: "long", year: "numeric" }) }),
      el("button", { id: "calendar-next", type: "button", className: "icon-button", ariaLabel: "Mois suivant", onclick: () => app.moveMonth(1) }, icon("right")),
    ),
    el(
      "div",
      { className: "columns-layout" },
      el(
        "section",
        { className: "card" },
        el("div", { id: "calendar-grid", className: "calendar-grid" }, cells),
        el(
          "ul",
          { className: "legend" },
          [
            ["worked", "Travail"],
            ["vacation", "Vacances"],
            ["halfVacation", "Demi-journée"],
            ["holiday", "Férié"],
            ["halfHoliday", "Demi-férié"],
            ["sick", "Maladie"],
            ["recovery", "Récupération"],
          ].map(([className, label]) => el("li", {}, el("span", { className: `swatch ${className}` }), label)),
        ),
        el("p", { className: "muted", textContent: "Touche un jour pour le modifier." }),
      ),
      el("div", { className: "stack" }, vacationCard(app, calculator, year), holidaysCard(app, calculator)),
    ),
  );
}
