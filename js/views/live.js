import { api } from "../api.js";
import {
  $,
  clear,
  element,
  formatAgo,
  formatClock,
  probabilityClass,
  tacticName,
} from "../ui.js";

const THRESHOLD = 0.7;
const FEED_LIMIT = 40;

export function mountLive() {}

export async function refreshLiveBadge() {
  const badge = $("#live-badge");
  const label = $("#live-label");
  if (!badge || !label) return;

  try {
    const page = await api.flows({ limit: 1 });
    const newest = page.records?.[0];
    badge.hidden = false;
    badge.classList.toggle("is-idle", !newest);
    label.textContent = newest ? `RECEIVING · ${formatAgo(newest.ts)}` : "IDLE";
  } catch {
    badge.hidden = false;
    badge.classList.add("is-idle");
    label.textContent = "OFFLINE";
  }
}

export async function refreshLive() {
  const page = await api.flows({
    min_probability: THRESHOLD,
    limit: FEED_LIMIT,
  });

  renderFeed(page.records);

  const status = $("#live-status");
  if (status) {
    status.textContent =
      `AUTO-REFRESH · 3S · THRESHOLD ${THRESHOLD.toFixed(2)} · ` +
      `${page.records.length} RECENT`;
  }
}

function renderFeed(records) {
  const body = $("#live-body");
  if (!body) return;
  clear(body);

  if (!records.length) {
    const row = element("tr");
    const cell = element(
      "td",
      "empty",
      "Waiting for detections above the threshold…",
    );
    cell.colSpan = 6;
    row.append(cell);
    body.append(row);
    return;
  }

  for (const record of records) {
    const row = element("tr");
    row.append(element("td", "mono", formatClock(record.ts)));
    row.append(
      element("td", "mono", `${record.src_ip}:${record.src_port}`),
    );
    row.append(
      element("td", "mono", `${record.dst_ip}:${record.dst_port}`),
    );
    row.append(element("td", null, record.protocol.toUpperCase()));
    row.append(
      element(
        "td",
        `probability ${probabilityClass(record.anomaly_probability)}`,
        record.anomaly_probability.toFixed(3),
      ),
    );
    row.append(element("td", null, tacticName(record.mitre_tactic)));
    body.append(row);
  }
}
