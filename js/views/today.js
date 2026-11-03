// The main screen: the progress of the day, the actions and a few widgets.

import { dayNote } from "../calculator.js";
import { columnChart, dayTimeline, progressRing, sparkline } from "../charts.js";
import { card, el, tile } from "../dom.js";
import { icon } from "../icons.js";
import { nextHoliday, nextVacation } from "../insights.js";
import {
  MS_PER_HOUR,
  addDays,
  dateKey,
  formatClock,
  formatDay,
  formatHoursMinutes,
  formatLongDay,
  formatSigned,
  parseKey,
  startOfDay,
  startOfWeek,
} from "../time.js";

const root = document.getElementById("today-root");
const BANK_SPARKLINE_DAYS = 14;
const WEEK_LETTERS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

let secondsElement = null;
let lastKey = null;

function greeting(now, name) {
  const hour = now.getHours();
  const word = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  return name ? `${word} ${name}` : word;
}

function dayState(app, calculator) {
  const { sessions, closedDays } = app.data;
  const running = sessions.find((session) => session.end === null);
  const forgotten = Boolean(running) && dateKey(new Date(running.start)) !== calculator.today;
  const todaySessions = sessions
    .filter((session) => dateKey(new Date(session.start)) === calculator.today)
    .sort((a, b) => a.start.localeCompare(b.start));
  const isClosed = Boolean(closedDays[calculator.today]);
  const name = forgotten ? "forgotten" : running ? "work" : isClosed ? "closed" : todaySessions.length ? "pause" : "idle";
  return { name, running, todaySessions };
}

const STATUS = {
  idle: { text: "Pas encore commencé", iconName: "sun" },
  work: { text: "Au travail", iconName: "play" },
  pause: { text: "En pause", iconName: "coffee" },
  closed: { text: "Journée terminée", iconName: "flag" },
  forgotten: { text: "Chrono oublié", iconName: "alert" },
};

function timelineSegments(todaySessions, now, state) {
  const segments = [];
  todaySessions.forEach((session, index) => {
    const from = new Date(session.start);
    const to = session.end ? new Date(session.end) : now;
    segments.push({ from, to, kind: "work", tip: `Travail ${formatClock(from)} – ${session.end ? formatClock(to) : "en cours"}` });
    const next = todaySessions[index + 1];
    if (next) {
      const pauseEnd = new Date(next.start);
      segments.push({ from: to, to: pauseEnd, kind: "pause", tip: `Pause ${formatClock(to)} – ${formatClock(pauseEnd)} (${formatHoursMinutes(pauseEnd - to)})` });
    } else if (state === "pause") {
      segments.push({ from: to, to: now, kind: "open-pause", tip: `Pause en cours depuis ${formatClock(to)}` });
    }
  });
  return segments;
}

function actionButtons(app, state) {
  const { name, running } = state;
  const button = (id, className, iconName, text, onclick) =>
    el("button", { id, type: "button", className, onclick }, icon(iconName, 20), text);
  const today = () => dateKey(new Date());

  const start = (message) => () =>
    app.action(message, () => {
      delete app.data.closedDays[today()];
      app.data.sessions.push({ id: crypto.randomUUID(), start: new Date().toISOString(), end: null });
    });
  const finish = () =>
    app.action("Journée terminée", () => {
      const open = app.data.sessions.find((session) => session.end === null);
      if (open) {
        open.end = new Date().toISOString();
      }
      app.data.closedDays[today()] = true;
    });

  if (name === "forgotten") {
    return [button("toggle-button", "action action-warn", "pencil", "Corriger", () => app.openDay(dateKey(new Date(running.start))))];
  }
  if (name === "work") {
    return [
      button("toggle-button", "action action-pause", "pause", "Pause", () =>
        app.action("Pause commencée", () => {
          running.end = new Date().toISOString();
        }),
      ),
      button("finish-button", "action action-finish", "flag", "Terminer", finish),
    ];
  }
  if (name === "pause") {
    return [
      button("toggle-button", "action action-start", "play", "Reprendre", start("Travail repris")),
      button("finish-button", "action action-finish", "flag", "Terminer", finish),
    ];
  }
  if (name === "closed") {
    return [button("toggle-button", "action action-finish", "play", "Reprendre le travail", start("Journée rouverte"))];
  }
  return [button("toggle-button", "action action-start", "play", "Démarrer", start("Bonne journée !"))];
}

