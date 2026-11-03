// The settings screen: the work rules, the look and the backups.

import { ABSENCE_TYPES } from "../calculator.js";
import { card, el, segmented, showToast } from "../dom.js";
import { icon } from "../icons.js";
import { isDemo, loadTheme, normalizeData, saveTheme } from "../storage.js";
import { dateKey } from "../time.js";
import { deliverFile } from "../export.js";

const root = document.getElementById("settings-root");

const THEMES = [
  ["auto", "Auto"],
  ["light", "Clair"],
  ["dark", "Sombre"],
];

/**
 * Applies a theme to the page.
 *
 * Args:
 *   theme: "auto", "light" or "dark".
 */
export function applyTheme(theme) {
  if (theme === "auto") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
}

function field(id, label, input, hint) {
  input.id = id;
  return el(
    "div",
    {},
    el("label", { className: "field", htmlFor: id, textContent: label }),
    input,
    hint && el("p", { className: "muted", textContent: hint }),
  );
}

function rulesCard(app) {
  const { settings } = app.data;
  const dailyHours = el("input", { type: "number", min: 0, max: 24, step: 0.25, required: true, value: settings.dailyHours });
  const vacationDays = el("input", { type: "number", min: 0, max: 366, step: 0.5, required: true, value: settings.vacationDays });
  const startDate = el("input", { type: "date", required: true, value: settings.startDate });
  const balance = el("input", { type: "number", step: 0.25, inputMode: "decimal", required: true, value: settings.startBalanceMinutes / 60 });

  const form = el(
    "form",
    {
      id: "settings-form",
      onsubmit: (event) => {
        event.preventDefault();
        app.action("Réglages enregistrés", () => {
          app.data.settings = {
            ...app.data.settings,
            dailyHours: Number(dailyHours.value),
            vacationDays: Number(vacationDays.value),
            startDate: startDate.value,
            startBalanceMinutes: Math.round(Number(balance.value) * 60),
          };
        });
      },
    },
    field("setting-daily-hours", "Heures par jour", dailyHours),
    field("setting-vacation-days", "Jours de vacances par an", vacationDays),
    field("setting-start-date", "Début du suivi", startDate, "Avant cette date, aucune heure n'est due."),
    field("setting-start-balance", "Banque de départ (en heures)", balance, "Mets par exemple 3.5 ou -2 si tu as déjà un solde."),
    el("button", { type: "submit", className: "primary full", textContent: "Enregistrer" }),
  );
  return card("Mes règles", null, form);
}

function themeCard(app) {
  return card(
    "Apparence",
    null,
    segmented(THEMES, loadTheme(), (theme) => {
      saveTheme(theme);
      applyTheme(theme);
      renderSettings(app);
    }),
  );
}

function isValidBackup(saved) {
  const hasValidSessions = Array.isArray(saved.sessions) && saved.sessions.every((session) => typeof session.start === "string");
  const hasValidAbsences = Object.values(saved.absences ?? {}).every((type) => type in ABSENCE_TYPES);
  return hasValidSessions && hasValidAbsences;
}

function backupCard(app) {
  const fileInput = el("input", {
    id: "restore-file",
    type: "file",
    accept: "application/json,.json",
    hidden: true,
    onchange: async () => {
      const [file] = fileInput.files;
      fileInput.value = "";
      if (!file) return;
      try {
        const saved = JSON.parse(await file.text());
        if (!isValidBackup(saved)) {
          throw new Error("format");
        }
        if (confirm("Remplacer toutes les données de cet appareil par cette sauvegarde ?")) {
          app.action("Sauvegarde restaurée", () => {
            app.data = normalizeData(saved);
            app.data.settings.startDate ??= dateKey(new Date());
          });
        }
      } catch {
        showToast("Ce fichier n'est pas une sauvegarde valide.");
      }
    },
  });
  return card(
    "Sauvegarde",
    null,
    el("p", { className: "muted", textContent: "Garde une copie de tes données dans un fichier, et remets-la quand tu veux." }),
    el(
      "div",
      { className: "export-actions" },
      el(
        "button",
        {
          id: "backup-button",
          type: "button",
          className: "secondary",
          onclick: () => {
            const blob = new Blob([JSON.stringify(app.data, null, 2)], { type: "application/json" });
            deliverFile(blob, `suivi-heures-${dateKey(new Date())}.json`);
          },
        },
        icon("download", 16),
        "Sauvegarder",
      ),
      el("button", { type: "button", className: "secondary", onclick: () => fileInput.click() }, icon("upload", 16), "Restaurer"),
    ),
    fileInput,
  );
}

function demoCard() {
  return card(
    "Données d'exemple",
    null,
    el("p", {
      className: "muted",
      textContent: isDemo
        ? "Tu regardes des données d'exemple. Tes vraies données ne changent pas."
        : "Regarde l'app avec plusieurs mois d'historique. Tes vraies données ne changent pas.",
    }),
    el("a", { className: "secondary full link-as-button", href: isDemo ? "./" : "./?demo=1", textContent: isDemo ? "Revenir à mes données" : "Voir l'exemple" }),
  );
}

/**
 * Updates the screen.
 *
 * Args:
 *   app: The app object: { data, action }.
 */
export function renderSettings(app) {
  root.replaceChildren(
    el("h1", { className: "screen-title", textContent: "Réglages" }),
    el(
      "div",
      { className: "columns-layout" },
      rulesCard(app),
      el("div", { className: "stack" }, themeCard(app), backupCard(app), demoCard()),
    ),
  );
}
