export const $ = (selector, root = document) => root.querySelector(selector);

export const $$ = (selector, root = document) => [
  ...root.querySelectorAll(selector),
];

const TACTICS = new Map([
  ["TA0010", "Exfiltration"],
  ["TA0008", "Lateral Movement"],
  ["TA0011", "Command and Control"],
  ["TA0040", "Impact"],
  ["TA0043", "Reconnaissance"],
]);

export function tacticName(id) {
  if (!id) return "None";
  return TACTICS.get(id) ?? id;
}

export function formatInt(value) {
  return new Intl.NumberFormat("en-US").format(Number(value ?? 0));
}

export function formatRate(part, total) {
  if (!total) return "0.0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

export function formatClock(iso) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatAgo(iso) {
  const seconds = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (seconds < 1) return "now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function formatShort(iso) {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function probabilityClass(value) {
  if (value >= 0.9) return "is-hot";
  if (value >= 0.7) return "is-warn";
  return "is-calm";
}

export function toast(message, kind = "info") {
  const host = $("#toasts");
  if (!host) return;

  const node = document.createElement("div");
  node.className = `toast ${kind}`;
  node.textContent = message;
  host.append(node);

  window.setTimeout(() => node.remove(), 4200);
}

export function clear(node) {
  while (node?.firstChild) node.removeChild(node.firstChild);
}

export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
