import { api } from "../api.js";
import { $, toast } from "../ui.js";

export function mountAdmin() {
  $("#purge").addEventListener("click", async (event) => {
    const confirmed = window.confirm(
      "Purge all telemetry? This truncates flows, clears the ingestion checkpoint and rewrites the log. It cannot be undone.",
    );
    if (!confirmed) return;

    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Purging…";

    try {
      await api.purge();
      toast("Telemetry purged.", "ok");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "Purge telemetry";
    }
  });

  $("#rotate-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") || "");

    if (password.length < 12) {
      toast("Password must be at least 12 characters.", "error");
      return;
    }

    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = "Rotating…";

    try {
      const payload = { password };
      const role = data.get("role");
      if (role) payload.role = role;

      await api.rotatePassword(String(data.get("username") || ""), payload);
      toast("Password rotated.", "ok");
      form.reset();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "Rotate password";
    }
  });
}
