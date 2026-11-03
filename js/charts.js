// The charts of the app. They use plain SVG and HTML, without any library.
// Every value stays readable in the Historique screen, without hover or tap.

import { el } from "./dom.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const TOUCH_TIP_DURATION_MS = 2500;

function svg(tag, attributes = {}, ...children) {
  const element = document.createElementNS(SVG_NAMESPACE, tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  element.append(...children);
  return element;
}

// ----- tooltip -----

let tipElement = null;
let tipTimer = null;

function showTip(text, x, y) {
  if (!tipElement) {
    tipElement = el("div", { className: "chart-tip", role: "status" });
    document.body.append(tipElement);
  }
  tipElement.textContent = text;
  tipElement.hidden = false;
  const box = tipElement.getBoundingClientRect();
  const margin = 8;
  const left = Math.min(Math.max(x - box.width / 2, margin), window.innerWidth - box.width - margin);
  tipElement.style.left = `${left}px`;
  tipElement.style.top = `${Math.max(y - box.height - 10, margin)}px`;
}

function hideTip() {
  if (tipElement) {
    tipElement.hidden = true;
  }
}

/**
 * Shows a text when the pointer or the keyboard reaches a mark.
 *
 * Args:
 *   mark: The element of the mark. It can get the keyboard focus.
 *   text: The text to show. It also names the mark for screen readers.
 *
 * Returns:
 *   The same element.
 */
function withTip(mark, text) {
  mark.setAttribute("tabindex", "0");
  mark.setAttribute("aria-label", text);
  const atElement = () => {
    const box = mark.getBoundingClientRect();
    showTip(text, box.left + box.width / 2, box.top);
  };
  mark.addEventListener("pointerenter", (event) => showTip(text, event.clientX, event.clientY));
  mark.addEventListener("pointerleave", hideTip);
  mark.addEventListener("focus", atElement);
  mark.addEventListener("blur", hideTip);
  mark.addEventListener("click", () => {
    atElement();
    clearTimeout(tipTimer);
    tipTimer = setTimeout(hideTip, TOUCH_TIP_DURATION_MS);
  });
  return mark;
}

// ----- ring -----

/**
 * Creates the progress ring of the day.
 *
 * Args:
 *   progress: The done part of the target. 1 is complete, above 1 is extra time.
 *   size: The size in pixels.
 *
 * Returns:
 *   An SVG element.
 */
export function progressRing(progress, size = 232) {
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const arc = (share, className) =>
    svg("circle", {
      class: className,
      cx: size / 2,
      cy: size / 2,
      r: radius,
      "stroke-width": stroke,
      "stroke-linecap": "round",
      "stroke-dasharray": `${Math.max(share, 0.001) * length} ${length}`,
      transform: `rotate(-90 ${size / 2} ${size / 2})`,
      fill: "none",
    });
  return svg(
    "svg",
    { width: size, height: size, viewBox: `0 0 ${size} ${size}`, "aria-hidden": "true", class: "ring" },
    arc(1, "ring-track"),
    progress > 0 && arc(Math.min(progress, 1), "ring-work"),
    progress > 1 && arc(Math.min(progress - 1, 1), "ring-extra"),
  );
}

// ----- day timeline -----

/**
 * Creates the bar that shows the work and the pauses across a day.
 *
 * Args:
 *   segments: An array of { from, to, kind, tip }. `from` and `to` are Dates.
 *     `kind` is "work", "pause" or "open-pause".
 *   dayStart: The Date at 00:00 of the day.
 *   nowMark: The current moment, or null to hide its mark.
 *
 * Returns:
 *   The new element.
 */
export function dayTimeline(segments, dayStart, nowMark) {
  const toHours = (date) => (date - dayStart) / 3600000;
  const moments = segments.flatMap((segment) => [toHours(segment.from), toHours(segment.to)]);
  if (nowMark) {
    moments.push(toHours(nowMark));
  }
  const startHour = Math.min(7, Math.floor(Math.min(...moments, 7)));
  const endHour = Math.max(18, Math.ceil(Math.max(...moments, 18)));
  const position = (hours) => `${((hours - startHour) / (endHour - startHour)) * 100}%`;

  const track = el("div", { className: "timeline-track" });
  for (const segment of segments) {
    const start = toHours(segment.from);
    const width = ((toHours(segment.to) - start) / (endHour - startHour)) * 100;
    const mark = el("span", { className: `timeline-part timeline-${segment.kind}` });
    mark.style.left = position(start);
    mark.style.width = `${width}%`;
    track.append(withTip(mark, segment.tip));
  }
  if (nowMark) {
    const now = el("span", { className: "timeline-now" });
    now.style.left = position(toHours(nowMark));
    track.append(now);
  }

  const axis = el("div", { className: "timeline-axis" });
  const step = endHour - startHour > 14 ? 4 : 2;
  for (let hour = Math.ceil(startHour / step) * step; hour <= endHour; hour += step) {
    const label = el("span", { textContent: `${hour}h` });
    label.style.left = position(hour);
    axis.append(label);
  }
  return el("div", { className: "timeline" }, track, axis);
}

// ----- columns -----

/**
 * Creates a column chart with one series and a target line.
 *
 * Args:
 *   items: An array of { label, value, tip, isCurrent }. `value` is in hours.
 *   target: The value of the target line, or null for no line.
 *   targetLabel: The text of the target line.
 *
 * Returns:
 *   The new element.
 */
export function columnChart(items, target, targetLabel) {
  const highest = Math.max(target ?? 0, ...items.map((item) => item.value), 1) * 1.08;
  const plot = el("div", { className: "columns-plot" });
  if (target) {
    const line = el("div", { className: "columns-target" }, el("span", { textContent: targetLabel }));
    line.style.bottom = `${(target / highest) * 100}%`;
    plot.append(line);
  }
  const labels = el("div", { className: "columns-labels" });
  for (const item of items) {
    const bar = el("span", { className: `column-bar ${item.isCurrent ? "current" : ""}` });
    bar.style.height = `${(item.value / highest) * 100}%`;
    plot.append(withTip(el("div", { className: "column-slot" }, bar), item.tip));
    labels.append(el("span", { textContent: item.label }));
  }
  return el("div", { className: "columns" }, plot, labels);
}

// ----- line -----

function roundedStep(range) {
  const steps = [1, 2, 4, 5, 10, 20, 25, 50, 100, 200];
  return steps.find((step) => range / step <= 4) ?? 500;
}

/**
 * Creates the line chart of the hour bank. Above zero is blue, below zero is red.
 *
 * Args:
 *   points: An array of { label, value }. `value` is in hours.
 *   formatValue: Turns a value into a text.
 *
 * Returns:
 *   The new element.
 */
export function bankChart(points, formatValue) {
  const width = 360;
  const height = 180;
  const margin = { top: 16, right: 62, bottom: 22, left: 30 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const values = points.map((point) => point.value);
  const step = roundedStep(Math.max(...values, 0) - Math.min(...values, 0) || 1);
  const top = Math.ceil(Math.max(...values, 0) / step) * step || step;
  const bottom = Math.floor(Math.min(...values, 0) / step) * step;

  const x = (index) => margin.left + (index / (points.length - 1)) * plotWidth;
  const y = (value) => margin.top + ((top - value) / (top - bottom)) * plotHeight;
  const zero = y(0);
  const zeroShare = (zero - margin.top) / plotHeight;

  const line = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${zero.toFixed(1)} L${x(0).toFixed(1)} ${zero.toFixed(1)} Z`;

  const gradientId = `bank-${Math.random().toString(36).slice(2)}`;
  const gradient = svg(
    "linearGradient",
    { id: gradientId, gradientUnits: "userSpaceOnUse", x1: 0, x2: 0, y1: margin.top, y2: margin.top + plotHeight },
    svg("stop", { offset: zeroShare, class: "stop-positive" }),
    svg("stop", { offset: zeroShare, class: "stop-negative" }),
  );

  const grid = [];
  for (let value = bottom; value <= top; value += step) {
    grid.push(
      svg("line", { x1: margin.left, x2: width - margin.right, y1: y(value), y2: y(value), class: value === 0 ? "chart-baseline" : "chart-grid" }),
      Object.assign(svg("text", { x: margin.left - 6, y: y(value) + 3.5, "text-anchor": "end", class: "chart-text" }), { textContent: `${value}h` }),
    );
  }

  const lastIndex = points.length - 1;
  const firstLabel = Object.assign(svg("text", { x: margin.left, y: height - 6, class: "chart-text" }), { textContent: points[0].label });
  const lastLabel = Object.assign(svg("text", { x: x(lastIndex), y: height - 6, "text-anchor": "end", class: "chart-text" }), { textContent: points[lastIndex].label });
  const endLabel = Object.assign(svg("text", { x: x(lastIndex) + 8, y: y(values[lastIndex]) + 4, class: "chart-end" }), { textContent: formatValue(values[lastIndex]) });

  const crosshair = svg("line", { y1: margin.top, y2: margin.top + plotHeight, class: "chart-crosshair", visibility: "hidden" });
  const dot = svg("circle", { r: 4, class: "chart-dot", cx: x(lastIndex), cy: y(values[lastIndex]) });

  const chart = svg(
    "svg",
    { viewBox: `0 0 ${width} ${height}`, class: "bank-chart", role: "img", "aria-label": `Évolution de la banque d'heures, valeur actuelle ${formatValue(values[lastIndex])}` },
    svg("defs", {}, gradient),
    ...grid,
    svg("path", { d: area, fill: `url(#${gradientId})`, "fill-opacity": 0.1 }),
    svg("path", { d: line, fill: "none", stroke: `url(#${gradientId})`, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }),
    crosshair,
    dot,
    firstLabel,
    lastLabel,
    endLabel,
  );

  chart.addEventListener("pointermove", (event) => {
    const box = chart.getBoundingClientRect();
    const scale = box.width / width;
    const share = ((event.clientX - box.left) / scale - margin.left) / plotWidth;
    const index = Math.min(Math.max(Math.round(share * lastIndex), 0), lastIndex);
    crosshair.setAttribute("x1", x(index));
    crosshair.setAttribute("x2", x(index));
    crosshair.setAttribute("visibility", "visible");
    dot.setAttribute("cx", x(index));
    dot.setAttribute("cy", y(values[index]));
    showTip(`${formatValue(values[index])} · ${points[index].label}`, box.left + x(index) * scale, box.top + y(values[index]) * scale);
  });
  chart.addEventListener("pointerleave", () => {
    crosshair.setAttribute("visibility", "hidden");
    dot.setAttribute("cx", x(lastIndex));
    dot.setAttribute("cy", y(values[lastIndex]));
    hideTip();
  });
  return chart;
}

/**
 * Creates a very small line, for a tile.
 *
 * Args:
 *   values: The values of the line.
 *
 * Returns:
 *   An SVG element, or null with fewer than two values.
 */
export function sparkline(values) {
  if (values.length < 2) {
    return null;
  }
  const width = 120;
  const height = 28;
  const pad = 3;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const x = (index) => pad + (index / (values.length - 1)) * (width - 2 * pad);
  const y = (value) => pad + (high === low ? 0.5 : (high - value) / (high - low)) * (height - 2 * pad);
  const line = values.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(" ");
  return svg(
    "svg",
    { viewBox: `0 0 ${width} ${height}`, class: "sparkline", "aria-hidden": "true" },
    svg("path", { d: line, fill: "none", class: "sparkline-line" }),
    svg("circle", { cx: x(values.length - 1), cy: y(values[values.length - 1]), r: 2.5, class: "sparkline-dot" }),
  );
}

// ----- segmented bar -----

/**
 * Creates a bar split into parts, with its legend.
 *
 * Args:
 *   parts: An array of { label, value, text, className }. `text` is printed
 *     inside the part when it is wide enough.
 *
 * Returns:
 *   The new element.
 */
export function splitBar(parts) {
  const MIN_LABEL_SHARE = 0.14;
  const total = parts.reduce((sum, part) => sum + part.value, 0) || 1;
  const bar = el("div", { className: "split-bar" });
  for (const part of parts) {
    if (part.value <= 0) {
      continue;
    }
    const share = part.value / total;
    const block = el("span", { className: `split-part ${part.className}`, textContent: share >= MIN_LABEL_SHARE ? part.text : "" });
    block.style.flexGrow = String(part.value);
    bar.append(withTip(block, `${part.label} : ${part.text}`));
  }
  const legend = el(
    "ul",
    { className: "legend" },
    parts.map((part) => el("li", {}, el("span", { className: `swatch ${part.className}` }), part.label)),
  );
  return el("div", {}, bar, legend);
}

// ----- heatmap -----

/**
 * Creates the year heatmap, one cell per day.
 *
 * Args:
 *   weeks: An array of weeks. A week is an array of 7 cells, Monday first. A
 *     cell is null or { level, tip, monthLabel }. `level` goes from 0 to 4, or
 *     is "off" for a day without any expected work.
 *
 * Returns:
 *   The new element.
 */
export function heatmap(weeks) {
  const months = el("div", { className: "heatmap-months" });
  const grid = el("div", { className: "heatmap-grid" });
  weeks.forEach((week) => {
    const label = week.find((cell) => cell?.monthLabel)?.monthLabel ?? "";
    months.append(el("span", { textContent: label }));
    for (const cell of week) {
      if (!cell) {
        grid.append(el("span"));
        continue;
      }
      grid.append(withTip(el("span", { className: `heat heat-${cell.level}` }), cell.tip));
    }
  });
  const legend = el(
    "div",
    { className: "heatmap-legend" },
    el("span", { textContent: "0h" }),
    [0, 1, 2, 3, 4].map((level) => el("span", { className: `heat heat-${level}` })),
    el("span", { textContent: "9h et plus" }),
  );
  const scroller = el("div", { className: "heatmap-scroll" }, months, grid);
  return el("div", {}, scroller, legend);
}
