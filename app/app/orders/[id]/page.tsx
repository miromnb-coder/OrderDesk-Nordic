import Link from "next/link";
import { demoOrderLines } from "@/lib/product-demo-data";

export default async function OrderReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="od-page od-review-page">
      <header className="od-review-head">
        <div>
          <Link href="/app" className="od-back-link">← Orders</Link>
          <span className="od-kicker">PURCHASE ORDER</span>
          <h1>PO #{id}</h1>
          <p>Putkiurakointi Oy · received today at 08:31</p>
        </div>
        <div className="od-review-actions">
          <span className="od-status-pill od-status-needs_review">1 line needs review</span>
          <button className="od-primary-button" type="button">Approve order</button>
        </div>
      </header>

      <div className="od-review-grid">
        <section className="od-source-panel">
          <div className="od-panel-head compact">
            <div>
              <span className="od-kicker">SOURCE</span>
              <h2>Original PDF</h2>
            </div>
            <span className="od-file-chip">PO_14582.pdf</span>
          </div>

          <div className="od-paper">
            <span className="od-paper-brand">PUTKIURAKOINTI OY</span>
            <h3>Purchase order #14582</h3>
            <div className="od-paper-meta">
              <span>24 Sep 2026</span>
              <span>Delivery: Tampere</span>
            </div>
            <div className="od-paper-lines">
              <div><strong>PUMP-37A</strong><span>Grundfos Alpha2 25-60</span><b>2 pcs</b></div>
              <div><strong>UPO-EL25</strong><span>Uponor elbow 25 mm</span><b>20 pcs</b></div>
              <div><strong>VALVE-X12</strong><span>Danfoss valve 1/2 inch</span><b>5 pcs</b></div>
              <div className="is-highlighted"><strong>CUSTOM-44</strong><span>Circulation pump 25-40</span><b>1 pcs</b></div>
            </div>
          </div>
        </section>

        <section className="od-extracted-panel">
          <div className="od-panel-head compact">
            <div>
              <span className="od-kicker">ORDERDESK</span>
              <h2>Interpreted order</h2>
            </div>
            <span className="od-confidence-chip">96% overall</span>
          </div>

          <div className="od-customer-match">
            <div>
              <span>Customer</span>
              <strong>Putkiurakointi Oy</strong>
              <em>Visma customer 100284</em>
            </div>
            <span className="od-confidence-success">99%</span>
          </div>

          <div className="od-line-table">
            <div className="od-line-header">
              <span>Customer line</span>
              <span>Matched catalogue item</span>
              <span>Qty</span>
              <span>Confidence</span>
            </div>

            {demoOrderLines.map((line) => (
              <div className={`od-line-row ${line.status === "review" ? "needs-review" : ""}`} key={line.line}>
                <div>
                  <strong>{line.customerSku}</strong>
                  <span>{line.description}</span>
                </div>
                <div>
                  <strong>{line.internalSku}</strong>
                  <span>{line.internalName}</span>
                </div>
                <div className="od-qty">{line.quantity} {line.unit}</div>
                <div>
                  <span className={line.status === "review" ? "od-confidence-warning" : "od-confidence-success"}>
                    {line.confidence}%
                  </span>
                </div>
                {line.status === "review" && (
                  <div className="od-review-callout">
                    <div>
                      <span>Needs review</span>
                      <strong>Is this the correct product?</strong>
                    </div>
                    <div className="od-review-buttons">
                      <button type="button">Search catalogue</button>
                      <button type="button" className="is-dark">Confirm match</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="od-memory-note">
            <span>Customer memory</span>
            Confirming the highlighted line will save <strong>CUSTOM-44 → GRU-99411175</strong> for Putkiurakointi Oy.
          </div>
        </section>
      </div>
    </div>
  );
}
