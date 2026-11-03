// The line icons of the app.

const PATHS = {
  today: "M12 7v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  list: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  calendar: "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2",
  chart: "M4 20V10 M10 20V4 M16 20v-7 M21 20H3",
  settings: "M4 7h9 M17 7h3 M4 17h3 M11 17h9 M15 5v4 M9 15v4",
  play: "M7 4.5v15l12-7.5z",
  pause: "M8 5v14 M16 5v14",
  flag: "M5 21V4 M5 4h13l-3 4.5 3 4.5H5",
  coffee: "M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z M17 10h1.5a2.5 2.5 0 0 1 0 5H17 M8 3v2 M12 3v2",
  bank: "M3 10h18 M12 3l9 7H3z M5 10v8 M10 10v8 M14 10v8 M19 10v8 M3 21h18",
  target: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  hourglass: "M6 3h12 M6 21h12 M7 3v4l5 5 5-5V3 M7 21v-4l5-5 5 5v4",
  week: "M4 18V13 M9 18V8 M14 18v-6 M19 18V6",
  sun: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5 19 19 M5 19l1.5-1.5 M17.5 6.5 19 5",
  party: "M4 21l5-14 9 9z M14 4v2 M19 9h2 M17 6l2-2",
  alert: "M12 9v4 M12 17h.01 M10.3 4 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0",
  pencil: "M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z",
  download: "M12 3v12 M7 11l5 5 5-5 M4 21h16",
  upload: "M12 16V4 M7 9l5-5 5 5 M4 21h16",
  left: "M15 5l-7 7 7 7",
  right: "M9 5l7 7-7 7",
  plus: "M12 5v14 M5 12h14",
  fire: "M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 1-3-1-6 1-10",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 16v4 M17 18h4",
  moon: "M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5",
};

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/**
 * Creates an icon.
 *
 * Args:
 *   name: The name of the icon, a key of `PATHS`.
 *   size: The size in pixels.
 *
 * Returns:
 *   An SVG element. It is hidden from screen readers: a text must go with it.
 */
export function icon(name, size = 20) {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "icon");
  const path = document.createElementNS(SVG_NAMESPACE, "path");
  path.setAttribute("d", PATHS[name]);
  svg.append(path);
  return svg;
}
