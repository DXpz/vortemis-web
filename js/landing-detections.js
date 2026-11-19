import {
  $,
  element,
  formatClock,
  formatInt,
  formatRate,
  probabilityClass,
  tacticName,
  toast,
} from "./ui.js";

const SNAPSHOT = "assets/detections.json";
const TACTIC_ORDER = ["TA0010", "TA0008", "TA0011", "TA0040", "TA0043"];
const SVG_NS = "http://www.w3.org/2000/svg";
const FAILED_STATES = ["S0", "REJ", "RSTO", "RSTR"];
const FEATURE_NAMES = [
  "Inter-Arrival Time (log)",
  "Bytes Sent (log)",
  "Bytes Received (log)",
  "Duration (log)",
  "Upload/Download Ratio (PCR)",
  "Failed Connection Flag",
];

let latestEngine = null;
let lastDetectionId = null;

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

function renderDestinations(items) {
  const host = $("#live-destinations");
  if (!host) return;
  host.replaceChildren();

  if (!items.length) {
    host.append(element("li", "empty", "No destinations yet."));
    return;
  }

  const max = Math.max(...items.map((item) => item.flows), 0);
  for (const item of items) {
    const row = element("li");
    if (item.flows === max) row.className = "is-hot";
    row.append(element("span", "name mono", item.dst_ip));
    row.append(element("span", "value", formatInt(item.flows)));
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
  line.setAttribute(
    "points",
    coords
      .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(" "),
  );
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

function featureVector(record) {
  const iat = record.iat_ms ?? 0;
  const orig = record.orig_bytes ?? 0;
  const resp = record.resp_bytes ?? 0;
  const duration = record.duration ?? 0;
  const pcr = (orig - resp) / (orig + resp + 1);
  const failed = FAILED_STATES.includes(record.conn_state) ? 1 : 0;
  return [
    Math.log1p(iat),
    Math.log1p(orig),
    Math.log1p(resp),
    Math.log1p(duration),
    pcr,
    failed,
  ];
}

function zStatus(z) {
  const magnitude = Math.abs(z);
  if (magnitude < 2) return "Normal";
  if (magnitude < 3) return "Elevated";
  return "Critical Deviation";
}

function renderDetail(record) {
  const host = $("#detection-detail");
  if (!host) return;
  host.replaceChildren();
  host.hidden = false;

  const head = element("div", "panel-head");
  head.append(element("h2", null, "Detection detail"));
  head.append(
    element(
      "span",
      "mono muted",
      `${record.src_ip} → ${record.dst_ip}:${record.dst_port} · ` +
        `${tacticName(record.mitre_tactic)}`,
    ),
  );
  host.append(head);

  const engine = latestEngine;
  const features = featureVector(record);

  const table = element("table", "data");
  const thead = element("thead");
  const headRow = element("tr");
  for (const label of ["Feature", "Value", "Z-Score", "Status"]) {
    headRow.append(element("th", null, label));
  }
  thead.append(headRow);
  table.append(thead);

  const body = element("tbody");
  features.forEach((value, index) => {
    const z =
      engine && engine.mean && engine.std
        ? (value - engine.mean[index]) / (engine.std[index] + 1e-8)
        : 0;
    const row = element("tr");
    row.append(element("td", null, FEATURE_NAMES[index]));
    row.append(element("td", "num", value.toFixed(3)));
    row.append(element("td", "num", z.toFixed(2)));
    row.append(element("td", null, zStatus(z)));
    body.append(row);
  });
  table.append(body);
  host.append(table);
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
    const row = element("tr", "is-clickable");
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
    row.addEventListener("click", () => renderDetail(record));
    body.append(row);
  }
}

function renderStream(records) {
  const body = $("#live-stream");
  if (!body) return;
  body.replaceChildren();

  if (!records.length) {
    const row = element("tr");
    const cell = element("td", "empty", "Waiting for flows…");
    cell.colSpan = 5;
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
    row.append(
      element(
        "td",
        `num probability ${probabilityClass(record.anomaly_probability)}`,
        record.anomaly_probability.toFixed(2),
      ),
    );
    row.append(
      element(
        "td",
        null,
        record.mitre_tactic ? tacticName(record.mitre_tactic) : "—",
      ),
    );
    body.append(row);
  }
}

function renderPipeline(engine, rate) {
  const host = $("#live-pipeline");
  if (!host) return;

  if (!engine) {
    host.textContent = "ENGINE UNAVAILABLE";
    return;
  }

  const tau = Number(engine.tau ?? 0).toFixed(4);
  const architecture = engine.architecture ?? "—";
  host.textContent =
    `MODEL ${architecture} · TAU ${tau} · ` +
    `${Number(rate ?? 0).toFixed(1)} FLOWS/S`;
}

function announce(records) {
  const newest = records[0];
  if (!newest || !newest.flow_id) return;
  if (lastDetectionId !== null && newest.flow_id !== lastDetectionId) {
    const label = tacticName(newest.mitre_tactic);
    toast(`New detection · ${label}`, "ok");
  }
  lastDetectionId = newest.flow_id;
}

function render(data) {
  latestEngine = data.engine ?? null;

  const stamp = $("#live-stamp");
  if (stamp) {
    stamp.textContent = data.generated_at
      ? `UPDATED ${formatClock(data.generated_at)}`
      : "WAITING FOR TELEMETRY";
  }

  const flows = $("#live-flows");
  const anomalies = $("#live-anomalies");
  const rate = $("#live-rate");
  const throughput = $("#live-throughput");
  if (flows) flows.textContent = formatInt(data.total_flows);
  if (anomalies) anomalies.textContent = formatInt(data.anomalies);
  if (rate) rate.textContent = formatRate(data.anomalies, data.total_flows);
  if (throughput) throughput.textContent = `${Number(data.rate ?? 0).toFixed(1)}`;

  renderPipeline(latestEngine, data.rate);
  renderTactics(data.tactics ?? {});
  renderChart(data.timeline ?? []);
  renderStream(data.stream ?? []);
  renderDestinations(data.destinations ?? []);
  renderTable(data.recent ?? []);
  announce(data.recent ?? []);
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
