import type { Metadata } from "next";
import "./globals.css";
import { PilotProvider } from "@/components/PilotProvider";

export const metadata: Metadata = {
  title: "OrderDesk — Purchase orders in. Visma orders out.",
  description: "OrderDesk turns emailed purchase orders, PDFs and Excel files into ready sales orders for Visma Net workflows.",
  openGraph: {
    title: "OrderDesk — Purchase orders in. Visma orders out.",
    description: "OrderDesk turns emailed purchase orders, PDFs and Excel files into ready sales orders for Visma Net workflows.",
    type: "website",
    siteName: "OrderDesk",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PilotProvider>{children}</PilotProvider>
      </body>
    </html>
  );
}
