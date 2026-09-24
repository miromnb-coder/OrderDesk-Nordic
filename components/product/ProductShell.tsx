"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import { AppNav } from "@/components/product/AppNav";

type GateState = "loading" | "ready";

export function ProductShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<GateState>("loading");
  const isLogin = pathname === "/app/login";
  const isOnboarding = pathname === "/app/onboarding";

  useEffect(() => {
    let mounted = true;

    async function check() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        if (!isLogin) router.replace("/app/login");
        if (mounted) setState("ready");
        return;
      }

      if (isLogin) {
        router.replace("/app");
        return;
      }

      if (!isOnboarding) {
        const { data: membership } = await supabase
          .from("organization_members")
          .select("organization_id")
          .limit(1)
          .maybeSingle();

        if (!membership) {
          router.replace("/app/onboarding");
          return;
        }
      }

      if (mounted) setState("ready");
    }

    check();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      check();
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [isLogin, isOnboarding, router]);

  if (state === "loading") {
    return (
      <div className="od-auth-screen">
        <div className="od-auth-loading">Opening OrderDesk…</div>
      </div>
    );
  }

  if (isLogin || isOnboarding) {
    return <main className="od-auth-screen">{children}</main>;
  }

  return (
    <div className="od-app">
      <AppNav />
      <main className="od-main">{children}</main>
    </div>
  );
}
