import {
  $,
  element,
  formatClock,
  formatInt,
  formatRate,
  probabilityClass,
  tacticName,
} from "./ui.js";

const SNAPSHOT = "assets/detections.json";
const TACTIC_ORDER = ["TA0010", "TA0008", "TA0011", "TA0040", "TA0043"];
const SVG_NS = "http://www.w3.org/2000/svg";

function renderTactics(counts) {
  const host = $("#live-tactics");
  if (!host) return;
  host.replaceChildren();

  const entries = TACTIC_ORDER.map((id) => [id, counts[id] ?? 0]);
  const max = Math.max(...entries.map(([, value]) => value), 0);

  for (const [id, value] of entries) {
    const row = element("li");
    if (value > 0 && value === max) row.className = "is-hot";
    row.append(element("span", "name", tacticName(id)));
    row.append(element("span", "value", formatInt(value)));
    host.append(row);
  }
}

function buildDot(x, y, radius) {
  const dot = document.createElementNS(SVG_NS, "circle");
  dot.setAttribute("cx", x.toFixed(1));
  dot.setAttribute("cy", y.toFixed(1));
  dot.setAttribute("r", radius.toFixed(1));
  dot.setAttribute("fill", "#f0abfc");
  dot.setAttribute("opacity", "0.9");
  return dot;
}

function renderChart(points) {
  const host = $("#live-chart");
  if (!host) return;
  host.replaceChildren();

  if (!points.length) {
    host.append(element("p", "mono muted", "No timeline data yet."));
    return;
  }

  const width = 640;
  const height = 150;
  const pad = 10;
  const max = Math.max(...points.map((point) => point.flows), 1);
  const maxAnomalies = Math.max(
    ...points.map((point) => point.anomalies),
    1,
  );
  const step =
    points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
  const toY = (value) =>
    height - pad - (value / max) * (height - pad * 2);

  const coords = points.map((point, index) => ({
    x: pad + index * step,
    y: toY(point.flows),
  }));

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Anomalies over time");

  const area = document.createElementNS(SVG_NS, "polygon");
  const base = (height - pad).toFixed(1);
  const polygon = [
    `${coords[0].x.toFixed(1)},${base}`,
    ...coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`),
    `${coords[coords.length - 1].x.toFixed(1)},${base}`,
  ].join(" ");
  area.setAttribute("points", polygon);
  area.setAttribute("fill", "rgba(196, 181, 253, 0.12)");
  svg.append(area);

  const line = document.createElementNS(SVG_NS, "polyline");
  line.setAttribute("points", coords
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" "));
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "#c4b5fd");
  line.setAttribute("stroke-width", "1.6");
  line.setAttribute("opacity", "0.85");
  svg.append(line);

  points.forEach((point, index) => {
    if (!point.anomalies) return;
    const radius = 2 + (point.anomalies / maxAnomalies) * 4;
    svg.append(buildDot(coords[index].x, coords[index].y, radius));
  });

  host.append(svg);
}

function renderTable(records) {
  const body = $("#landing-detections");
  const count = $("#live-count");
  if (!body) return;
  body.replaceChildren();

  if (count) {
    count.textContent = `${records.length} most recent`;
  }

  if (!records.length) {
    const row = element("tr");
    const cell = element("td", "empty", "No detections above 0.70 yet.");
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

function render(data) {
  const stamp = $("#live-stamp");
  if (stamp) {
    stamp.textContent = data.generated_at
      ? `UPDATED ${formatClock(data.generated_at)}`
      : "WAITING FOR TELEMETRY";
  }

  const flows = $("#live-flows");
  const anomalies = $("#live-anomalies");
  const rate = $("#live-rate");
  if (flows) flows.textContent = formatInt(data.total_flows);
  if (anomalies) anomalies.textContent = formatInt(data.anomalies);
  if (rate) rate.textContent = formatRate(data.anomalies, data.total_flows);

  renderTactics(data.tactics ?? {});
  renderChart(data.timeline ?? []);
  renderTable(data.recent ?? []);
}

async function tick() {
  try {
    const response = await fetch(`${SNAPSHOT}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    render(await response.json());
  } catch {
    // Keep the previous render if the snapshot is momentarily unavailable.
  }
}

tick();
window.setInterval(tick, 3000);