function heroSubtitle(state, info, now, todaySessions) {
  if (state === "pause") {
    const lastEnd = new Date(todaySessions[todaySessions.length - 1].end);
    return `Depuis ${formatHoursMinutes(now - lastEnd)}`;
  }
  return info.target > 0 ? `sur ${formatHoursMinutes(info.target)}` : "Aucune heure due";
}

function buildWeekChart(calculator) {
  const monday = startOfWeek(parseKey(calculator.today));
  const days = WEEK_LETTERS.map((label, index) => {
    const info = calculator.day(dateKey(addDays(monday, index)));
    return {
      label,
      value: info.worked / MS_PER_HOUR,
      isCurrent: info.key === calculator.today,
      tip: `${formatDay(info.date)} : ${formatHoursMinutes(info.worked)}`,
      target: info.target,
    };
  });
  const usual = Math.max(...days.map((day) => day.target), 0) / MS_PER_HOUR;
  const weekTarget = days.reduce((sum, day) => sum + day.target, 0);
  return card(
    "Cette semaine",
    `${formatHoursMinutes(calculator.weekWorked())} sur ${formatHoursMinutes(weekTarget)}`,
    columnChart(days, usual || null, `${usual}h`),
  );
}

function bankSparkline(calculator) {
  const values = [];
  const today = parseKey(calculator.today);
  for (let offset = BANK_SPARKLINE_DAYS - 1; offset >= 0; offset -= 1) {
    const bank = calculator.bankAfter(dateKey(addDays(today, -offset)));
    if (bank !== null) {
      values.push(bank);
    }
  }
  return sparkline(values);
}

function bankHint(bank, dailyHours) {
  const days = Math.abs(bank) / (dailyHours * MS_PER_HOUR);
  if (days < 0.1) return "À l'équilibre";
  const text = days.toLocaleString("fr-CH", { maximumFractionDigits: 1 });
  return bank > 0 ? `Soit ${text} j d'avance` : `Soit ${text} j à rattraper`;
}

function widgets(app, calculator) {
  const holiday = nextHoliday(calculator.today, app.data.holidayOverrides);
  const vacation = nextVacation(app.data.absences, calculator.today);
  const inDays = (days) => (days === 1 ? "Demain" : `Dans ${days} jours`);
  return el(
    "div",
    { className: "tile-grid" },
    holiday && tile({ iconName: "party", tone: "orange", label: "Prochain férié", value: inDays(holiday.days), hint: `${holiday.name}, ${formatDay(parseKey(holiday.key))}` }),
    tile(
      vacation
        ? { iconName: "sun", tone: "aqua", label: "Prochaines vacances", value: inDays(vacation.days), hint: formatDay(parseKey(vacation.key)) }
        : { iconName: "sun", tone: "aqua", label: "Prochaines vacances", value: "À poser", hint: "Depuis le calendrier" },
    ),
  );
}

