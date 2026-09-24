"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase-browser";

type Connection = {
  id: string;
  provider: string;
  display_name: string | null;
  status: string;
  default_warehouse: string | null;
  default_order_type: string | null;
  client_id: string | null;
  tenant_id: string | null;
  external_company_id: string | null;
  secret_ref: string | null;
  sales_order_endpoint: string | null;
  write_enabled: boolean;
  last_connection_test_at: string | null;
  last_connection_error: string | null;
  customer_authorized: boolean;
  visma_ai_written_consent: boolean;
  human_review_required: boolean;
  end_user_terms_ready: boolean;
  no_ai_training_ack: boolean;
  data_minimization_ack: boolean;
};

type Step = 1 | 2 | 3 | 4;

export default function IntegrationsPage() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const { data } = await supabase
      .from("erp_connections")
      .select("id, provider, display_name, status, default_warehouse, default_order_type, client_id, tenant_id, external_company_id, secret_ref, sales_order_endpoint, write_enabled, last_connection_test_at, last_connection_error, customer_authorized, visma_ai_written_consent, human_review_required, end_user_terms_ready, no_ai_training_ack, data_minimization_ack")
      .eq("provider", "visma_net")
      .maybeSingle();

    const row = data as Connection | null;
    setConnection(row);

    if (!row?.client_id) setStep(1);
    else if (row.status !== "connected") setStep(2);
    else if (![
      row.customer_authorized,
      row.visma_ai_written_consent,
      row.human_review_required,
      row.end_user_terms_ready,
      row.no_ai_training_ack,
      row.data_minimization_ack,
    ].every(Boolean)) setStep(3);
    else setStep(4);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const complianceReady = useMemo(() => {
    if (!connection) return false;
    return [
      connection.customer_authorized,
      connection.visma_ai_written_consent,
      connection.human_review_required,
      connection.end_user_terms_ready,
      connection.no_ai_training_ack,
      connection.data_minimization_ack,
    ].every(Boolean);
  }, [connection]);

  async function saveConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const { data, error } = await supabase.rpc("configure_visma_connection", {
      input_client_id: String(form.get("clientId") ?? "").trim(),
      input_tenant_id: String(form.get("tenantId") ?? "").trim() || null,
      input_external_company_id: String(form.get("companyId") ?? "").trim() || null,
      input_display_name: String(form.get("displayName") ?? "").trim() || null,
      input_default_warehouse: String(form.get("warehouse") ?? "").trim() || null,
      input_default_order_type: String(form.get("orderType") ?? "SO").trim() || "SO",
    });

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setMessage(
      `Settings saved. Add the Visma client secret to Supabase Vault as “${data?.secret_ref}”.`
    );
    setSaving(false);
    await load();
    setStep(2);
  }

  async function testConnection() {
    setTesting(true);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    try {
      const response = await fetch(
        "https://avwplztfgixsgfnymgoe.supabase.co/functions/v1/visma-erp",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ action: "test_connection" }),
        }
      );

      const body = await response.json();
      if (!response.ok) {
        throw new Error(
          body?.secret_ref
            ? `${body.error}. Vault secret name: ${body.secret_ref}`
            : body?.error || "Connection test failed."
        );
      }

      setMessage(body.message || "Visma Net connection verified.");
      await load();
      setStep(3);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Connection test failed.");
    } finally {
      setTesting(false);
    }
  }

  async function saveCompliance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const params = {
      input_customer_authorized: form.get("customerAuthorized") === "on",
      input_visma_ai_written_consent: form.get("vismaAiConsent") === "on",
      input_human_review_required: form.get("humanReview") === "on",
      input_end_user_terms_ready: form.get("endUserTerms") === "on",
      input_no_ai_training_ack: form.get("noAiTraining") === "on",
      input_data_minimization_ack: form.get("dataMinimization") === "on",
    };

    const { data, error } = await supabase.rpc("set_visma_compliance_gate", params);

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setMessage(
      data?.compliance_ready
        ? "Compliance gate complete. Dry-run remains available; live writes are still locked until explicitly enabled."
        : "Compliance status saved. Live writes remain locked."
    );

    setSaving(false);
    await load();
    if (data?.compliance_ready) setStep(4);
  }

  async function setLiveWrite(enabled: boolean) {
    setEnabling(true);
    setMessage("");

    const { data, error } = await supabase.rpc("set_visma_live_write", {
      input_enabled: enabled,
    });

    if (error) {
      setMessage(error.message);
      setEnabling(false);
      return;
    }

    setMessage(
      data?.write_enabled
        ? "Live writes enabled. Human approval is still required per order before ERP creation."
        : "Live writes locked."
    );
    setEnabling(false);
    await load();
  }

  const steps = [
    { number: 1, title: "Credentials", done: Boolean(connection?.client_id) },
    { number: 2, title: "Connection test", done: connection?.status === "connected" },
    { number: 3, title: "Compliance gate", done: complianceReady },
    { number: 4, title: "Write lock", done: Boolean(connection?.write_enabled) },
  ];

  return (
    <div className="od-page">
      <header className="od-page-head">
        <div>
          <span className="od-kicker">INTEGRATIONS</span>
          <h1>Visma Net connection</h1>
          <p>
            A guarded setup flow for credentials, connection verification, compliance status and live-write control.
          </p>
        </div>
      </header>

      <section className="od-wizard">
        <div className="od-wizard-steps">
          {steps.map((item) => (
            <button
              key={item.number}
              type="button"
              className={`od-wizard-step ${step === item.number ? "is-active" : ""} ${item.done ? "is-done" : ""}`}
              onClick={() => setStep(item.number as Step)}
            >
              <span>{String(item.number).padStart(2, "0")}</span>
              <strong>{item.title}</strong>
              <em>{item.done ? "Complete" : "Pending"}</em>
            </button>
          ))}
        </div>

        <div className="od-wizard-body">
          {loading ? (
            <div className="od-empty-state">Loading connection…</div>
          ) : step === 1 ? (
            <form className="od-connection-form" onSubmit={saveConnection}>
              <div className="od-wizard-copy">
                <span className="od-kicker">STEP 01</span>
                <h2>Developer credentials</h2>
                <p>Save the non-secret connection identifiers. The client secret stays in Supabase Vault.</p>
              </div>

              <label>
                <span>Client ID</span>
                <input name="clientId" defaultValue={connection?.client_id || ""} required />
              </label>
              <label>
                <span>Tenant ID</span>
                <input name="tenantId" defaultValue={connection?.tenant_id || ""} />
              </label>
              <label>
                <span>Company / tenant external ID</span>
                <input name="companyId" defaultValue={connection?.external_company_id || ""} />
              </label>
              <label>
                <span>Company display name</span>
                <input name="displayName" defaultValue={connection?.display_name || ""} />
              </label>
              <label>
                <span>Default warehouse</span>
                <input name="warehouse" defaultValue={connection?.default_warehouse || ""} />
              </label>
              <label>
                <span>Sales order type</span>
                <input name="orderType" defaultValue={connection?.default_order_type || "SO"} required />
              </label>

              <div className="od-connection-secret">
                <span>Vault secret name</span>
                <code>{connection?.secret_ref || "Generated after saving settings"}</code>
                <p>Store the Visma client secret under exactly this name in Supabase Vault.</p>
              </div>

              <button className="od-primary-button" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save and continue"}
              </button>
            </form>
          ) : step === 2 ? (
            <div className="od-wizard-stage">
              <span className="od-kicker">STEP 02</span>
              <h2>Verify the connection</h2>
              <p>
                OrderDesk requests a service token and checks Sales Order API access. This does not create or modify any ERP data.
              </p>

              <div className="od-connection-check">
                <div>
                  <span>Connection status</span>
                  <strong>{connection?.status || "disconnected"}</strong>
                </div>
                <div>
                  <span>Last test</span>
                  <strong>{connection?.last_connection_test_at ? new Date(connection.last_connection_test_at).toLocaleString() : "Not tested"}</strong>
                </div>
              </div>

              {connection?.last_connection_error && (
                <div className="od-auth-error">{connection.last_connection_error}</div>
              )}

              <button className="od-primary-button" type="button" onClick={testConnection} disabled={testing || !connection?.client_id}>
                {testing ? "Testing…" : "Test connection"}
              </button>
            </div>
          ) : step === 3 ? (
            <form className="od-compliance-gate" onSubmit={saveCompliance}>
              <div className="od-wizard-copy">
                <span className="od-kicker">STEP 03 · COMPLIANCE GATE</span>
                <h2>Production prerequisites</h2>
                <p>
                  Record only conditions that are actually satisfied. Unchecked items keep live Visma writes disabled.
                </p>
              </div>

              <label>
                <input type="checkbox" name="customerAuthorized" defaultChecked={connection?.customer_authorized} />
                <span>
                  <strong>End User Customer has authorised the integration</strong>
                  <em>The customer has clearly authorised OrderDesk to access and process its Visma data.</em>
                </span>
              </label>

              <label>
                <input type="checkbox" name="vismaAiConsent" defaultChecked={connection?.visma_ai_written_consent} />
                <span>
                  <strong>Visma written consent for the AI Integration has been obtained</strong>
                  <em>Required before using an AI Integration in the production environment.</em>
                </span>
              </label>

              <label>
                <input type="checkbox" name="humanReview" defaultChecked={connection?.human_review_required ?? true} />
                <span>
                  <strong>Human approval remains mandatory before Visma write operations</strong>
                  <em>OrderDesk will not create a Sales Order from AI output without an explicit human approval.</em>
                </span>
              </label>

              <label>
                <input type="checkbox" name="endUserTerms" defaultChecked={connection?.end_user_terms_ready} />
                <span>
                  <strong>End User Terms and privacy information are ready</strong>
                  <em>They transparently describe the Visma integration and processing of customer data.</em>
                </span>
              </label>

              <label>
                <input type="checkbox" name="noAiTraining" defaultChecked={connection?.no_ai_training_ack} />
                <span>
                  <strong>Visma data is not used for AI training without the required written permissions</strong>
                  <em>Operational matching data is kept separate from model training.</em>
                </span>
              </label>

              <label>
                <input type="checkbox" name="dataMinimization" defaultChecked={connection?.data_minimization_ack} />
                <span>
                  <strong>Visma data retention is limited to authorised functionality</strong>
                  <em>No persistent accumulation of API data beyond the authorised product need.</em>
                </span>
              </label>

              <div className="od-compliance-source">
                Based on the uploaded Visma Developer Terms, version 25.06.2026.
              </div>

              <button className="od-primary-button" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save compliance status"}
              </button>
            </form>
          ) : (
            <div className="od-wizard-stage">
              <span className="od-kicker">STEP 04 · LIVE-WRITE LOCK</span>
              <h2>{connection?.write_enabled ? "Live writes enabled" : "Live writes locked"}</h2>
              <p>
                Dry-run payload generation remains available independently. Enabling writes requires both a verified connection and a complete compliance gate.
              </p>

              <div className="od-write-lock">
                <div>
                  <span>Connection</span>
                  <strong>{connection?.status === "connected" ? "Verified" : "Not verified"}</strong>
                </div>
                <div>
                  <span>Compliance</span>
                  <strong>{complianceReady ? "Complete" : "Incomplete"}</strong>
                </div>
                <div>
                  <span>Live writes</span>
                  <strong>{connection?.write_enabled ? "Enabled" : "Locked"}</strong>
                </div>
              </div>

              <button
                className={connection?.write_enabled ? "od-danger-button" : "od-primary-button"}
                type="button"
                disabled={enabling || (!connection?.write_enabled && (!complianceReady || connection?.status !== "connected"))}
                onClick={() => setLiveWrite(!connection?.write_enabled)}
              >
                {enabling
                  ? "Updating…"
                  : connection?.write_enabled
                    ? "Lock live writes"
                    : "Enable live writes"}
              </button>
            </div>
          )}

          {message && <div className="od-process-result">{message}</div>}
        </div>
      </section>
    </div>
  );
}
