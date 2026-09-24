import { customerMappings } from "@/lib/product-demo-data";

export default function CustomerMemoryPage() {
  return (
    <div className="od-page">
      <header className="od-page-head">
        <div>
          <span className="od-kicker">CUSTOMER MEMORY</span>
          <h1>Putkiurakointi Oy</h1>
          <p>Customer-specific product aliases learned from reviewed purchase orders.</p>
        </div>
        <button className="od-secondary-button" type="button">Add mapping</button>
      </header>

      <section className="od-customer-summary">
        <article>
          <span>Visma customer</span>
          <strong>100284</strong>
        </article>
        <article>
          <span>Known mappings</span>
          <strong>{customerMappings.length}</strong>
        </article>
        <article>
          <span>Auto-match rate</span>
          <strong>96%</strong>
        </article>
        <article>
          <span>Orders learned from</span>
          <strong>24</strong>
        </article>
      </section>

      <section className="od-panel">
        <div className="od-panel-head">
          <div>
            <span className="od-kicker">MAPPINGS</span>
            <h2>Customer SKU → your catalogue</h2>
          </div>
          <label className="od-search">
            <span>Search</span>
            <input placeholder="SKU or product name" />
          </label>
        </div>

        <div className="od-mapping-table">
          <div className="od-mapping-head">
            <span>Customer SKU</span>
            <span>Your SKU</span>
            <span>Product</span>
            <span>Used</span>
            <span>Confidence</span>
          </div>
          {customerMappings.map((mapping) => (
            <div className="od-mapping-row" key={mapping.customerSku}>
              <strong>{mapping.customerSku}</strong>
              <strong>{mapping.internalSku}</strong>
              <span>{mapping.product}</span>
              <span>{mapping.uses} orders</span>
              <span className="od-confidence-success">{mapping.confidence}%</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
