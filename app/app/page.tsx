import Link from "next/link";
import { demoOrders, statusLabel } from "@/lib/product-demo-data";

export default function OrdersPage() {
  const reviewCount = demoOrders.filter((order) => order.status === "needs_review").length;
  const readyCount = demoOrders.filter((order) => order.status === "ready").length;
  const completedCount = demoOrders.filter((order) => order.status === "completed").length;

  return (
    <div className="od-page">
      <header className="od-page-head">
        <div>
          <span className="od-kicker">ORDER INBOX</span>
          <h1>Orders</h1>
          <p>Review exceptions, approve clean orders, and keep customer product memory improving.</p>
        </div>
        <button className="od-primary-button" type="button">Upload order</button>
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
          <strong>{completedCount + 184}</strong>
          <em>Processed this pilot</em>
        </article>
      </section>

      <section className="od-panel">
        <div className="od-panel-head">
          <div>
            <span className="od-kicker">LATEST</span>
            <h2>Incoming orders</h2>
          </div>
          <div className="od-segmented" aria-label="Order filters">
            <button className="is-selected" type="button">All</button>
            <button type="button">Review</button>
            <button type="button">Ready</button>
          </div>
        </div>

        <div className="od-order-list">
          {demoOrders.map((order) => (
            <Link className="od-order-row" href={`/app/orders/${order.id}`} key={order.id}>
              <div className="od-order-main">
                <span className={`od-status-dot od-status-${order.status}`} />
                <div>
                  <strong>{order.poNumber}</strong>
                  <span>{order.customer}</span>
                </div>
              </div>

              <div className="od-order-meta">
                <span>{order.source}</span>
                <span>{order.receivedAt}</span>
              </div>

              <div className="od-match-score">
                <strong>{order.matched}/{order.lines}</strong>
                <span>lines matched</span>
              </div>

              <div className={`od-status-pill od-status-${order.status}`}>
                {statusLabel(order.status)}
              </div>
              <span className="od-row-arrow">→</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
