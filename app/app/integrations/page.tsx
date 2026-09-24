export default function IntegrationsPage() {
  return (
    <div className="od-page">
      <header className="od-page-head">
        <div>
          <span className="od-kicker">INTEGRATIONS</span>
          <h1>Visma Net</h1>
          <p>ERP connection status and the defaults OrderDesk will use when preparing sales orders.</p>
        </div>
      </header>

      <section className="od-integration-card">
        <div className="od-integration-top">
          <div className="od-integration-logo">V</div>
          <div>
            <span>ERP CONNECTION</span>
            <h2>Visma Net</h2>
            <p>Nordic Wholesale Oy</p>
          </div>
          <div className="od-connected"><span /> Connected</div>
        </div>

        <div className="od-integration-grid">
          <div><span>Mode</span><strong>Pilot · human reviewed</strong></div>
          <div><span>Last catalogue sync</span><strong>2 minutes ago</strong></div>
          <div><span>Default warehouse</span><strong>MAIN</strong></div>
          <div><span>Sales order type</span><strong>SO</strong></div>
        </div>

        <div className="od-integration-foot">
          <p>OrderDesk is currently configured to prepare orders for review before any ERP write is allowed.</p>
          <button className="od-secondary-button" type="button">Connection settings</button>
        </div>
      </section>
    </div>
  );
}
