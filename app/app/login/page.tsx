"use client";

import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase-browser";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        if (!data.session) {
          setStatus("sent");
          setMessage("Check your email to confirm the account, then come back and sign in.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }

      window.location.href = "/app";
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  return (
    <div className="od-auth-card">
      <a className="od-auth-brand" href="/">OrderDesk</a>
      <span className="od-kicker">PRODUCT ACCESS</span>
      <h1>{mode === "signin" ? "Sign in." : "Create your workspace."}</h1>
      <p>
        {mode === "signin"
          ? "Open your order inbox and review incoming purchase orders."
          : "Create an OrderDesk account. Your workspace data stays isolated by organization."}
      </p>

      <form className="od-auth-form" onSubmit={submit}>
        <label>
          <span>Work email</span>
          <input type="email" name="email" autoComplete="email" required />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={8}
            required
          />
        </label>

        {message && (
          <p className={status === "error" ? "od-auth-error" : "od-auth-message"} role="status">
            {message}
          </p>
        )}

        <button className="od-primary-button od-auth-submit" type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        type="button"
        className="od-auth-switch"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setStatus("idle");
          setMessage("");
        }}
      >
        {mode === "signin" ? "New to OrderDesk? Create an account" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
