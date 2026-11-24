// The tasks and the time spent on each of them. No access to the page or to the
// storage here.
//
// The task log says "from this moment, I work on this task". A moment of work
// belongs to the last task chosen since the start of its work period. Work
// without any choice in its period is "not filled in": it stays out of the
// distribution. All the work saved before the tasks existed is in this case.

import { addDays, dateKey, startOfDay } from "./time.js";

/** The id of the default task. It always exists and cannot be archived. */
export const OTHER_TASK_ID = "other";

/** The default task. */
export const OTHER_TASK = { name: "Autre", color: "slate", archived: false };

/** The label of the work without any task. */
export const UNSET_LABEL = "Non renseignée";

/** The colors that a task can take, from color name to label. */
export const TASK_COLORS = {
  blue: "Bleu",
  teal: "Turquoise",
  violet: "Violet",
  pink: "Rose",
  green: "Vert",
  brown: "Brun",
  slate: "Gris",
};

/**
 * Lists the tasks that can be chosen, the default task first.
 *
 * Args:
 *   tasks: The tasks, from id to { name, color, archived }.
 *
 * Returns:
 *   An array of { id, name, color }, sorted by name after "Autre".
 */
export function activeTasks(tasks) {
  const others = Object.entries(tasks)
    .filter(([id, task]) => id !== OTHER_TASK_ID && !task.archived)
    .map(([id, task]) => ({ id, ...task }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return [{ id: OTHER_TASK_ID, ...(tasks[OTHER_TASK_ID] ?? OTHER_TASK) }, ...others];
}

/**
 * Gives the name of a task.
 *
 * Args:
 *   tasks: The tasks.
 *   taskId: The id of the task, or null for the work without any task.
 *
 * Returns:
 *   The name, or "Non renseignée".
 */
export function taskName(tasks, taskId) {
  if (taskId === null) {
    return UNSET_LABEL;
  }
  return tasks[taskId]?.name ?? "Tâche supprimée";
}

/**
 * Chooses a color for a new task: the first one that no active task uses.
 *
 * Args:
 *   tasks: The tasks.
 *
 * Returns:
 *   A color name of TASK_COLORS.
 */
export function nextTaskColor(tasks) {
  const used = new Set(Object.values(tasks).filter((task) => !task.archived).map((task) => task.color));
  const names = Object.keys(TASK_COLORS).filter((name) => name !== "slate");
  return names.find((name) => !used.has(name)) ?? names[Object.keys(tasks).length % names.length];
}

/**
 * Cuts all the work into pieces, one per task.
 *
 * Args:
 *   sessions: The work sessions: { id, start, end }.
 *   taskLog: The task changes, from id to { at, taskId }.
 *   now: The current moment. It is the end of a session that still runs.
 *
 * Returns:
 *   An array of { from, to, taskId }, sorted by time. `from` and `to` are
 *   Dates. `taskId` is null for the work without any task.
 */
export function taskPieces(sessions, taskLog, now) {
  const changes = Object.values(taskLog).sort((a, b) => a.at.localeCompare(b.at));
  const sorted = [...sessions].sort((a, b) => a.start.localeCompare(b.start));
  const pieces = [];
  let index = 0;
  for (const session of sorted) {
    const start = new Date(session.start);
    const end = session.end ? new Date(session.end) : now;
    while (index < changes.length && new Date(changes[index].at) < start) {
      index += 1;
    }
    let from = start;
    let taskId = null;
    while (index < changes.length && new Date(changes[index].at) < end) {
      const at = new Date(changes[index].at);
      if (at > from) {
        pieces.push({ from, to: at, taskId });
        from = at;
      }
      taskId = changes[index].taskId;
      index += 1;
    }
    if (end > from) {
      pieces.push({ from, to: end, taskId });
    }
  }
  return pieces;
}

/**
 * Cuts the pieces of work at midnight.
 *
 * Args:
 *   pieces: The pieces, from `taskPieces`.
 *
 * Returns:
 *   The same pieces, each one inside a single day, with its day key.
 */
function piecesByDay(pieces) {
  const result = [];
  for (const piece of pieces) {
    let cursor = piece.from;
    while (cursor < piece.to) {
      const nextDay = addDays(startOfDay(cursor), 1);
      const to = piece.to < nextDay ? piece.to : nextDay;
      result.push({ key: dateKey(cursor), from: cursor, to, taskId: piece.taskId });
      cursor = to;
    }
  }
  return result;
}

/**
 * Gives the pieces of work of one day, for the timeline.
 *
 * Args:
 *   data: The saved data.
 *   key: The key of the day.
 *   now: The current moment.
 *
 * Returns:
 *   An array of { from, to, taskId }.
 */
export function dayTaskPieces(data, key, now) {
  return piecesByDay(taskPieces(data.sessions, data.taskLog, now)).filter((piece) => piece.key === key);
}

/**
 * Adds up the time of each task over some days.
 *
 * Args:
 *   data: The saved data.
 *   fromKey: The key of the first day.
 *   toKey: The key of the last day.
 *   now: The current moment.
 *
 * Returns:
 *   { byTask, byDay, unset }. `byTask` is a Map from task id to milliseconds,
 *   without the work that is not filled in. `byDay` is a Map from day key to
 *   such a Map. `unset` is the work that is not filled in, in milliseconds.
 */
export function taskTotals(data, fromKey, toKey, now) {
  const byTask = new Map();
  const byDay = new Map();
  let unset = 0;
  for (const piece of piecesByDay(taskPieces(data.sessions, data.taskLog, now))) {
    if (piece.key < fromKey || piece.key > toKey) {
      continue;
    }
    const duration = piece.to - piece.from;
    if (piece.taskId === null) {
      unset += duration;
      continue;
    }
    byTask.set(piece.taskId, (byTask.get(piece.taskId) ?? 0) + duration);
    if (!byDay.has(piece.key)) {
      byDay.set(piece.key, new Map());
    }
    const day = byDay.get(piece.key);
    day.set(piece.taskId, (day.get(piece.taskId) ?? 0) + duration);
  }
  return { byTask, byDay, unset };
}

/**
 * Finds the task of the running work.
 *
 * Args:
 *   data: The saved data.
 *
 * Returns:
 *   { taskId, since } for the running session, or null when no session runs.
 *   `taskId` is null when no task was chosen in this session. `since` is the
 *   Date of the last change, or the start of the session.
 */
export function currentTask(data) {
  const running = data.sessions.find((session) => session.end === null);
  if (!running) {
    return null;
  }
  const last = Object.values(data.taskLog)
    .filter((change) => change.at >= running.start)
    .sort((a, b) => a.at.localeCompare(b.at))
    .at(-1);
  return last ? { taskId: last.taskId, since: new Date(last.at) } : { taskId: null, since: new Date(running.start) };
}

/**
 * Checks the name of a task.
 *
 * Args:
 *   tasks: The tasks.
 *   name: The name typed by the user.
 *   exceptId: The id of the task being renamed, or null for a new task.
 *
 * Returns:
 *   A message for the user, or null when the name is valid.
 */
export function taskNameError(tasks, name, exceptId = null) {
  const MAX_LENGTH = 40;
  const clean = name.trim();
  if (!clean) {
    return "Donne un nom à la tâche.";
  }
  if (clean.length > MAX_LENGTH) {
    return `Le nom est trop long (${MAX_LENGTH} caractères au plus).`;
  }
  const taken = Object.entries(tasks).some(
    ([id, task]) => id !== exceptId && !task.archived && task.name.toLocaleLowerCase("fr") === clean.toLocaleLowerCase("fr"),
  );
  return taken ? "Une tâche porte déjà ce nom." : null;
}

/**
 * Adds a task. The name must be valid: see `taskNameError`.
 *
 * Args:
 *   tasks: The tasks. The new task is added to this object.
 *   name: The name of the task.
 *
 * Returns:
 *   The id of the new task.
 */
export function addTask(tasks, name) {
  const id = crypto.randomUUID();
  tasks[id] = { name: name.trim(), color: nextTaskColor(tasks), archived: false };
  return id;
}
