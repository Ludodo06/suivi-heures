// Saves the work sessions. All data access goes through this file.
// Today the data stays in this browser. To sync the phone and the computer,
// we only need to change this file.

const STORAGE_KEY = "suivi-heures.sessions";

/**
 * Reads all the saved sessions.
 *
 * Returns:
 *   An array of sessions: { id, start, end }. The dates are ISO strings.
 *   `end` is null while the session runs.
 */
export function loadSessions() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : [];
}

/**
 * Replaces all the saved sessions.
 *
 * Args:
 *   sessions: The array of sessions to save.
 */
export function saveSessions(sessions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}
