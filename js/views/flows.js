import { api } from "../api.js";
import {
  $,
  element,
  formatClock,
  probabilityClass,
  tacticName,
  toast,
} from "../ui.js";
const state = {
  cursor: null,
  stack: [],
  next: null,
  loading: false,
};

export function mountFlows() {
  $("#flow-filters").addEventListener("submit", (event) => {
    event.preventDefault();
    state.stack = [];
    state.cursor = null;
    refreshFlows();
  });

  const range = $('input[name="min_probability"]');
  const output = $("#probability-output");
  range.addEventListener("input", () => {
    output.value = Number(range.value).toFixed(2);
  });
  output.value = Number(range.value).toFixed(2);

  $("#prev-page").addEventListener("click", () => {
    state.cursor = state.stack.pop() ?? null;
    refreshFlows();
  });

  $("#next-page").addEventListener("click", () => {
    if (!state.next) return;
    state.stack.push(state.cursor);
    state.cursor = state.next;
    refreshFlows();
  });
}

function readFilters() {
  const form = $("#flow-filters");
  const data = new FormData(form);

  return {
    tactic: data.get("tactic"),
    protocol: data.get("protocol"),
    src_ip: (data.get("src_ip") || "").trim(),
    min_probability: data.get("min_probability"),
    limit: data.get("limit"),
  };
}

export async function refreshFlows() {
  if (state.loading) return;
  state.loading = true;

  const body = $("#flows-body");
  const loadingRow = element("tr");
  const loadingCell = element("td", "empty", "Loading flows…");
  loadingCell.colSpan = 6;
  loadingRow.append(loadingCell);
  body.replaceChildren(loadingRow);

  try {
    const page = await api.flows({
      ...readFilters(),
      cursor: state.cursor ?? undefined,
    });

    renderRows(page.records);
    state.next = page.next_cursor;

    $("#next-page").disabled = !page.next_cursor;
    $("#prev-page").disabled = state.stack.length === 0;
    $("#page-label").textContent = `${page.records.length} flows loaded`;
  } catch (error) {
    body.replaceChildren();
    const row = element("tr");
    const cell = element("td", "empty", error.message);
    cell.colSpan = 6;
    row.append(cell);
    body.append(row);
    toast(error.message, "error");
  } finally {
    state.loading = false;
  }
}

function renderRows(records) {
  const body = $("#flows-body");
  body.replaceChildren();

  if (!records.length) {
    const row = element("tr");
    const cell = element("td", "empty", "No flows match these filters.");
    cell.colSpan = 6;
    row.append(cell);
    body.append(row);
    return;
  }

  for (const record of records) {
    const row = element("tr");

    row.append(element("td", "mono", formatClock(record.ts)));

    const source = element(
      "td",
      "mono",
      `${record.src_ip}:${record.src_port}`,
    );
    row.append(source);

    const target = element(
      "td",
      "mono",
      `${record.dst_ip}:${record.dst_port}`,
    );
    row.append(target);

    row.append(element("td", null, record.protocol.toUpperCase()));

    const probability = element(
      "td",
      `probability ${probabilityClass(record.anomaly_probability)}`,
      record.anomaly_probability.toFixed(3),
    );
    row.append(probability);

    row.append(
      element(
        "td",
        null,
        record.mitre_tactic ? tacticName(record.mitre_tactic) : "None",
      ),
    );

    body.append(row);
  }
}
