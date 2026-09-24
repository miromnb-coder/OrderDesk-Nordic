"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import { VismaPayloadPanel } from "@/components/product/VismaPayloadPanel";

type Order = {
  id: string;
  organization_id: string;
  customer_id: string | null;
  raw_customer_name: string | null;
  po_number: string | null;
  source_file_name: string | null;
  source_storage_path: string | null;
  status: string;
  overall_confidence: number | null;
  received_at: string;
  processed_at: string | null;
  approved_at: string | null;
  error_message: string | null;
  extraction_version: string | null;
};

type OrderLine = {
  id: string;
  line_number: number;
  raw_sku: string | null;
  raw_description: string | null;
  raw_quantity: number;
  raw_unit: string | null;
  match_confidence: number | null;
  review_status: string;
  matched_product_id: string | null;
  matched_product: { sku: string; name: string } | null;
};

type EventRow = {
  id: number;
  event_type: string;
  message: string;
  created_at: string;
};

type Product = {
  id: string;
  sku: string;
  name: string;
  manufacturer: string | null;
  unit: string | null;
};

export default function OrderReviewPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processMessage, setProcessMessage] = useState("");
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [catalogue, setCatalogue] = useState<Product[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [catalogueQuery, setCatalogueQuery] = useState("");
  const [rememberMatch, setRememberMatch] = useState(true);
  const [savingMatch, setSavingMatch] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  const load = useCallback(async () => {
    if (!params.id) return;
    setLoading(true);

    const { data: orderRow } = await supabase
      .from("orders")
      .select("id, organization_id, customer_id, raw_customer_name, po_number, source_file_name, source_storage_path, status, overall_confidence, received_at, processed_at, approved_at, error_message, extraction_version")
      .eq("id", params.id)
      .maybeSingle();

    if (!orderRow) {
      setOrder(null);
      setLoading(false);
      return;
    }

    setOrder(orderRow as Order);

    const [{ data: lineRows }, { data: eventRows }] = await Promise.all([
      supabase
        .from("order_lines")
        .select("id, line_number, raw_sku, raw_description, raw_quantity, raw_unit, match_confidence, review_status, matched_product_id, matched_product:products!order_lines_matched_product_id_fkey(sku,name)")
        .eq("order_id", params.id)
        .order("line_number", { ascending: true }),
      supabase
        .from("order_events")
        .select("id, event_type, message, created_at")
        .eq("order_id", params.id)
        .order("created_at", { ascending: true }),
    ]);

    setLines((lineRows as unknown as OrderLine[] | null) ?? []);
    setEvents((eventRows as EventRow[] | null) ?? []);

    if (orderRow.source_storage_path) {
      const { data: signed } = await supabase.storage
        .from("order-files")
        .createSignedUrl(orderRow.source_storage_path, 60 * 20);

      if (signed?.signedUrl) setSourceUrl(signed.signedUrl);
    }

    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredCatalogue = useMemo(() => {
    const query = catalogueQuery.trim().toLowerCase();
    if (!query) return catalogue.slice(0, 12);

    return catalogue
      .filter((product) =>
        [product.sku, product.name, product.manufacturer]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 12);
  }, [catalogue, catalogueQuery]);

  async function reprocess() {
    if (!order) return;
    setProcessing(true);
    setProcessMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    try {
      const result = await fetch(
        "https://avwplztfgixsgfnymgoe.supabase.co/functions/v1/process-order",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ order_id: order.id }),
        }
      );

      const body = await result.json();
      if (!result.ok) throw new Error(body?.error || "Processing failed.");

      setProcessMessage(
        `Extracted ${body.lines ?? 0} lines · ${body.product_matches ?? 0} product matches · ${body.overall_confidence ?? 0}% confidence`
      );
      await load();
    } catch (error) {
      setProcessMessage(error instanceof Error ? error.message : "Processing failed.");
    } finally {
      setProcessing(false);
    }
  }

  async function openCatalogue(lineId: string) {
    setEditingLineId(lineId);
    setCatalogueQuery("");
    setRememberMatch(true);

    if (catalogue.length) return;

    setCatalogueLoading(true);
    const { data } = await supabase
      .from("products")
      .select("id, sku, name, manufacturer, unit")
      .eq("active", true)
      .order("name", { ascending: true })
      .limit(500);

    setCatalogue((data as Product[] | null) ?? []);
    setCatalogueLoading(false);
  }

  async function confirmProduct(lineId: string, productId: string) {
    setSavingMatch(productId);
    setProcessMessage("");

    const { data, error } = await supabase.rpc("confirm_orderdesk_line_match", {
      target_order_line_id: lineId,
      target_product_id: productId,
      remember_for_customer: rememberMatch,
    });

    if (error) {
      setProcessMessage(error.message);
      setSavingMatch(null);
      return;
    }

    const remembered = Boolean(data?.remembered);
    setProcessMessage(
      remembered
        ? "Match confirmed and saved to Customer Memory."
        : "Match confirmed for this order."
    );
    setEditingLineId(null);
    setSavingMatch(null);
    await load();
  }

  async function approveOrder() {
    if (!order) return;
    setApproving(true);
    setProcessMessage("");

    const { error } = await supabase.rpc("approve_orderdesk_order", {
      target_order_id: order.id,
    });

    if (error) {
      setProcessMessage(error.message);
      setApproving(false);
      return;
    }

    setProcessMessage("Order approved. It is ready for the future Visma Net creation step.");
    setApproving(false);
    await load();
  }

  if (loading) {
    return <div className="od-page"><div className="od-empty-state">Loading order…</div></div>;
  }

  if (!order) {
    return (
      <div className="od-page">
        <Link href="/app" className="od-back-link">← Orders</Link>
        <div className="od-empty-state">
          <strong>Order not found.</strong>
          <span>This order is not available in your workspace.</span>
        </div>
      </div>
    );
  }

  const title = order.po_number ? `PO #${order.po_number}` : order.source_file_name || "Incoming purchase order";
  const extractionPending = lines.length === 0;
  const unresolvedLines = lines.filter((line) => !["matched", "confirmed"].includes(line.review_status)).length;
  const canApprove = order.status === "ready" && unresolvedLines === 0 && !order.approved_at;

  return (
    <div className="od-page od-review-page">
      <header className="od-review-head">
        <div>
          <Link href="/app" className="od-back-link">← Orders</Link>
          <span className="od-kicker">PURCHASE ORDER</span>
          <h1>{title}</h1>
          <p>
            {order.raw_customer_name || "Customer not identified"} · received {new Date(order.received_at).toLocaleString()}
          </p>
        </div>
        <div className="od-review-actions">
          <span className={`od-status-pill od-status-${order.status}`}>
            {order.approved_at ? "approved" : order.status.replaceAll("_", " ")}
          </span>
          <button className="od-secondary-button" type="button" onClick={reprocess} disabled={processing}>
            {processing ? "Processing…" : "Reprocess"}
          </button>
          <button
            className="od-primary-button"
            type="button"
            onClick={approveOrder}
            disabled={!canApprove || approving}
          >
            {order.approved_at ? "Approved" : approving ? "Approving…" : "Approve order"}
          </button>
        </div>
      </header>

      {processMessage && <div className="od-process-result">{processMessage}</div>}

      <VismaPayloadPanel orderId={order.id} approvedAt={order.approved_at} orderStatus={order.status} />

      <div className="od-review-grid">
        <section className="od-source-panel">
          <div className="od-panel-head compact">
            <div>
              <span className="od-kicker">SOURCE</span>
              <h2>Original PDF</h2>
            </div>
            <span className="od-file-chip">{order.source_file_name || "order.pdf"}</span>
          </div>

          {sourceUrl ? (
            <iframe className="od-pdf-frame" src={sourceUrl} title="Uploaded purchase order PDF" />
          ) : (
            <div className="od-empty-state">
              <strong>PDF unavailable.</strong>
              <span>The source file could not be opened.</span>
            </div>
          )}
        </section>

        <section className="od-extracted-panel">
          <div className="od-panel-head compact">
            <div>
              <span className="od-kicker">ORDERDESK</span>
              <h2>Interpreted order</h2>
            </div>
            {order.overall_confidence !== null && (
              <span className="od-confidence-chip">{order.overall_confidence}% overall</span>
            )}
          </div>

          {order.error_message && (
            <div className="od-pipeline-error">{order.error_message}</div>
          )}

          {extractionPending ? (
            <div className="od-pipeline-state">
              <span className="od-kicker">PIPELINE STATUS</span>
              <h3>Waiting for structured lines.</h3>
              <p>
                The source PDF is stored privately. Run processing to extract the PO number,
                customer and line items, then match them against customer memory and the catalogue.
              </p>
              <div className="od-pipeline-steps">
                <div className="is-done"><span>01</span><strong>Upload</strong><em>Complete</em></div>
                <div className="is-done"><span>02</span><strong>PDF validation</strong><em>Complete</em></div>
                <div><span>03</span><strong>Structured extraction</strong><em>Run</em></div>
                <div><span>04</span><strong>Product matching</strong><em>Waiting</em></div>
              </div>
            </div>
          ) : (
            <>
              <div className="od-customer-match">
                <div>
                  <span>Extracted customer</span>
                  <strong>{order.raw_customer_name || "Unknown customer"}</strong>
                  <em>{order.customer_id ? "Matched to workspace customer" : "Needs customer review"}</em>
                </div>
                <span className={order.customer_id ? "od-confidence-success" : "od-confidence-warning"}>
                  {order.customer_id ? "Matched" : "Review"}
                </span>
              </div>

              <div className="od-line-table">
                <div className="od-line-header">
                  <span>Customer line</span>
                  <span>Matched catalogue item</span>
                  <span>Qty</span>
                  <span>Confidence</span>
                </div>

                {lines.map((line) => {
                  const needsReview = line.review_status === "needs_review";
                  const editorOpen = editingLineId === line.id;

                  return (
                    <div className={`od-line-row ${needsReview ? "needs-review" : ""} ${editorOpen ? "has-editor" : ""}`} key={line.id}>
                      <div>
                        <strong>{line.raw_sku || `Line ${line.line_number}`}</strong>
                        <span>{line.raw_description || "No description"}</span>
                      </div>
                      <div>
                        <strong>{line.matched_product?.sku || "No catalogue match"}</strong>
                        <span>{line.matched_product?.name || "Manual product selection required"}</span>
                      </div>
                      <div className="od-qty">{line.raw_quantity} {line.raw_unit || ""}</div>
                      <div>
                        {line.match_confidence !== null
                          ? <span className={line.match_confidence >= 98 ? "od-confidence-success" : "od-confidence-warning"}>{line.match_confidence}%</span>
                          : <span>—</span>}
                      </div>

                      {needsReview && !editorOpen && (
                        <div className="od-line-review-action">
                          <div>
                            <span>Needs review</span>
                            <strong>{line.matched_product ? "Check the suggested match" : "Choose a catalogue product"}</strong>
                          </div>
                          <button className="od-secondary-button" type="button" onClick={() => openCatalogue(line.id)}>
                            Review product
                          </button>
                        </div>
                      )}

                      {editorOpen && (
                        <div className="od-catalogue-editor">
                          <div className="od-catalogue-editor-head">
                            <div>
                              <span className="od-kicker">CATALOGUE</span>
                              <strong>Select the correct product</strong>
                            </div>
                            <button type="button" className="od-text-button" onClick={() => setEditingLineId(null)}>Close</button>
                          </div>

                          <input
                            className="od-catalogue-search"
                            value={catalogueQuery}
                            onChange={(event) => setCatalogueQuery(event.target.value)}
                            placeholder="Search SKU, product or manufacturer"
                            autoFocus
                          />

                          <label className="od-remember-toggle">
                            <input
                              type="checkbox"
                              checked={rememberMatch}
                              onChange={(event) => setRememberMatch(event.target.checked)}
                            />
                            <span>
                              <strong>Remember for this customer</strong>
                              <em>Future orders with {line.raw_sku || "this customer SKU"} can match automatically.</em>
                            </span>
                          </label>

                          <div className="od-catalogue-results">
                            {catalogueLoading ? (
                              <div className="od-catalogue-empty">Loading catalogue…</div>
                            ) : filteredCatalogue.length === 0 ? (
                              <div className="od-catalogue-empty">No products found.</div>
                            ) : (
                              filteredCatalogue.map((product) => (
                                <button
                                  type="button"
                                  className={product.id === line.matched_product_id ? "is-suggested" : undefined}
                                  onClick={() => confirmProduct(line.id, product.id)}
                                  disabled={savingMatch !== null}
                                  key={product.id}
                                >
                                  <span>
                                    <strong>{product.sku}</strong>
                                    <em>{product.name}</em>
                                  </span>
                                  <span>
                                    {product.id === line.matched_product_id ? "Suggested" : product.manufacturer || "Select"}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="od-event-log">
            <span className="od-kicker">AUDIT LOG</span>
            {events.length === 0 ? (
              <p>No events recorded yet.</p>
            ) : (
              events.map((event) => (
                <div key={event.id}>
                  <time>{new Date(event.created_at).toLocaleTimeString()}</time>
                  <strong>{event.message}</strong>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
