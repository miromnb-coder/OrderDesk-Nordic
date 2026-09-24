export type OrderStatus = "needs_review" | "ready" | "completed";

export type DemoOrder = {
  id: string;
  poNumber: string;
  customer: string;
  customerSlug: string;
  receivedAt: string;
  source: "PDF" | "Excel" | "Email";
  lines: number;
  matched: number;
  status: OrderStatus;
  confidence: number;
};

export type DemoLine = {
  line: number;
  customerSku: string;
  description: string;
  quantity: number;
  unit: string;
  internalSku: string | null;
  internalName: string | null;
  confidence: number | null;
  status: "matched" | "review";
};

export const demoOrders: DemoOrder[] = [
  {
    id: "14582",
    poNumber: "PO #14582",
    customer: "Putkiurakointi Oy",
    customerSlug: "putkiurakointi",
    receivedAt: "Today, 08:31",
    source: "PDF",
    lines: 14,
    matched: 13,
    status: "needs_review",
    confidence: 96,
  },
  {
    id: "14581",
    poNumber: "PO #14581",
    customer: "Nordic Pipe Service Oy",
    customerSlug: "nordic-pipe-service",
    receivedAt: "Today, 08:12",
    source: "Email",
    lines: 8,
    matched: 8,
    status: "ready",
    confidence: 99,
  },
  {
    id: "14579",
    poNumber: "PO #14579",
    customer: "Lämpötekniikka Pirkanmaa Oy",
    customerSlug: "lampotekniikka",
    receivedAt: "Yesterday, 16:44",
    source: "Excel",
    lines: 21,
    matched: 21,
    status: "completed",
    confidence: 99,
  },
  {
    id: "14577",
    poNumber: "PO #14577",
    customer: "Putkiurakointi Oy",
    customerSlug: "putkiurakointi",
    receivedAt: "Yesterday, 14:18",
    source: "PDF",
    lines: 6,
    matched: 6,
    status: "completed",
    confidence: 100,
  },
];

export const demoOrderLines: DemoLine[] = [
  {
    line: 1,
    customerSku: "PUMP-37A",
    description: "Grundfos Alpha2 25-60",
    quantity: 2,
    unit: "pcs",
    internalSku: "GRU-98561418",
    internalName: "Grundfos ALPHA2 25-60",
    confidence: 100,
    status: "matched",
  },
  {
    line: 2,
    customerSku: "UPO-EL25",
    description: "Uponor elbow 25 mm",
    quantity: 20,
    unit: "pcs",
    internalSku: "UPO-314729",
    internalName: "Uponor S-Press PLUS elbow 25",
    confidence: 100,
    status: "matched",
  },
  {
    line: 3,
    customerSku: "VALVE-X12",
    description: "Danfoss valve 1/2 inch",
    quantity: 5,
    unit: "pcs",
    internalSku: "DAN-004812",
    internalName: "Danfoss RA-N valve body 1/2",
    confidence: 99,
    status: "matched",
  },
  {
    line: 4,
    customerSku: "CUSTOM-44",
    description: "Circulation pump 25-40",
    quantity: 1,
    unit: "pcs",
    internalSku: "GRU-99411175",
    internalName: "Grundfos ALPHA1 L 25-40",
    confidence: 87,
    status: "review",
  },
];

export const customerMappings = [
  { customerSku: "PUMP-37A", internalSku: "GRU-98561418", product: "Grundfos ALPHA2 25-60", uses: 18, confidence: 100 },
  { customerSku: "VALVE-X12", internalSku: "DAN-004812", product: "Danfoss RA-N valve body 1/2", uses: 11, confidence: 100 },
  { customerSku: "PIPE-X2", internalSku: "UPO-1087992", product: "Uponor Combi Pipe 25 x 2.5", uses: 9, confidence: 100 },
  { customerSku: "ELBOW-25", internalSku: "UPO-314729", product: "Uponor S-Press PLUS elbow 25", uses: 7, confidence: 100 },
];

export function statusLabel(status: OrderStatus) {
  if (status === "needs_review") return "Needs review";
  if (status === "ready") return "Ready";
  return "Completed";
}
