"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

type Mapping = {
  id: string;
  customer_sku: string;
  confidence: number;
  times_used: number;
  customer_id: string;
  product_id: string;
};

export default function CustomerMemoryPage() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("customer_product_mappings")
        .select("id, customer_sku, confidence, times_used, customer_id, product_id")
        .order("times_used", { ascending: false });
      setMappings((data as Mapping[] | null) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="od-page">
      <header className="od-page-head">
        <div>
          <span className="od-kicker">CUSTOMER MEMORY</span>
          <h1>Product mappings</h1>
          <p>Confirmed customer-specific aliases will appear here as the review workflow learns.</p>
        </div>
      </header>

      <section className="od-panel">
        <div className="od-panel-head">
          <div>
            <span className="od-kicker">MAPPINGS</span>
            <h2>Customer SKU → catalogue product</h2>
          </div>
          <span className="od-live-chip">Supabase live data</span>
        </div>

        {loading ? (
          <div className="od-empty-state">Loading mappings…</div>
        ) : mappings.length === 0 ? (
          <div className="od-empty-state">
            <strong>No customer mappings yet.</strong>
            <span>Mappings will be created when reviewed order lines are confirmed and remembered for a customer.</span>
          </div>
        ) : (
          <div className="od-mapping-table">
            <div className="od-mapping-head">
              <span>Customer SKU</span><span>Product</span><span>Customer</span><span>Used</span><span>Confidence</span>
            </div>
            {mappings.map((m) => (
              <div className="od-mapping-row" key={m.id}>
                <strong>{m.customer_sku}</strong>
                <strong>{m.product_id}</strong>
                <span>{m.customer_id}</span>
                <span>{m.times_used} orders</span>
                <span className="od-confidence-success">{m.confidence}%</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
