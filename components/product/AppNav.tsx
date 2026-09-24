"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/app", label: "Orders", mark: "01" },
  { href: "/app/customers/putkiurakointi", label: "Customer memory", mark: "02" },
  { href: "/app/integrations", label: "Integrations", mark: "03" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <aside className="od-sidebar">
      <div>
        <Link href="/" className="od-product-brand">OrderDesk</Link>
        <p className="od-workspace-label">Nordic Wholesale Oy</p>
      </div>

      <nav className="od-nav" aria-label="Product navigation">
        {items.map((item) => {
          const active =
            item.href === "/app"
              ? pathname === "/app" || pathname.startsWith("/app/orders/")
              : pathname.startsWith(item.href);

          return (
            <Link key={item.href} href={item.href} className={active ? "is-active" : undefined}>
              <span>{item.mark}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="od-sidebar-foot">
        <div className="od-user-dot">MN</div>
        <div>
          <strong>Pilot workspace</strong>
          <span>Human-reviewed mode</span>
        </div>
      </div>
    </aside>
  );
}
