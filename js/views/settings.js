// The settings screen: the work rules, the look and the backups.

import { ABSENCE_TYPES } from "../calculator.js";
import { card, el, segmented, showToast } from "../dom.js";
import { icon } from "../icons.js";
import { changePassword, isDemo, loadTheme, normalizeData, saveTheme, signOutProfile } from "../storage.js";
import { dateKey } from "../time.js";
import { deliverFile } from "../export.js";
import { OTHER_TASK_ID, TASK_COLORS, addTask, taskNameError } from "../tasks.js";

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

function taskRow(app, id, task) {
  const isOther = id === OTHER_TASK_ID;
  const nameInput = el("input", {
    type: "text",
    value: task.name,
    maxLength: 40,
    ariaLabel: "Nom de la tâche",
    disabled: isOther,
    onchange: () => {
      const error = taskNameError(app.data.tasks, nameInput.value, id);
      if (error) {
        showToast(error);
        nameInput.value = task.name;
        return;
      }
      app.action("Tâche renommée", () => {
        app.data.tasks[id].name = nameInput.value.trim();
      });
    },
  });
  const colorSelect = el(
    "select",
    {
      ariaLabel: "Couleur",
      disabled: isOther,
      onchange: () =>
        app.action("Couleur changée", () => {
          app.data.tasks[id].color = colorSelect.value;
        }),
    },
    Object.entries(TASK_COLORS).map(([value, label]) => el("option", { value, textContent: label })),
  );
  colorSelect.value = task.color;
  const toggle = (archived) => () => {
    if (!archived && taskNameError(app.data.tasks, task.name, id)) {
      showToast("Une tâche active porte déjà ce nom.");
      return;
    }
    app.action(archived ? "Tâche archivée" : "Tâche réactivée", () => {
      app.data.tasks[id].archived = archived;
    });
  };
  return el(
    "li",
    { className: `task-row${task.archived ? " archived" : ""}` },
    el("span", { className: `task-dot task-bg-${task.color}` }),
    nameInput,
    colorSelect,
    isOther
      ? el("span", { className: "task-row-note", textContent: "Par défaut" })
      : el("button", { type: "button", className: "link-button", textContent: task.archived ? "Réactiver" : "Archiver", onclick: toggle(!task.archived) }),
  );
}

function tasksCard(app) {
  const entries = Object.entries(app.data.tasks).sort(([idA, a], [idB, b]) =>
    idA === OTHER_TASK_ID ? -1 : idB === OTHER_TASK_ID ? 1 : a.name.localeCompare(b.name, "fr"),
  );
  const active = entries.filter(([, task]) => !task.archived);
  const archived = entries.filter(([, task]) => task.archived);
  const nameInput = el("input", { id: "new-task-name", type: "text", maxLength: 40, placeholder: "Ex. : Projet X, réunions…", required: true });
  const form = el(
    "form",
    {
      id: "task-form",
      className: "task-form",
      onsubmit: (event) => {
        event.preventDefault();
        const error = taskNameError(app.data.tasks, nameInput.value);
        if (error) {
          showToast(error);
          return;
        }
        const name = nameInput.value.trim();
        app.action(`Tâche « ${name} » ajoutée`, () => {
          addTask(app.data.tasks, name);
        });
      },
    },
    nameInput,
    el("button", { type: "submit", className: "primary" }, icon("plus", 16), "Ajouter"),
  );
  return card(
    "Mes tâches",
    null,
    el("p", {
      className: "muted",
      textContent: "Choisis une tâche en démarrant, puis change-la quand tu veux. Sans choix, c'est « Autre ». Une tâche archivée garde ses heures passées.",
    }),
    el("ul", { id: "task-list", className: "task-list" }, active.map(([id, task]) => taskRow(app, id, task))),
    form,
    archived.length > 0 &&
      el(
        "details",
        { className: "task-archived" },
        el("summary", { textContent: `Tâches archivées (${archived.length})` }),
        el("ul", { className: "task-list" }, archived.map(([id, task]) => taskRow(app, id, task))),
      ),
  );
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
            const { profileName } = app.data.settings;
            app.data = normalizeData(saved);
            app.data.settings.startDate ??= dateKey(new Date());
            app.data.settings.profileName = profileName;
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

function profileCard(app) {
  const currentInput = el("input", { type: "password", autocomplete: "current-password", required: true });
  const nextInput = el("input", { type: "password", autocomplete: "new-password", minLength: 6, required: true });
  const form = el(
    "form",
    {
      id: "password-form",
      onsubmit: async (event) => {
        event.preventDefault();
        try {
          await changePassword(currentInput.value, nextInput.value);
          form.reset();
          showToast("Mot de passe changé");
        } catch {
          showToast("Mot de passe actuel incorrect, ou pas de réseau.");
        }
      },
    },
    field("password-current", "Mot de passe actuel", currentInput),
    field("password-next", "Nouveau mot de passe", nextInput, "Au moins 6 caractères."),
    el("button", { type: "submit", className: "secondary full", textContent: "Changer le mot de passe" }),
  );
  return card(
    "Mon profil",
    app.data.settings.profileName,
    form,
    el("button", {
      id: "sign-out",
      type: "button",
      className: "secondary full",
      textContent: "Se déconnecter",
      onclick: async () => {
        if (!navigator.onLine) {
          showToast("Reconnecte-toi au réseau avant : des heures pourraient ne pas être envoyées.");
          return;
        }
        await signOutProfile();
        location.reload();
      },
    }),
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
      el("div", { className: "stack" }, rulesCard(app), tasksCard(app)),
      el("div", { className: "stack" }, !isDemo && profileCard(app), themeCard(app), backupCard(app), demoCard()),
    ),
  );
}
