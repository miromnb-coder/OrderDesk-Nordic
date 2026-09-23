import { BoxIcon, ClockIcon, DatabaseIcon, MailIcon } from "@/components/icons";

const before = [
  "Email received",
  "Open PDF",
  "Find customer",
  "Search product numbers",
  "Enter 14 order lines",
  "Double-check everything",
  "ERP",
];

const after = ["Email received", "OrderDesk processes it", "Review 1 exception", "Approve"];

function Timeline({ items, variant }: { items: string[]; variant: "muted" | "green" }) {
  return (
    <ol className={`timeline timeline-${variant}`}>
      {items.map((item) => <li key={item}>{item}</li>)}
    </ol>
  );
}

export function ProcessComparison() {
  return (
    <section className="editorial-section section-pad story-grid" aria-labelledby="comparison-title">
      <div className="comparison-block">
        <span className="eyebrow">FROM EMAIL TO SALES ORDER</span>
        <h2 className="section-title" id="comparison-title">Stop retyping<br />customer orders.</h2>
        <div className="comparison-cards">
          <article className="timeline-card">
            <h3>Before OrderDesk</h3>
            <Timeline items={before} variant="muted" />
            <div className="time-chip time-amber"><ClockIcon /> 5–10 minutes</div>
          </article>
          <article className="timeline-card">
            <h3>With OrderDesk</h3>
            <Timeline items={after} variant="green" />
            <div className="time-chip time-green"><ClockIcon /> &lt; 1 minute</div>
          </article>
        </div>
      </div>

      <CustomerMemory />
    </section>
  );
}

function CustomerMemory() {
  return (
    <div className="memory-block" aria-labelledby="memory-title">
      <span className="eyebrow">LEARNS WITH EVERY ORDER</span>
      <h2 className="section-title" id="memory-title">OrderDesk learns how<br />each of your customers<br />orders.</h2>
      <p className="section-lede">The more you use it, the smarter it gets.</p>

      <div className="memory-flow" aria-label="Customer-specific product memory example">
        <article className="memory-card">
          <div className="memory-icon" aria-hidden="true"><MailIcon /></div>
          <h3>Customer&apos;s PO</h3>
          <p>PUMP-37A</p>
        </article>
        <span className="flow-arrow">→</span>
        <article className="memory-card memory-card-wide">
          <div className="memory-icon" aria-hidden="true"><DatabaseIcon /></div>
          <h3>OrderDesk customer<br />memory</h3>
          <p>Putkiurakointi Oy</p>
          <strong>PUMP-37A&nbsp; → &nbsp;GRU-98561418</strong>
        </article>
        <span className="flow-arrow">→</span>
        <article className="memory-card">
          <div className="memory-icon" aria-hidden="true"><BoxIcon /></div>
          <h3>Your catalogue</h3>
          <p>Grundfos ALPHA2 25-60</p>
        </article>
      </div>
      <p className="memory-note">When your team corrects a product match once, OrderDesk remembers it for that customer.</p>
    </div>
  );
}
