"use client";

import { useMemo, useState } from "react";
import { ChartIcon, ClockIcon } from "@/components/icons";

type Values = {
  orders: number;
  minutes: number;
  days: number;
};

function sanitize(value: string, fallback: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(Math.max(numeric, 0), max);
}

export function RoiCalculator() {
  const [values, setValues] = useState<Values>({ orders: 60, minutes: 5, days: 21 });

  const totals = useMemo(() => {
    const manualMinutes = values.orders * values.minutes * values.days;
    const manualHours = manualMinutes / 60;
    return {
      manualHours: Math.round(manualHours),
      savedHours: Math.round(manualHours * 0.8),
    };
  }, [values]);

  const update = (key: keyof Values, raw: string, fallback: number, max: number) => {
    setValues((current) => ({ ...current, [key]: sanitize(raw, fallback, max) }));
  };

  return (
    <section className="roi-block" aria-labelledby="roi-title">
      <h2 id="roi-title">How much time does manual order entry cost you?</h2>
      <div className="calculator-shell">
        <div className="calculator-inputs">
          <label className="calc-field">
            <span>Orders per day</span>
            <input type="number" min="0" max="100000" step="1" value={values.orders} onChange={(e) => update("orders", e.target.value, 0, 100000)} />
          </label>
          <label className="calc-field">
            <span>Average entry time</span>
            <div className="input-with-suffix"><input type="number" min="0" max="1440" step="0.5" value={values.minutes} onChange={(e) => update("minutes", e.target.value, 0, 1440)} /><span>min</span></div>
          </label>
          <label className="calc-field">
            <span>Working days / month</span>
            <input type="number" min="0" max="31" step="1" value={values.days} onChange={(e) => update("days", e.target.value, 0, 31)} />
          </label>
        </div>

        <div className="calculator-results" aria-live="polite">
          <article className="result-card result-manual">
            <span className="result-icon"><ClockIcon /></span>
            <strong>{totals.manualHours} hours / month</strong>
            <p>spent entering orders manually.</p>
          </article>
          <article className="result-card result-saved">
            <span className="result-icon"><ChartIcon /></span>
            <span className="potentially">Potentially</span>
            <strong>{totals.savedHours} hours saved / month</strong>
          </article>
        </div>
      </div>
    </section>
  );
}
