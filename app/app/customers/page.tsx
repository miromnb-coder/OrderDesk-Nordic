"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

type Mapping = {
  id: string;
  customer_sku: string;
  customer_description: string | null;
  confidence: number;
  times_used: number;
  source: string;
  updated_at: string;
  customer: { name: string } | null;
  product: { sku: string; name: string } | null;
};

export default function CustomerMemoryPage() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("customer_product_mappings")
        .select("id, customer_sku, customer_description, confidence, times_used, source, updated_at, customer:customers!customer_product_mappings_customer_id_fkey(name), product:products!customer_product_mappings_product_id_fkey(sku,name)")
        .order("updated_at", { ascending: false });

      setMappings((data as unknown as Mapping[] | null) ?? []);
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
          <p>Every remembered correction becomes a reusable customer-specific SKU mapping.</p>
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
            <span>Confirm a review line and keep “Remember for this customer” enabled.</span>
          </div>
        ) : (
          <div className="od-mapping-table">
            <div className="od-mapping-head">
              <span>Customer SKU</span>
              <span>Your SKU</span>
              <span>Product</span>
              <span>Customer</span>
              <span>Confidence</span>
            </div>

            {mappings.map((mapping) => (
              <div className="od-mapping-row" key={mapping.id}>
                <strong>{mapping.customer_sku}</strong>
                <strong>{mapping.product?.sku || "—"}</strong>
                <span>{mapping.product?.name || mapping.customer_description || "—"}</span>
                <span>{mapping.customer?.name || "—"}</span>
                <span className="od-confidence-success">{mapping.confidence}%</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
