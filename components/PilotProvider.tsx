"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { CloseIcon } from "@/components/icons";

type PilotContextValue = {
  openPilot: () => void;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

const PilotContext = createContext<PilotContextValue | null>(null);

const SUPABASE_URL = "https://avwplztfgixsgfnymgoe.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_MkxwcMYqbrVtp8XhhTU1gw_CUG5sPE5";

export function PilotProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const openPilot = useCallback(() => {
    setSubmitState("idle");
    setOpen(true);
  }, []);

  const closePilot = useCallback(() => {
    setOpen(false);
    setSubmitState("idle");
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      window.setTimeout(() => firstFieldRef.current?.focus(), 0);
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const value = useMemo(() => ({ openPilot }), [openPilot]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = new FormData(form);
    const honeypot = String(data.get("website") ?? "").trim();

    // Silently accept bot submissions without storing them.
    if (honeypot) {
      setSubmitState("success");
      form.reset();
      return;
    }

    const payload = {
      work_email: String(data.get("email") ?? "").trim(),
      company: String(data.get("company") ?? "").trim(),
      name: String(data.get("name") ?? "").trim() || null,
      erp: String(data.get("erp") ?? "").trim(),
      orders_per_day: Number(data.get("ordersPerDay")),
    };

    setSubmitState("submitting");

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/pilot_leads`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Lead capture failed with status ${response.status}`);
      }

      form.reset();
      setSubmitState("success");
    } catch (error) {
      console.error("OrderDesk pilot request failed", error);
      setSubmitState("error");
    }
  }

  return (
    <PilotContext.Provider value={value}>
      {children}
      <dialog
        ref={dialogRef}
        className="pilot-dialog"
        aria-labelledby="pilot-title"
        onCancel={(event) => {
          event.preventDefault();
          closePilot();
        }}
        onClose={closePilot}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closePilot();
        }}
      >
        <div className="pilot-dialog-panel">
          <button
            type="button"
            className="icon-button dialog-close"
            onClick={closePilot}
            aria-label="Close pilot request"
          >
            <CloseIcon />
          </button>

          {submitState === "success" ? (
            <div className="pilot-success" role="status">
              <span className="eyebrow">PILOT REQUEST RECEIVED</span>
              <h2 id="pilot-title">Thanks — we’ll be in touch.</h2>
              <p>
                Your pilot request has been received. We’ll review your order flow and follow up about the next step.
              </p>
              <button type="button" className="button button-dark" onClick={closePilot}>
                Close
              </button>
            </div>
          ) : (
            <form className="pilot-form" onSubmit={handleSubmit}>
              <span className="eyebrow">START WITH A REAL ORDER</span>
              <h2 id="pilot-title">Request an OrderDesk pilot.</h2>
              <p className="dialog-intro">
                Tell us a little about your order flow. We’ll use these details only to evaluate and follow up on your pilot request.
              </p>

              <div className="field-grid">
                <label className="field field-wide">
                  <span>Work email</span>
                  <input ref={firstFieldRef} type="email" name="email" autoComplete="email" required maxLength={320} />
                </label>
                <label className="field">
                  <span>Company</span>
                  <input type="text" name="company" autoComplete="organization" required maxLength={200} />
                </label>
                <label className="field">
                  <span>Name <em>Optional</em></span>
                  <input type="text" name="name" autoComplete="name" maxLength={200} />
                </label>
                <label className="field">
                  <span>ERP</span>
                  <input type="text" name="erp" placeholder="e.g. Visma Net" required maxLength={120} />
                </label>
                <label className="field">
                  <span>Approximate orders per day</span>
                  <input type="number" name="ordersPerDay" inputMode="numeric" min="1" max="100000" required />
                </label>

                <label className="pilot-honeypot" aria-hidden="true">
                  <span>Website</span>
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>

              {submitState === "error" && (
                <p className="form-error" role="alert">
                  We couldn’t send your request. Please try again in a moment.
                </p>
              )}

              <button
                type="submit"
                className="button button-dark dialog-submit"
                disabled={submitState === "submitting"}
              >
                {submitState === "submitting" ? "Sending…" : "Request pilot"}
              </button>
              <p className="form-note">No credit card required.</p>
            </form>
          )}
        </div>
      </dialog>
    </PilotContext.Provider>
  );
}

export function usePilot() {
  const context = useContext(PilotContext);
  if (!context) throw new Error("usePilot must be used inside PilotProvider");
  return context;
}