function buildToday(app, calculator, state, now) {
  const info = calculator.day(calculator.today);
  const { name, running, todaySessions } = state;
  const remaining = info.target - info.worked;
  const status = STATUS[name];

  const hero = el(
    "header",
    { className: "hero" },
    el("p", { className: "hero-greeting", textContent: greeting(now, app.data.settings.profileName) }),
    el("h1", { textContent: formatLongDay(now) }),
    dayNote(info) && el("p", { className: "hero-note", textContent: dayNote(info) }),
  );

  const warning =
    name === "forgotten" &&
    el(
      "p",
      { id: "warning", className: "warning" },
      icon("alert", 20),
      `Le chrono tourne depuis ${formatDay(new Date(running.start))} à ${formatClock(new Date(running.start))}. Appuie sur « Corriger » pour indiquer l'heure de fin.`,
    );

  secondsElement = el("small", { id: "timer-seconds", className: "ring-seconds" });
  const timer = card(
    "",
    null,
    el(
      "div",
      { className: "ring-wrap" },
      progressRing(info.target > 0 ? info.worked / info.target : 0),
      el(
        "div",
        { className: "ring-center" },
        el("span", { id: "status", className: `status status-${name}` }, icon(status.iconName, 14), status.text),
        el("span", { id: "timer-value", className: "ring-value" }, formatHoursMinutes(info.worked), secondsElement),
        el("span", { id: "pause-value", className: "ring-sub", textContent: heroSubtitle(name, info, now, todaySessions) }),
      ),
    ),
    el("div", { className: "actions" }, actionButtons(app, state)),
  );
  timer.classList.add("card-timer");
  timer.querySelector(".card-head").remove();

  const canFinish = name === "work" && remaining > 0;
  const lastEnd = todaySessions.length ? todaySessions[todaySessions.length - 1].end : null;
  const stats = el(
    "div",
    { className: "tile-grid" },
    tile({ iconName: "coffee", tone: "orange", label: "Pauses du jour", value: formatHoursMinutes(info.pause), hint: todaySessions.length > 1 ? `${todaySessions.length - 1} pause${todaySessions.length > 2 ? "s" : ""}` : "Aucune pour l'instant" }),
    remaining > 0
      ? tile({ iconName: "hourglass", tone: "violet", label: "Reste à faire", value: formatHoursMinutes(remaining), hint: `${Math.round((info.worked / info.target) * 100)} % de l'objectif` })
      : tile({ iconName: "sparkle", tone: "violet", label: "Heures en plus", value: formatSigned(-remaining), hint: info.target ? "Objectif atteint" : "S'ajoutent à la banque" }),
    tile({
      iconName: "target",
      tone: "green",
      label: name === "closed" ? "Fin de journée" : "Fin prévue",
      value: canFinish ? formatClock(new Date(now.getTime() + remaining)) : name === "closed" && lastEnd ? formatClock(new Date(lastEnd)) : "–",
      hint: canFinish ? "Si tu ne fais plus de pause" : null,
    }),
    tile({
      iconName: "bank",
      tone: "blue",
      label: "Banque d'heures",
      value: formatSigned(calculator.bank),
      hint: bankHint(calculator.bank, app.data.settings.dailyHours),
      extra: bankSparkline(calculator),
    }),
  );

  const segments = timelineSegments(todaySessions, now, name);
  const showNow = name === "work" || name === "pause" || name === "idle";
  const timeline = card(
    "Ma journée",
    null,
    dayTimeline(segments, startOfDay(now), showNow ? now : null),
    el(
      "ul",
      { className: "legend" },
      el("li", {}, el("span", { className: "swatch timeline-work" }), "Travail"),
      el("li", {}, el("span", { className: "swatch timeline-pause" }), "Pause"),
    ),
    el(
      "ul",
      { id: "today-periods", className: "period-chips" },
      todaySessions.map((session) =>
        el("li", { textContent: `${formatClock(new Date(session.start))} – ${session.end ? formatClock(new Date(session.end)) : "en cours"}` }),
      ),
    ),
    el(
      "button",
      { id: "edit-today", type: "button", className: "secondary full", onclick: () => app.openDay(calculator.today) },
      icon("pencil", 16),
      "Modifier la journée",
    ),
  );

  root.replaceChildren(
    ...[hero, warning, timer, stats, timeline, buildWeekChart(calculator), widgets(app, calculator)].filter(Boolean),
  );
}

/**
 * Updates the screen. The page is only rebuilt when something visible changes;
 * the seconds are updated alone.
 *
 * Args:
 *   app: The app object.
 *   force: True to rebuild the screen in any case.
 */
export function renderToday(app, force = true) {
  const now = new Date();
  const calculator = app.calculator();
  const state = dayState(app, calculator);
  const key = `${state.name}|${formatClock(now)}`;
  if (force || key !== lastKey) {
    lastKey = key;
    buildToday(app, calculator, state, now);
  }
  const worked = calculator.day(calculator.today).worked;
  secondsElement.textContent = ` ${String(Math.floor(worked / 1000) % 60).padStart(2, "0")}s`;
}
