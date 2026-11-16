const params = new URLSearchParams(window.location.search);

const stored = localStorage.getItem("vortemis.api");

export const API_BASE = (
  params.get("api") ||
  stored ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export const PAGE_SIZE_DEFAULT = 50;
