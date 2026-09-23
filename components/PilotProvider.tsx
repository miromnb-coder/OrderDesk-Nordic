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

const PilotContext = createContext<PilotContextValue | null>(null);

export function PilotProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const openPilot = useCallback(() => {
    setSubmitted(false);
    setOpen(true);
  }, []);

  const closePilot = useCallback(() => {
    setOpen(false);
    setSubmitted(false);
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    setSubmitted(true);
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

          {submitted ? (
            <div className="pilot-success" role="status">
              <span className="eyebrow">PILOT REQUEST</span>
              <h2 id="pilot-title">Ready for the next connection.</h2>
              <p>
                Pilot request form is ready for backend connection. No data was sent from this marketing site.
              </p>
              <button type="button" className="button button-dark" onClick={closePilot}>
                Close
              </button>
            </div>
          ) : (
            <form className="pilot-form" onSubmit={handleSubmit} noValidate={false}>
              <span className="eyebrow">START WITH A REAL ORDER</span>
              <h2 id="pilot-title">Request an OrderDesk pilot.</h2>
              <p className="dialog-intro">
                Tell us a little about your order flow. Submitting this form only expresses interest in a pilot.
              </p>

              <div className="field-grid">
                <label className="field field-wide">
                  <span>Work email</span>
                  <input ref={firstFieldRef} type="email" name="email" autoComplete="email" required />
                </label>
                <label className="field">
                  <span>Company</span>
                  <input type="text" name="company" autoComplete="organization" required />
                </label>
                <label className="field">
                  <span>Name <em>Optional</em></span>
                  <input type="text" name="name" autoComplete="name" />
                </label>
                <label className="field">
                  <span>ERP</span>
                  <input type="text" name="erp" placeholder="e.g. Visma Net" required />
                </label>
                <label className="field">
                  <span>Approximate orders per day</span>
                  <input type="number" name="ordersPerDay" inputMode="numeric" min="1" max="100000" required />
                </label>
              </div>

              <button type="submit" className="button button-dark dialog-submit">
                Request pilot
              </button>
              <p className="form-note">Frontend-only demo. No request is transmitted yet.</p>
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
