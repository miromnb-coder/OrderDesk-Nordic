import type { Metadata } from "next";
import { AppNav } from "@/components/product/AppNav";
import "./product.css";

export const metadata: Metadata = {
  title: "OrderDesk App",
  description: "Review and approve incoming purchase orders before they become Visma Net sales orders.",
};

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="od-app">
      <AppNav />
      <main className="od-main">{children}</main>
    </div>
  );
}
