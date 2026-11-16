import { api } from "../api.js";
import { mountTimeline } from "../chart.js";
import { $, clear, element, formatInt, formatRate, tacticName } from "../ui.js";

const THRESHOLD = 0.7;
const TACTIC_ORDER = ["TA0010", "TA0008", "TA0011", "TA0040", "TA0043"];

let chart = null;

async function ensureChart() {
  if (!chart) {
    chart = await mountTimeline($("#timeline-host"));
  }
  return chart;
}

export async function refreshOverview() {
  const [summary, sources, timeline, view] = await Promise.all([
    api.summary({ threshold: THRESHOLD }),
    api.sources({ threshold: THRESHOLD, limit: 8 }),
    api.timeline({ threshold: THRESHOLD, bucket_seconds: 300 }),
    ensureChart(),
  ]);

  $("#kpi-flows").textContent = formatInt(summary.total_flows);
  $("#kpi-anomalies").textContent = formatInt(summary.anomalies);
  $("#kpi-rate").textContent = formatRate(
    summary.anomalies,
    summary.total_flows,
  );

  renderTactics(summary.by_tactic ?? {});
  renderSources(sources);
  view.update(timeline);
  renderAxis(timeline);
}

function renderTactics(counts) {
  const host = $("#tactics");
  clear(host);

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

function renderSources(sources) {
  const body = $("#sources");
  clear(body);

  if (!sources.length) {
    const row = element("tr");
    const cell = element("td", "empty", "No sources in this window.");
    cell.colSpan = 3;
    row.append(cell);
    body.append(row);
    return;
  }

  for (const source of sources) {
    const row = element("tr");
    row.append(element("td", "address", source.src_ip));
    row.append(element("td", "num", formatInt(source.flows)));
    row.append(element("td", "num", formatInt(source.anomalies)));
    body.append(row);
  }
}

function renderAxis(points) {
  if (!points.length) {
    $("#axis-start").textContent = "";
    $("#axis-peak").textContent = "";
    $("#axis-end").textContent = "";
    return;
  }

  const clock = (iso) =>
    new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const peak = Math.max(...points.map((point) => point.flows));

  $("#axis-start").textContent = clock(points[0].bucket_start);
  $("#axis-peak").textContent = `peak ${formatInt(peak)}`;
  $("#axis-end").textContent = clock(
    points[points.length - 1].bucket_start,
  );
}
