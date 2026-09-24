import type { Metadata } from "next";
import { ProductShell } from "@/components/product/ProductShell";
import "./product.css";

export const metadata: Metadata = {
  title: "OrderDesk App",
  description: "Review and approve incoming purchase orders before they become Visma Net sales orders.",
};

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return <ProductShell>{children}</ProductShell>;
}
