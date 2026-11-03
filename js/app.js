import { loadSessions, saveSessions } from "./storage.js";
import {
  formatClock,
  formatHoursMinutes,
  formatWithSeconds,
  startOfDay,
  startOfWeek,
  totalSince,
} from "./time.js";

const REFRESH_PERIOD_MS = 1000;

const timerValue = document.getElementById("timer-value");
const toggleButton = document.getElementById("toggle-button");
const totalToday = document.getElementById("total-today");
const totalWeek = document.getElementById("total-week");
const sessionList = document.getElementById("session-list");
const sessionEmpty = document.getElementById("session-empty");

let sessions = loadSessions();

// ----- sessions -----

/**
 * Returns the session that is running.
 *
 * Returns:
 *   The session without an end, or undefined if no session runs.
 */
function findRunningSession() {
  return sessions.find((session) => session.end === null);
}

/** Starts a new session, or stops the session that is running. */
function toggleSession() {
  const running = findRunningSession();
  const now = new Date().toISOString();
  if (running) {
    running.end = now;
  } else {
    sessions.push({ id: crypto.randomUUID(), start: now, end: null });
  }
  saveSessions(sessions);
  render();
}

// ----- display -----

/**
 * Shows the sessions of today, most recent first.
 *
 * Args:
 *   now: The current moment.
 */
function renderSessionList(now) {
  const dayStart = startOfDay(now);
  const todaySessions = sessions
    .filter((session) => !session.end || new Date(session.end) > dayStart)
    .reverse();

  sessionList.replaceChildren(
    ...todaySessions.map((session) => {
      const start = formatClock(new Date(session.start));
      const end = session.end ? formatClock(new Date(session.end)) : "en cours";
      const item = document.createElement("li");
      item.textContent = `${start} – ${end}`;
      return item;
    }),
  );
  sessionEmpty.hidden = todaySessions.length > 0;
}

/** Updates the whole page from the sessions and the current time. */
function render() {
  const now = new Date();
  const running = findRunningSession();

  const runningDuration = running ? now - new Date(running.start) : 0;
  timerValue.textContent = formatWithSeconds(runningDuration);
  toggleButton.textContent = running ? "Arrêter" : "Démarrer";
  toggleButton.classList.toggle("running", Boolean(running));

  totalToday.textContent = formatHoursMinutes(totalSince(sessions, startOfDay(now), now));
  totalWeek.textContent = formatHoursMinutes(totalSince(sessions, startOfWeek(now), now));
  renderSessionList(now);
}

// ----- start -----

toggleButton.addEventListener("click", toggleSession);
setInterval(render, REFRESH_PERIOD_MS);
render();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
