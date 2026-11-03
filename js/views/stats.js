// The statistics screen: averages, records and charts.

import { bankChart, columnChart, heatmap, splitBar } from "../charts.js";
import { card, el, emptyState, segmented, tile } from "../dom.js";
import { periodStats, targetStreak, weeklyTotals } from "../insights.js";
import { MS_PER_HOUR, addDays, dateKey, formatDay, formatHoursMinutes, formatSigned, parseKey, startOfWeek } from "../time.js";

const root = document.getElementById("stats-root");

const RANGES = [
  ["30", "30 jours"],
  ["90", "3 mois"],
  ["365", "12 mois"],
];
const WEEK_COUNT = { 30: 5, 90: 13, 365: 26 };
const HEATMAP_WEEKS = 53;
const WEEK_DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

let activeRange = "90";

function formatMinutes(minutes) {
  if (minutes === null) return "–";
  const rounded = Math.round(minutes);
  return `${String(Math.floor(rounded / 60)).padStart(2, "0")}:${String(rounded % 60).padStart(2, "0")}`;
}

function shortDate(date) {
  return date.toLocaleDateString("fr-CH", { day: "numeric", month: "short" });
}

function bankCard(calculator, fromKey) {
  const points = [];
  for (let date = parseKey(fromKey); dateKey(date) <= calculator.today; date = addDays(date, 1)) {
    const value = calculator.bankAfter(dateKey(date));
    if (value !== null) {
      points.push({ label: shortDate(date), value: value / MS_PER_HOUR });
    }
  }
  const format = (hours) => formatSigned(Math.round(hours * MS_PER_HOUR));
  return card(
    "Évolution de la banque",
    null,
    points.length >= 2 ? bankChart(points, format) : emptyState("Le graphique apparaîtra après quelques jours de suivi."),
  );
}

function weeksCard(calculator, range, dailyHours) {
  const weeks = weeklyTotals(calculator, WEEK_COUNT[range]);
  const labelEvery = Math.ceil(weeks.length / 6);
  const items = weeks.map((week, index) => ({
    label: index % labelEvery === 0 ? shortDate(week.monday) : "",
    value: week.worked / MS_PER_HOUR,
    isCurrent: index === weeks.length - 1,
    tip: `Semaine du ${shortDate(week.monday)} : ${formatHoursMinutes(week.worked)}`,
  }));
  const target = dailyHours * 5;
  return card("Heures par semaine", null, columnChart(items, target, `${target}h`));
}

function weekDaysCard(stats, dailyHours) {
  const items = WEEK_DAYS.map((label, index) => ({
    label,
    value: stats.byWeekDay[index] / MS_PER_HOUR,
    tip: `${label} : ${formatHoursMinutes(stats.byWeekDay[index])} en moyenne`,
  }));
  return card("Moyenne par jour de la semaine", null, columnChart(items, dailyHours, `${dailyHours}h`));
}

function timeShareCard(stats) {
  return card(
    "Répartition du temps",
    `${formatHoursMinutes(stats.totalPause)} de pause`,
    splitBar([
      { label: "Travail", value: stats.totalWorked, text: formatHoursMinutes(stats.totalWorked), className: "split-work" },
      { label: "Pauses", value: stats.totalPause, text: formatHoursMinutes(stats.totalPause), className: "split-pause" },
    ]),
  );
}

function heatLevel(info, target) {
  if (info.worked === 0) {
    return info.target === 0 ? "off" : 0;
  }
  const share = info.worked / (target || MS_PER_HOUR);
  if (share < 0.5) return 1;
  if (share < 0.9) return 2;
  return share < 1.125 ? 3 : 4;
}

function heatmapCard(calculator, dailyHours) {
  const today = parseKey(calculator.today);
  const firstMonday = addDays(startOfWeek(today), -7 * (HEATMAP_WEEKS - 1));
  const target = dailyHours * MS_PER_HOUR;
  let lastMonth = -1;
  const weeks = [];
  for (let weekIndex = 0; weekIndex < HEATMAP_WEEKS; weekIndex += 1) {
    const week = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = addDays(firstMonday, weekIndex * 7 + dayIndex);
      if (dateKey(date) > calculator.today) {
        week.push(null);
        continue;
      }
      const info = calculator.day(dateKey(date));
      const month = date.getMonth();
      // The last weeks have no room for a month name.
      const hasRoom = weekIndex < HEATMAP_WEEKS - 2;
      const monthLabel = dayIndex === 0 && month !== lastMonth && hasRoom ? date.toLocaleDateString("fr-CH", { month: "short" }) : "";
      if (dayIndex === 0) lastMonth = month;
      week.push({ level: heatLevel(info, target), tip: `${formatDay(date)} : ${formatHoursMinutes(info.worked)}`, monthLabel });
    }
    weeks.push(week);
  }
  return card("Mon année en un coup d'œil", "12 derniers mois", heatmap(weeks));
}

/**
 * Updates the screen.
 *
 * Args:
 *   app: The app object: { data, calculator }.
 */
export function renderStats(app) {
  const calculator = app.calculator();
  const { dailyHours, startDate } = app.data.settings;
  const rangeStart = dateKey(addDays(parseKey(calculator.today), -Number(activeRange) + 1));
  const fromKey = rangeStart > startDate ? rangeStart : startDate;
  const stats = periodStats(calculator, fromKey);
  const streak = targetStreak(calculator, startDate);

  root.replaceChildren(
    el("h1", { className: "screen-title", textContent: "Statistiques" }),
    segmented(RANGES, activeRange, (value) => {
      activeRange = value;
      renderStats(app);
    }),
    el(
      "div",
      { className: "tile-grid" },
      tile({ iconName: "today", tone: "blue", label: "Moyenne par jour", value: formatHoursMinutes(stats.averageWorked), hint: `Sur ${stats.daysWorked} jour${stats.daysWorked > 1 ? "s" : ""} travaillé${stats.daysWorked > 1 ? "s" : ""}` }),
      tile({ iconName: "coffee", tone: "orange", label: "Pause moyenne", value: formatHoursMinutes(stats.averagePause), hint: "Par jour travaillé" }),
      tile({ iconName: "sun", tone: "aqua", label: "Arrivée moyenne", value: formatMinutes(stats.averageArrival) }),
      tile({ iconName: "moon", tone: "violet", label: "Départ moyen", value: formatMinutes(stats.averageDeparture) }),
      tile({ iconName: "fire", tone: "orange", label: "Série en cours", value: `${streak} j`, hint: "Objectif atteint d'affilée" }),
      tile({ iconName: "sparkle", tone: "green", label: "Plus longue journée", value: stats.bestDay ? formatHoursMinutes(stats.bestDay.worked) : "–", hint: stats.bestDay ? formatDay(stats.bestDay.date) : null }),
    ),
    el(
      "div",
      { className: "columns-layout" },
      bankCard(calculator, fromKey),
      weeksCard(calculator, activeRange, dailyHours),
      weekDaysCard(stats, dailyHours),
      timeShareCard(stats),
    ),
    heatmapCard(calculator, dailyHours),
  );
}
