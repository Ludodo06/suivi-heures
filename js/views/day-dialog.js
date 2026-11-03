// The window that edits one day: its work periods and its kind of absence.

import { ABSENCE_TYPES, dayNote } from "../calculator.js";
import { el } from "../dom.js";
import { icon } from "../icons.js";
import { dateKey, formatClock, formatHoursMinutes, formatLongDay, formatSigned, parseKey } from "../time.js";

const dialog = document.getElementById("day-dialog");

function timeInput(value, label) {
  return el("input", { type: "time", value, ariaLabel: label, className: "time-input" });
}

function periodRow(session) {
  const start = session ? formatClock(new Date(session.start)) : "";
  const sameDayEnd = session?.end && dateKey(new Date(session.end)) === dateKey(new Date(session.start));
  const end = sameDayEnd ? formatClock(new Date(session.end)) : "";
  const row = el(
    "div",
    { className: "period-row" },
    timeInput(start, "Début"),
    el("span", { textContent: "–" }),
    timeInput(end, "Fin"),
    el("button", {
      type: "button",
      className: "link-button",
      textContent: "Retirer",
      onclick: () => row.remove(),
    }),
  );
  row.session = session;
  return row;
}

/**
 * Reads the periods typed in the window and checks them.
 *
 * Args:
 *   rows: The period rows.
 *   key: The key of the day.
 *   now: The current moment.
 *
 * Returns:
 *   { sessions } with the new sessions of the day, or { error } with a message.
 */
function readPeriods(rows, key, now) {
  const isToday = key === dateKey(now);
  const moment = (time) => {
    const date = parseKey(key);
    const [hours, minutes] = time.split(":").map(Number);
    date.setHours(hours, minutes);
    return date;
  };

  const sessions = [];
  for (const row of rows) {
    const [startInput, endInput] = row.querySelectorAll("input");
    if (!startInput.value) {
      return { error: "Indique l'heure de début de chaque période." };
    }
    if (!endInput.value && !isToday) {
      return { error: "Indique l'heure de fin de chaque période." };
    }
    const old = row.session;
    // An unchanged time keeps its seconds.
    const keepStart = old && formatClock(new Date(old.start)) === startInput.value;
    const keepEnd = old?.end && dateKey(new Date(old.end)) === key && formatClock(new Date(old.end)) === endInput.value;
    const start = keepStart ? old.start : moment(startInput.value).toISOString();
    const end = !endInput.value ? null : keepEnd ? old.end : moment(endInput.value).toISOString();
    if (new Date(start) > now || (end && new Date(end) > now)) {
      return { error: "Une heure est dans le futur." };
    }
    if (end && new Date(end) <= new Date(start)) {
      return { error: "La fin doit être après le début." };
    }
    sessions.push({ id: old?.id ?? crypto.randomUUID(), start, end });
  }

  sessions.sort((a, b) => a.start.localeCompare(b.start));
  for (let index = 0; index < sessions.length - 1; index += 1) {
    if (!sessions[index].end) {
      return { error: "Seule la dernière période peut rester sans fin." };
    }
    if (new Date(sessions[index].end) > new Date(sessions[index + 1].start)) {
      return { error: "Deux périodes se chevauchent." };
    }
  }
  return { sessions };
}

/**
 * Opens the window for a day.
 *
 * Args:
 *   app: The app object: { data, action, calculator }.
 *   key: The key of the day.
 */
export function openDayDialog(app, key) {
  const info = app.calculator().day(key);
  const now = new Date();
  const isFuture = key > dateKey(now);
  const startsThisDay = (session) => dateKey(new Date(session.start)) === key;

  const rows = el("div", { className: "period-rows" }, ...app.data.sessions.filter(startsThisDay)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(periodRow));
  const error = el("p", { className: "form-error", hidden: true });

  const absenceSelect = el(
    "select",
    { id: "absence-select" },
    el("option", { value: "", textContent: "Aucune" }),
    ...Object.entries(ABSENCE_TYPES).map(([value, type]) => el("option", { value, textContent: type.label })),
  );
  absenceSelect.value = info.absence ?? "";
  const noteInput = el("input", { id: "day-note", type: "text", maxLength: 120, placeholder: "Ex. : formation, déplacement…", value: app.data.notes[key] ?? "" });

  function save() {
    const result = readPeriods([...rows.children], key, new Date());
    if (result.error) {
      error.textContent = result.error;
      error.hidden = false;
      return;
    }
    const others = app.data.sessions.filter((session) => !startsThisDay(session));
    if (others.some((session) => !session.end) && result.sessions.some((session) => !session.end)) {
      error.textContent = "Une autre période est encore en cours.";
      error.hidden = false;
      return;
    }
    dialog.close();
    app.action("Journée enregistrée", () => {
      app.data.sessions = [...others, ...result.sessions];
      if (absenceSelect.value) {
        app.data.absences[key] = absenceSelect.value;
      } else {
        delete app.data.absences[key];
      }
      const note = noteInput.value.trim();
      if (note) {
        app.data.notes[key] = note;
      } else {
        delete app.data.notes[key];
      }
    });
  }

  const content = [
    el("h2", { textContent: formatLongDay(info.date) }),
    !isFuture &&
      el(
        "p",
        { className: "dialog-summary" },
        `${formatHoursMinutes(info.worked)} de travail · ${formatHoursMinutes(info.pause)} de pause · écart ${formatSigned(info.delta)}`,
      ),
    !info.isWorkingDay && el("p", { className: "muted", textContent: dayNote(info) }),
    info.isWorkingDay && el("label", { className: "field", htmlFor: "absence-select", textContent: "Absence" }),
    info.isWorkingDay && absenceSelect,
    !isFuture && el("h3", { textContent: "Périodes de travail" }),
    !isFuture && rows,
    !isFuture &&
      el(
        "button",
        { type: "button", className: "secondary full", onclick: () => rows.append(periodRow(null)) },
        icon("plus", 16),
        "Ajouter une période",
      ),
    el("label", { className: "field", htmlFor: "day-note", textContent: "Note" }),
    noteInput,
    error,
    el(
      "div",
      { className: "dialog-actions" },
      el("button", { type: "button", className: "secondary", textContent: "Annuler", onclick: () => dialog.close() }),
      el("button", { type: "button", className: "primary", textContent: "Enregistrer", onclick: save }),
    ),
  ];
  dialog.replaceChildren(...content.filter(Boolean));
  dialog.showModal();
}
