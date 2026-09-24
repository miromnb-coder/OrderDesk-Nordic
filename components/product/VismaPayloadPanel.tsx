"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

type ValidationCheck = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
};

type ValidationResult = {
  valid: boolean;
  checks: ValidationCheck[];
  payload: Record<string, unknown>;
  diff: {
    customer?: { source?: string | null; vismaCustomerId?: string | null };
    poNumber?: { source?: string | null; vismaCustomerOrder?: string | null };
    orderDate?: { source?: string | null; vismaDate?: string | null };
    requestedDeliveryDate?: { source?: string | null; vismaRequestOn?: string | null };
    lines?: Array<{
      lineNumber?: number;
      sourceSku?: string | null;
      sourceDescription?: string | null;
      sourceQuantity?: number;
      sourceUnit?: string | null;
      inventoryId?: string | null;
      description?: string | null;
      quantity?: number;
      unitOfMeasure?: string | null;
      warehouseId?: string | null;
    }>;
  };
};

type ConnectionState = {
  status: string;
  write_enabled: boolean;
  customer_authorized: boolean;
  visma_ai_written_consent: boolean;
  human_review_required: boolean;
  end_user_terms_ready: boolean;
  no_ai_training_ack: boolean;
  data_minimization_ack: boolean;
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
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadConnection() {
      const { data } = await supabase
        .from("erp_connections")
        .select("status, write_enabled, customer_authorized, visma_ai_written_consent, human_review_required, end_user_terms_ready, no_ai_training_ack, data_minimization_ack")
        .eq("provider", "visma_net")
        .maybeSingle();

      setConnection(data as ConnectionState | null);
    }

    loadConnection();
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

  const liveReady =
    Boolean(connection?.write_enabled) &&
    connection?.status === "connected" &&
    complianceReady &&
    validation?.valid === true &&
    Boolean(approvedAt);

  async function validateDryRun() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.rpc("validate_visma_sales_order_dry_run", {
      target_order_id: orderId,
    });

    if (error || !data) {
      setMessage(error?.message || "Dry-run validation failed.");
      setLoading(false);
      return;
    }

    setValidation(data as ValidationResult);
    setMessage(
      data.valid
        ? "Dry-run validation passed. Review the field mapping and payload below."
        : "Dry-run found issues. Fix the failed checks before ERP handoff."
    );
    setLoading(false);
  }

  async function createLive() {
    setCreating(true);
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
          body: JSON.stringify({
            action: "create_sales_order",
            order_id: orderId,
            dry_run: false,
          }),
        }
      );

      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || "Visma operation failed.");

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
          <h2>Sales Order handoff</h2>
          <p>Human approval is required before an ERP payload can be prepared.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="od-visma-preview">
      <div className="od-visma-preview-head">
        <div>
          <span className="od-kicker">VISMA NET · DRY RUN</span>
          <h2>Validate ERP handoff</h2>
          <p>
            Compare the approved OrderDesk values with the generated Sales Order payload before any live write.
          </p>
        </div>
        <div className="od-visma-preview-actions">
          <button className="od-secondary-button" type="button" onClick={validateDryRun} disabled={loading}>
            {loading ? "Validating…" : validation ? "Revalidate" : "Validate dry run"}
          </button>
          <button className="od-primary-button" type="button" onClick={createLive} disabled={!liveReady || creating}>
            {creating ? "Creating…" : "Create in Visma Net"}
          </button>
        </div>
      </div>

      <div className="od-live-gate-strip">
        <div className={connection?.status === "connected" ? "is-ok" : ""}>
          <span>Connection</span>
          <strong>{connection?.status === "connected" ? "Verified" : "Blocked"}</strong>
        </div>
        <div className={complianceReady ? "is-ok" : ""}>
          <span>Compliance</span>
          <strong>{complianceReady ? "Complete" : "Blocked"}</strong>
        </div>
        <div className={validation?.valid ? "is-ok" : ""}>
          <span>Dry run</span>
          <strong>{validation ? (validation.valid ? "Passed" : "Failed") : "Not run"}</strong>
        </div>
        <div className={connection?.write_enabled ? "is-ok" : ""}>
          <span>Live write</span>
          <strong>{connection?.write_enabled ? "Enabled" : "Locked"}</strong>
        </div>
      </div>

      {message && <div className="od-process-result">{message}</div>}

      {validation && (
        <>
          <div className="od-dryrun-checks">
            {validation.checks.map((check) => (
              <div key={check.key} className={check.ok ? "is-ok" : "is-failed"}>
                <span>{check.ok ? "✓" : "!"}</span>
                <div>
                  <strong>{check.label}</strong>
                  <em>{check.detail}</em>
                </div>
              </div>
            ))}
          </div>

          <div className="od-payload-diff">
            <div className="od-payload-diff-head">
              <span>OrderDesk source</span>
              <span>Visma payload</span>
            </div>

            <div className="od-payload-diff-row">
              <div><small>Customer</small><strong>{validation.diff.customer?.source || "—"}</strong></div>
              <div><small>customer.id</small><strong>{validation.diff.customer?.vismaCustomerId || "—"}</strong></div>
            </div>
            <div className="od-payload-diff-row">
              <div><small>Customer PO</small><strong>{validation.diff.poNumber?.source || "—"}</strong></div>
              <div><small>customer.order</small><strong>{validation.diff.poNumber?.vismaCustomerOrder || "—"}</strong></div>
            </div>
            <div className="od-payload-diff-row">
              <div><small>Order date</small><strong>{validation.diff.orderDate?.source || "—"}</strong></div>
              <div><small>date</small><strong>{validation.diff.orderDate?.vismaDate || "—"}</strong></div>
            </div>
            <div className="od-payload-diff-row">
              <div><small>Requested delivery</small><strong>{validation.diff.requestedDeliveryDate?.source || "—"}</strong></div>
              <div><small>requestOn</small><strong>{validation.diff.requestedDeliveryDate?.vismaRequestOn || "—"}</strong></div>
            </div>

            {(validation.diff.lines || []).map((line) => (
              <div className="od-payload-diff-row od-payload-line-diff" key={line.lineNumber}>
                <div>
                  <small>Line {line.lineNumber} · {line.sourceSku || "no SKU"}</small>
                  <strong>{line.sourceDescription || "—"}</strong>
                  <em>{line.sourceQuantity} {line.sourceUnit || ""}</em>
                </div>
                <div>
                  <small>inventoryId: {line.inventoryId || "—"}</small>
                  <strong>{line.description || "—"}</strong>
                  <em>{line.quantity} {line.unitOfMeasure || ""}{line.warehouseId ? ` · warehouse ${line.warehouseId}` : ""}</em>
                </div>
              </div>
            ))}
          </div>

          <details className="od-visma-json">
            <summary>View generated JSON payload</summary>
            <pre>{JSON.stringify(validation.payload, null, 2)}</pre>
          </details>
        </>
      )}

      {!liveReady && (
        <div className="od-visma-safety">
          Live creation remains blocked until the connection is verified, the compliance gate is complete,
          the dry-run passes, the order has human approval, and live writes are explicitly enabled.
        </div>
      )}
    </section>
  );
}
