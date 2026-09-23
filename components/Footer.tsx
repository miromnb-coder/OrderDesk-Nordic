import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <strong>OrderDesk</strong>
      <p>Order-entry automation for Nordic distributors.</p>
      <div className="footer-meta">
        <span>Designed around Visma Net order workflows.</span>
        <Link href="/privacy">Privacy</Link>
      </div>
    </footer>
  );
}
