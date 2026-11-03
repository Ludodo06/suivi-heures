// Starts the app and connects the screens together.

import { createCalculator } from "./calculator.js";
import { el, showToast } from "./dom.js";
import { icon } from "./icons.js";
import { hasProfile, isDemo, loadData, loadTheme, saveData, signOutProfile, watchData } from "./storage.js";
import { dateKey } from "./time.js";
import { renderCalendar } from "./views/calendar.js";
import { openDayDialog } from "./views/day-dialog.js";
import { renderHistory } from "./views/history.js";
import { showLogin } from "./views/login.js";
import { applyTheme, renderSettings } from "./views/settings.js";
import { renderStats } from "./views/stats.js";
import { renderToday } from "./views/today.js";

const REFRESH_PERIOD_MS = 1000;
const TABS = {
  today: { render: renderToday, label: "Aujourd'hui", iconName: "today" },
  history: { render: renderHistory, label: "Historique", iconName: "list" },
  calendar: { render: renderCalendar, label: "Calendrier", iconName: "calendar" },
  stats: { render: renderStats, label: "Stats", iconName: "chart" },
  settings: { render: renderSettings, label: "Réglages", iconName: "settings" },
};

const now = new Date();
let activeTab = "today";

async function persist(data) {
  try {
    await saveData(data);
  } catch (error) {
    showSaveError(error);
  }
}

function showSaveError(error) {
  console.error(error);
  showToast(`Impossible d'enregistrer : ${error.message}`);
}

const app = {
  data: null,
  month: new Date(now.getFullYear(), now.getMonth(), 1),
  calculator() {
    return createCalculator(this.data, new Date());
  },
  /**
   * Changes the data, saves it, and offers to undo the change.
   *
   * Args:
   *   message: The message to show.
   *   change: The function that changes `app.data`.
   */
  action(message, change) {
    const before = structuredClone(this.data);
    change();
    // Save first: the hours must be kept even if the display fails.
    persist(this.data);
    TABS[activeTab].render(app);
    showToast(message, () => {
      this.data = before;
      persist(this.data);
      TABS[activeTab].render(app);
    });
  },
  openDay(key) {
    openDayDialog(app, key);
  },
  moveMonth(step) {
    this.month = new Date(this.month.getFullYear(), this.month.getMonth() + step, 1);
    TABS[activeTab].render(app);
  },
};

function showTab(name) {
  activeTab = name;
  history.replaceState(null, "", `${location.search}#${name}`);
  for (const button of document.querySelectorAll(".tab")) {
    const isActive = button.value === name;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-current", isActive ? "page" : "false");
  }
  for (const section of document.querySelectorAll(".screen")) {
    section.hidden = section.id !== `screen-${name}`;
  }
  window.scrollTo(0, 0);
  TABS[name].render(app);
}

// A change from another device. A form being typed in is left alone.
function receiveData(data) {
  app.data = data;
  const typing = document.activeElement?.matches?.("main input, main select");
  if (!typing) {
    TABS[activeTab].render(app);
  }
}

function startApp() {
  document.getElementById("app-layout").hidden = false;
  document.getElementById("demo-banner").hidden = !isDemo;
  document.getElementById("tabs").append(
    ...Object.entries(TABS).map(([name, tab]) =>
      el(
        "button",
        { type: "button", className: "tab", value: name, onclick: () => showTab(name) },
        icon(tab.iconName, 22),
        el("span", { textContent: tab.label }),
      ),
    ),
  );

  const wantedTab = location.hash.slice(1);
  showTab(TABS[wantedTab] ? wantedTab : "today");
  watchData(receiveData, showSaveError);

  setInterval(() => {
    if (activeTab === "today" && !document.getElementById("day-dialog").open) {
      renderToday(app, false);
    }
  }, REFRESH_PERIOD_MS);
}

async function main() {
  applyTheme(loadTheme());
  const splash = document.getElementById("splash");

  if (!isDemo && !(await hasProfile())) {
    splash.hidden = true;
    await showLogin();
    splash.hidden = false;
  }

  try {
    app.data = await loadData();
  } catch (error) {
    // The profile exists without any data: start again from the sign-in screen.
    if (error.code === "profile/missing") {
      await signOutProfile();
      location.reload();
      return;
    }
    throw error;
  }

  if (!app.data.settings.startDate) {
    app.data.settings.startDate = dateKey(now);
    await saveData(app.data);
  }
  splash.hidden = true;
  startApp();
}

main().catch((error) => {
  const splash = document.getElementById("splash");
  splash.hidden = false;
  splash.textContent = `L'application n'a pas pu démarrer : ${error.message}`;
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
