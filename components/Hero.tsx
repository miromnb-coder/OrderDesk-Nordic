import { PilotButton } from "@/components/PilotButton";
import { ArrowRightIcon, DocumentIcon } from "@/components/icons";

const incomingRows = [
  ["Uponor elbow 25 mm", "20 pcs"],
  ["Grundfos ALPHA2", "4 pcs"],
  ["PUMP-37A", "2 pcs"],
];

const matchedRows = [
  ["Uponor elbow 25 mm", "SKU UPO-314729", "100%", "success"],
  ["Grundfos ALPHA2", "SKU GRU-98561418", "99%", "success"],
  ["PUMP-37A", "SKU GRU-3984416", "87%", "warning"],
];

export function Hero() {
  return (
    <section className="hero section-pad" aria-labelledby="hero-title">
      <div className="ambient ambient-hero" aria-hidden="true" />
      <div className="hero-copy">
        <span className="eyebrow">ORDER AUTOMATION FOR DISTRIBUTORS</span>
        <h1 id="hero-title">Purchase orders in.<br />Visma orders out.</h1>
        <p className="hero-lede">
          OrderDesk turns customer emails, PDFs and Excel orders into ready sales orders in Visma Net. Your team only reviews the exceptions.
        </p>
        <div className="hero-actions">
          <PilotButton>Test with your own order</PilotButton>
          <a className="text-link" href="#how-it-works">
            See how it works <ArrowRightIcon />
          </a>
        </div>
        <p className="microcopy">Email&nbsp; • &nbsp;PDF&nbsp; • &nbsp;Excel&nbsp; → &nbsp;Visma Net</p>
      </div>

      <div className="order-transformation" aria-label="Example incoming purchase order transformed into a reviewed OrderDesk order">
        <article className="document-card incoming-card">
          <div className="doc-label"><span className="doc-icon"><DocumentIcon /></span> Incoming order</div>
          <h2>Purchase Order #14582</h2>
          <p className="doc-customer">Putkiurakointi Oy</p>
          <div className="doc-divider" />
          <div className="incoming-list">
            {incomingRows.map(([name, qty]) => (
              <div className="doc-row" key={name}>
                <span>{name}</span><strong>{qty}</strong>
              </div>
            ))}
          </div>
        </article>

        <span className="transform-arrow" aria-hidden="true"><ArrowRightIcon /></span>

        <article className="document-card processed-card">
          <div className="doc-label"><span className="brand-dot">◒</span> OrderDesk</div>
          <h2>Order #14582</h2>
          <p className="doc-customer">Putkiurakointi Oy</p>
          <div className="doc-divider" />
          <div className="matched-list">
            {matchedRows.map(([name, sku, confidence, state]) => (
              <div className="matched-row" key={name}>
                <span className="matched-name">{name}</span>
                <span className="sku-arrow">→</span>
                <span className="matched-sku">{sku}</span>
                <span className={`confidence ${state}`}>{confidence}</span>
              </div>
            ))}
          </div>
          <div className="exception-note"><span>!</span> 1 match needs review</div>
          <button type="button" className="visual-only-button" disabled title="Visual product demo only">
            Approve &amp; create in Visma Net
          </button>
        </article>
      </div>
    </section>
  );
}
