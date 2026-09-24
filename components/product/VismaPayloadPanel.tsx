"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

type Preview = {
  dry_run: boolean;
  method: string;
  endpoint: string;
  api_version: string;
  payload: Record<string, unknown>;
};

export function VismaPayloadPanel({
  orderId,
  approvedAt,
  orderStatus,
}: {
  orderId: string;
  approvedAt: string | null;
  orderStatus: string;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [writeEnabled, setWriteEnabled] = useState(false);

  useEffect(() => {
    async function loadConnection() {
      const { data } = await supabase
        .from("erp_connections")
        .select("write_enabled")
        .eq("provider", "visma_net")
        .maybeSingle();

      setWriteEnabled(Boolean(data?.write_enabled));
    }

    loadConnection();
  }, []);

  async function callVisma(dryRun: boolean) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const response = await fetch(
      "https://avwplztfgixsgfnymgoe.supabase.co/functions/v1/visma-erp",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: "create_sales_order",
          order_id: orderId,
          dry_run: dryRun,
        }),
      }
    );

    const body = await response.json();
    if (!response.ok) throw new Error(body?.error || "Visma operation failed.");
    return body;
  }

  async function preparePreview() {
    setLoading(true);
    setMessage("");

    try {
      const body = await callVisma(true);
      setPreview(body as Preview);
      setMessage("Sales Order v3 payload prepared in dry-run mode. Nothing was written to Visma Net.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not prepare payload.");
    } finally {
      setLoading(false);
    }
  }

  async function createLive() {
    setCreating(true);
    setMessage("");

    try {
      const body = await callVisma(false);
      setMessage(
        body?.order_number
          ? `Created in Visma Net as order ${body.order_number}.`
          : "Sales order created in Visma Net."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create the Visma order.");
    } finally {
      setCreating(false);
    }
  }

  if (!approvedAt && orderStatus !== "created") {
    return (
      <section className="od-visma-preview od-visma-preview-locked">
        <div>
          <span className="od-kicker">VISMA NET</span>
          <h2>Sales Order payload</h2>
          <p>Approve the reviewed order before preparing an ERP payload.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="od-visma-preview">
      <div className="od-visma-preview-head">
        <div>
          <span className="od-kicker">VISMA NET · SALES ORDER V3</span>
          <h2>ERP handoff</h2>
          <p>
            Build the exact request body from the approved OrderDesk order before enabling any live write.
          </p>
        </div>
        <div className="od-visma-preview-actions">
          <button className="od-secondary-button" type="button" onClick={preparePreview} disabled={loading}>
            {loading ? "Preparing…" : preview ? "Refresh payload" : "Prepare payload"}
          </button>
          {writeEnabled && orderStatus !== "created" && (
            <button className="od-primary-button" type="button" onClick={createLive} disabled={creating}>
              {creating ? "Creating…" : "Create in Visma Net"}
            </button>
          )}
        </div>
      </div>

      {message && <div className="od-process-result">{message}</div>}

      {preview && (
        <div className="od-visma-payload">
          <div className="od-visma-request-line">
            <span>{preview.method}</span>
            <code>{preview.endpoint}</code>
            <em>DRY RUN</em>
          </div>
          <pre>{JSON.stringify(preview.payload, null, 2)}</pre>
        </div>
      )}

      {!writeEnabled && (
        <div className="od-visma-safety">
          Live writes are server-disabled. A valid Visma connection can be tested independently without allowing sales-order creation.
        </div>
      )}
    </section>
  );
}
