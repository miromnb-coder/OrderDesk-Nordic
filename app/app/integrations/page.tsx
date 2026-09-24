"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

type Connection = {
  provider: string;
  display_name: string | null;
  status: string;
  default_warehouse: string | null;
  default_order_type: string | null;
  last_sync_at: string | null;
};

export default function IntegrationsPage() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [sampleState, setSampleState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [sampleMessage, setSampleMessage] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("erp_connections")
        .select("provider, display_name, status, default_warehouse, default_order_type, last_sync_at")
        .eq("provider", "visma_net")
        .maybeSingle();
      setConnection(data as Connection | null);
      setLoading(false);
    }
    load();
  }, []);

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
          <p>ERP connection status and the defaults OrderDesk will use when preparing sales orders.</p>
        </div>
      </header>

      <section className="od-integration-card">
        <div className="od-integration-top">
          <div className="od-integration-logo">V</div>
          <div><span>ERP CONNECTION</span><h2>Visma Net</h2><p>{connection?.display_name || "Not configured yet"}</p></div>
          <div className={connection?.status === "connected" ? "od-connected" : "od-file-chip"}>
            <span /> {loading ? "Checking…" : connection?.status || "Not connected"}
          </div>
        </div>

        <div className="od-integration-grid">
          <div><span>Mode</span><strong>Pilot · human reviewed</strong></div>
          <div><span>Last sync</span><strong>{connection?.last_sync_at ? new Date(connection.last_sync_at).toLocaleString() : "—"}</strong></div>
          <div><span>Default warehouse</span><strong>{connection?.default_warehouse || "—"}</strong></div>
          <div><span>Sales order type</span><strong>{connection?.default_order_type || "—"}</strong></div>
        </div>

        <div className="od-integration-foot">
          <p>The data model is ready for a Visma Net connection. Credentials are not stored in browser-accessible tables.</p>
          <button className="od-secondary-button" type="button" disabled>Connection setup next</button>
        </div>
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
