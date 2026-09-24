"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { UploadOrder } from "@/components/product/UploadOrder";
import { supabase } from "@/lib/supabase-browser";

type Order = {
  id: string;
  po_number: string | null;
  source_type: "pdf" | "excel" | "email" | "manual";
  source_file_name: string | null;
  raw_customer_name: string | null;
  status: "received" | "processing" | "needs_review" | "ready" | "creating" | "created" | "failed";
  overall_confidence: number | null;
  received_at: string;
};

function statusLabel(status: Order["status"]) {
  if (status === "needs_review") return "Needs review";
  if (status === "ready") return "Ready";
  if (status === "created") return "Completed";
  if (status === "processing") return "Processing";
  if (status === "failed") return "Failed";
  return "Received";
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [workspaceName, setWorkspaceName] = useState("Workspace");
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    setLoading(true);

    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .limit(1)
      .single();

    if (!membership) {
      setLoading(false);
      return;
    }

    const [{ data: organization }, { data: orderRows }] = await Promise.all([
      supabase.from("organizations").select("name").eq("id", membership.organization_id).single(),
      supabase
        .from("orders")
        .select("id, po_number, source_type, source_file_name, raw_customer_name, status, overall_confidence, received_at")
        .eq("organization_id", membership.organization_id)
        .order("received_at", { ascending: false })
        .limit(50),
    ]);

    if (organization?.name) setWorkspaceName(organization.name);
    setOrders((orderRows as Order[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const reviewCount = orders.filter((order) => order.status === "needs_review").length;
  const readyCount = orders.filter((order) => order.status === "ready").length;
  const completedCount = orders.filter((order) => order.status === "created").length;

  return (
    <div className="od-page">
      <header className="od-page-head">
        <div>
          <span className="od-kicker">ORDER INBOX · {workspaceName.toUpperCase()}</span>
          <h1>Orders</h1>
          <p>Upload real purchase-order PDFs, validate ingestion, and keep the review workflow in one place.</p>
        </div>
        <UploadOrder onUploaded={loadOrders} />
      </header>

      <section className="od-metrics" aria-label="Order counts">
        <article>
          <span>Needs review</span>
          <strong>{reviewCount}</strong>
          <em>Human check required</em>
        </article>
        <article>
          <span>Ready</span>
          <strong>{readyCount}</strong>
          <em>Ready for approval</em>
        </article>
        <article>
          <span>Completed</span>
          <strong>{completedCount}</strong>
          <em>Created in ERP</em>
        </article>
      </section>

      <section className="od-panel">
        <div className="od-panel-head">
          <div>
            <span className="od-kicker">LATEST</span>
            <h2>Incoming orders</h2>
          </div>
          <span className="od-live-chip">Supabase live data</span>
        </div>

        {loading ? (
          <div className="od-empty-state">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="od-empty-state">
            <strong>No orders yet.</strong>
            <span>Upload a PDF to create the first real order record and run document validation.</span>
          </div>
        ) : (
          <div className="od-order-list">
            {orders.map((order) => (
              <Link className="od-order-row" href={`/app/orders/${order.id}`} key={order.id}>
                <div className="od-order-main">
                  <span className={`od-status-dot od-status-${order.status}`} />
                  <div>
                    <strong>{order.po_number || order.source_file_name || "Incoming purchase order"}</strong>
                    <span>{order.raw_customer_name || order.source_file_name || "Customer not matched yet"}</span>
                  </div>
                </div>

                <div className="od-order-meta">
                  <span>{order.source_type.toUpperCase()}</span>
                  <span>{new Date(order.received_at).toLocaleString()}</span>
                </div>

                <div className="od-match-score">
                  <strong>{order.overall_confidence ? `${order.overall_confidence}%` : "—"}</strong>
                  <span>confidence</span>
                </div>

                <div className={`od-status-pill od-status-${order.status}`}>
                  {statusLabel(order.status)}
                </div>
                <span className="od-row-arrow">→</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
