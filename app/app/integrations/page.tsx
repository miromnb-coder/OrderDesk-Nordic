"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase-browser";

type Connection = {
  id: string;
  provider: string;
  display_name: string | null;
  status: string;
  default_warehouse: string | null;
  default_order_type: string | null;
  last_sync_at: string | null;
  client_id: string | null;
  tenant_id: string | null;
  external_company_id: string | null;
  secret_ref: string | null;
  sales_order_endpoint: string | null;
  write_enabled: boolean;
  last_connection_test_at: string | null;
  last_connection_error: string | null;
};

export default function IntegrationsPage() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [sampleState, setSampleState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [sampleMessage, setSampleMessage] = useState("");

  async function load() {
    const { data } = await supabase
      .from("erp_connections")
      .select("id, provider, display_name, status, default_warehouse, default_order_type, last_sync_at, client_id, tenant_id, external_company_id, secret_ref, sales_order_endpoint, write_enabled, last_connection_test_at, last_connection_error")
      .eq("provider", "visma_net")
      .maybeSingle();

    setConnection(data as Connection | null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

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
      `Connection settings saved. Store the Visma client secret in Supabase Vault as “${data?.secret_ref}”, then run Test connection.`
    );
    setSaving(false);
    await load();
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Connection test failed.");
    } finally {
      setTesting(false);
    }
  }

  async function loadSampleCatalogue() {
    setSampleState("loading");
    setSampleMessage("");

    const { data, error } = await supabase.rpc("seed_orderdesk_sample_catalog");

    if (error) {
      setSampleState("error");
      setSampleMessage(error.message);
      return;
    }

    setSampleState("done");
    setSampleMessage(
      `Sample catalogue ready: ${data?.products ?? 4} products and ${data?.known_mappings ?? 3} known customer mappings.`
    );
  }

  return (
    <div className="od-page">
      <header className="od-page-head">
        <div>
          <span className="od-kicker">INTEGRATIONS</span>
          <h1>Visma Net</h1>
          <p>
            Configure the service integration used for Sales Order v3 dry-runs and, later,
            explicitly enabled live order creation.
          </p>
        </div>
      </header>

      <section className="od-integration-card">
        <div className="od-integration-top">
          <div className="od-integration-logo">V</div>
          <div>
            <span>ERP CONNECTION</span>
            <h2>Visma Net</h2>
            <p>{connection?.display_name || "Not configured yet"}</p>
          </div>
          <div className={connection?.status === "connected" ? "od-connected" : "od-file-chip"}>
            <span /> {loading ? "Checking…" : connection?.status || "Not connected"}
          </div>
        </div>

        <div className="od-integration-grid">
          <div><span>Mode</span><strong>Service · human reviewed</strong></div>
          <div>
            <span>Last connection test</span>
            <strong>{connection?.last_connection_test_at ? new Date(connection.last_connection_test_at).toLocaleString() : "—"}</strong>
          </div>
          <div><span>Default warehouse</span><strong>{connection?.default_warehouse || "ERP default"}</strong></div>
          <div><span>Sales order type</span><strong>{connection?.default_order_type || "SO"}</strong></div>
        </div>

        <div className="od-integration-foot">
          <p>
            Endpoint: {connection?.sales_order_endpoint || "https://salesorder.visma.net/api/v3/SalesOrders"}.
            Live writes stay disabled until they are explicitly enabled server-side.
          </p>
          <button className="od-secondary-button" type="button" onClick={testConnection} disabled={testing || !connection}>
            {testing ? "Testing…" : "Test connection"}
          </button>
        </div>
      </section>

      <section className="od-connection-setup">
        <div className="od-panel-head">
          <div>
            <span className="od-kicker">CONNECTION SETUP</span>
            <h2>Visma Developer Portal credentials</h2>
          </div>
          <span className="od-live-chip">Client secret never stored in browser tables</span>
        </div>

        <form className="od-connection-form" onSubmit={saveConnection}>
          <label>
            <span>Client ID</span>
            <input name="clientId" defaultValue={connection?.client_id || ""} placeholder="Visma application client ID" required />
          </label>
          <label>
            <span>Tenant ID</span>
            <input name="tenantId" defaultValue={connection?.tenant_id || ""} placeholder="Optional expected tenant UUID" />
          </label>
          <label>
            <span>Company / tenant external ID</span>
            <input name="companyId" defaultValue={connection?.external_company_id || ""} placeholder="Optional" />
          </label>
          <label>
            <span>Company display name</span>
            <input name="displayName" defaultValue={connection?.display_name || ""} placeholder="e.g. Nordic Wholesale Oy" />
          </label>
          <label>
            <span>Default warehouse</span>
            <input name="warehouse" defaultValue={connection?.default_warehouse || ""} placeholder="Leave blank to use ERP default" />
          </label>
          <label>
            <span>Sales order type</span>
            <input name="orderType" defaultValue={connection?.default_order_type || "SO"} placeholder="SO" required />
          </label>

          <div className="od-connection-secret">
            <span>Vault secret name</span>
            <code>{connection?.secret_ref || "Generated after saving settings"}</code>
            <p>
              Put the Visma client secret in Supabase Vault under exactly this name.
              The secret itself is never returned to the browser.
            </p>
          </div>

          {connection?.last_connection_error && (
            <div className="od-auth-error">Last test: {connection.last_connection_error}</div>
          )}
          {message && <div className="od-auth-message">{message}</div>}

          <button className="od-primary-button" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Visma settings"}
          </button>
        </form>
      </section>

      <section className="od-sample-card">
        <div>
          <span className="od-kicker">PIPELINE TEST DATA</span>
          <h2>Load the sample catalogue</h2>
          <p>
            Adds one fictional customer, four catalogue products and three known customer SKU mappings
            to your current workspace. Use it with the OrderDesk test purchase order PDF.
          </p>
        </div>
        <button
          className="od-secondary-button"
          type="button"
          onClick={loadSampleCatalogue}
          disabled={sampleState === "loading"}
        >
          {sampleState === "loading" ? "Loading…" : sampleState === "done" ? "Sample data loaded" : "Load sample catalogue"}
        </button>
        {sampleMessage && (
          <p className={sampleState === "error" ? "od-auth-error" : "od-auth-message"} role="status">
            {sampleMessage}
          </p>
        )}
      </section>
    </div>
  );
}
