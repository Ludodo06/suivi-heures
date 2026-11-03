// Small helpers to build the page. Texts always go through textContent.

import { icon } from "./icons.js";

/**
 * Creates a page element.
 *
 * Args:
 *   tag: The tag name.
 *   properties: The element properties, for example { className, onclick }.
 *   children: The child elements or texts. Empty values are skipped.
 *
 * Returns:
 *   The new element.
 */
export function el(tag, properties = {}, ...children) {
  const element = document.createElement(tag);
  Object.assign(element, properties);
  element.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false && child !== ""));
  return element;
}

/**
 * Creates a tile with an icon, a label and a value.
 *
 * Args:
 *   options: { iconName, tone, label, value, hint, extra }. `tone` picks the
 *     color of the icon. `hint` is a small text. `extra` is an optional element
 *     under the value.
 *
 * Returns:
 *   The new element.
 */
export function tile({ iconName, tone = "blue", label, value, hint, extra }) {
  return el(
    "div",
    { className: "tile" },
    el(
      "div",
      { className: "tile-head" },
      iconName && el("span", { className: `chip chip-${tone}` }, icon(iconName, 16)),
      el("span", { className: "tile-label", textContent: label }),
    ),
    el("span", { className: "tile-value", textContent: value }),
    hint && el("span", { className: "tile-hint", textContent: hint }),
    extra,
  );
}

/**
 * Creates a card with a title.
 *
 * Args:
 *   title: The title of the card.
 *   subtitle: A small text beside the title, or null.
 *   children: The content of the card.
 *
 * Returns:
 *   The new element.
 */
export function card(title, subtitle, ...children) {
  return el(
    "section",
    { className: "card" },
    el(
      "header",
      { className: "card-head" },
      el("h2", { textContent: title }),
      subtitle && el("span", { className: "card-subtitle", textContent: subtitle }),
    ),
    ...children,
  );
}

/**
 * Creates a row of choices where only one is active.
 *
 * Args:
 *   options: An array of [value, label].
 *   active: The active value.
 *   onChange: Called with the new value.
 *
 * Returns:
 *   The new element.
 */
export function segmented(options, active, onChange) {
  return el(
    "div",
    { className: "segmented", role: "group" },
    options.map(([value, label]) =>
      el("button", {
        type: "button",
        className: value === active ? "active" : "",
        textContent: label,
        ariaPressed: String(value === active),
        onclick: () => onChange(value),
      }),
    ),
  );
}

/**
 * Creates the message shown when a chart has no data yet.
 *
 * Args:
 *   text: The message.
 *
 * Returns:
 *   The new element.
 */
export function emptyState(text) {
  return el("p", { className: "empty-state", textContent: text });
}

let toastTimer = null;

/**
 * Shows a short message at the bottom of the page.
 *
 * Args:
 *   message: The message.
 *   undo: Called if the user presses "Annuler", or null for no such button.
 */
export function showToast(message, undo = null) {
  const TOAST_DURATION_MS = 5000;
  const toast = document.getElementById("toast");
  clearTimeout(toastTimer);
  toast.replaceChildren(
    el("span", { textContent: message }),
    undo &&
      el("button", {
        type: "button",
        textContent: "Annuler",
        onclick: () => {
          toast.hidden = true;
          undo();
        },
      }),
  );
  toast.hidden = false;
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, TOAST_DURATION_MS);
}
