// Starts the app and connects the screens together.

import { createCalculator } from "./calculator.js";
import { el, showToast } from "./dom.js";
import { icon } from "./icons.js";
import { isDemo, loadData, loadTheme, saveData } from "./storage.js";
import { dateKey } from "./time.js";
import { renderCalendar } from "./views/calendar.js";
import { openDayDialog } from "./views/day-dialog.js";
import { renderHistory } from "./views/history.js";
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
    showToast(`Impossible d'enregistrer : ${error.message}`);
  }
}

const app = {
  data: await loadData(),
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
    TABS[activeTab].render(app);
    persist(this.data);
    showToast(message, () => {
      this.data = before;
      TABS[activeTab].render(app);
      persist(this.data);
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
  history.replaceState(null, "", `#${name}`);
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

applyTheme(loadTheme());

if (!app.data.settings.startDate) {
  app.data.settings.startDate = dateKey(now);
  await saveData(app.data);
}

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

setInterval(() => {
  if (activeTab === "today" && !document.getElementById("day-dialog").open) {
    renderToday(app, false);
  }
}, REFRESH_PERIOD_MS);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
