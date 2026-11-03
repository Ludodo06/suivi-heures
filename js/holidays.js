// Public holidays of the canton of Vaud (Switzerland).

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const cache = new Map();

/**
 * Returns the date of Easter Sunday (Gregorian calendar).
 *
 * Args:
 *   year: The year.
 *
 * Returns:
 *   The date of Easter Sunday, in UTC to avoid clock change problems.
 */
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Returns the Monday after the third Sunday of September (Jeune federal).
 *
 * Args:
 *   year: The year.
 *
 * Returns:
 *   The date of that Monday, in UTC.
 */
function fastMonday(year) {
  const firstOfSeptember = new Date(Date.UTC(year, 8, 1));
  const daysToSunday = (7 - firstOfSeptember.getUTCDay()) % 7;
  return new Date(Date.UTC(year, 8, 1 + daysToSunday + 14 + 1));
}

/**
 * Returns the public holidays of a year.
 *
 * Args:
 *   year: The year.
 *
 * Returns:
 *   A Map from day key ("2026-08-01") to the holiday name.
 */
export function holidaysOf(year) {
  if (cache.has(year)) {
    return cache.get(year);
  }
  const easter = easterSunday(year).getTime();
  const afterEaster = (days) => new Date(easter + days * MS_PER_DAY).toISOString().slice(0, 10);
  const holidays = new Map([
    [`${year}-01-01`, "Nouvel An"],
    [`${year}-01-02`, "Saint-Berchtold"],
    [afterEaster(-2), "Vendredi saint"],
    [afterEaster(1), "Lundi de Pâques"],
    [afterEaster(39), "Ascension"],
    [afterEaster(50), "Lundi de Pentecôte"],
    [`${year}-08-01`, "Fête nationale"],
    [fastMonday(year).toISOString().slice(0, 10), "Lundi du Jeûne fédéral"],
    [`${year}-12-25`, "Noël"],
  ]);
  cache.set(year, holidays);
  return holidays;
}
