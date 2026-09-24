"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";

const items = [
  { href: "/app", label: "Orders", mark: "01" },
  { href: "/app/customers/putkiurakointi", label: "Customer memory", mark: "02" },
  { href: "/app/integrations", label: "Integrations", mark: "03" },
];

export function AppNav() {
  const pathname = usePathname();
  const [workspaceName, setWorkspaceName] = useState("OrderDesk workspace");

  useEffect(() => {
    async function loadWorkspace() {
      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .limit(1)
        .maybeSingle();

      if (!membership) return;

      const { data: organization } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", membership.organization_id)
        .maybeSingle();

      if (organization?.name) setWorkspaceName(organization.name);
    }

    loadWorkspace();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/app/login";
  }

  return (
    <aside className="od-sidebar">
      <div>
        <Link href="/" className="od-product-brand">OrderDesk</Link>
        <p className="od-workspace-label">{workspaceName}</p>
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
        <div className="od-user-dot">OD</div>
        <div>
          <strong>Pilot workspace</strong>
          <button type="button" className="od-signout" onClick={signOut}>Sign out</button>
        </div>
      </div>
    </aside>
  );
}
