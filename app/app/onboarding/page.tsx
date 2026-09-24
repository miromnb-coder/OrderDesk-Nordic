"use client";

import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase-browser";

export default function OnboardingPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const workspaceName = String(form.get("workspaceName") ?? "").trim();

    const { data, error } = await supabase.rpc("create_orderdesk_workspace", {
      workspace_name: workspaceName,
    });

    if (error || !data) {
      setStatus("error");
      setMessage(error?.message ?? "Could not create the workspace.");
      return;
    }

    window.location.href = "/app";
  }

  return (
    <div className="od-auth-card">
      <a className="od-auth-brand" href="/">OrderDesk</a>
      <span className="od-kicker">ONE LAST STEP</span>
      <h1>Create your workspace.</h1>
      <p>
        This becomes the data boundary for customers, products, orders and future ERP connections.
      </p>

      <form className="od-auth-form" onSubmit={submit}>
        <label>
          <span>Workspace name</span>
          <input
            type="text"
            name="workspaceName"
            placeholder="e.g. Nordic Wholesale Oy"
            minLength={2}
            maxLength={120}
            required
          />
        </label>

        {message && <p className="od-auth-error" role="alert">{message}</p>}

        <button className="od-primary-button od-auth-submit" type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Creating…" : "Create workspace"}
        </button>
      </form>
    </div>
  );
}
