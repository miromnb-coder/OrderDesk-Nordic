import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "npm:unpdf@1.8.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

type ParsedLine = {
  line_number: number;
  raw_sku: string | null;
  raw_description: string | null;
  raw_quantity: number;
  raw_unit: string | null;
};

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  manufacturer: string | null;
  unit: string | null;
  search_text: string | null;
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string) {
  return new Set(normalize(value).split(" ").filter((token) => token.length > 1));
}

function similarity(a: string, b: string) {
  const aa = tokens(a);
  const bb = tokens(b);
  if (!aa.size || !bb.size) return 0;
  let intersection = 0;
  for (const token of aa) if (bb.has(token)) intersection += 1;
  const union = new Set([...aa, ...bb]).size;
  return union ? intersection / union : 0;
}

function parseDate(value: string | undefined) {
  if (!value) return null;
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const match = value.match(/(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})/);
  if (!match) return null;
  const month = months[match[2].slice(0, 3).toLowerCase()];
  if (!month) return null;
  return `${match[3]}-${month}-${match[1].padStart(2, "0")}`;
}

function parseOrder(text: string) {
  const rawLines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const poMatch = text.match(/\bPO\s*#?\s*([A-Z0-9-]{3,})\b/i);
  const dateMatches = [...text.matchAll(/\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/g)].map((m) => m[0]);
  const businessId = text.match(/Business\s*ID\s*:\s*([0-9-]+)/i)?.[1] ?? null;

  const companyCandidates = rawLines.filter((line) =>
    /\b(OYJ?|AB|AS)\b/i.test(line) &&
    !/SUPPLIER|DELIVER|TEST PURCHASE/i.test(line) &&
    line.length <= 100
  );

  const unitHeader = rawLines.findIndex((line) => /^UNIT$/i.test(line));
  const notesIndex = rawLines.findIndex((line, index) => index > unitHeader && /^DELIVERY NOTES$/i.test(line));
  const lines: ParsedLine[] = [];

  // First handle layout-preserved PDFs where each order row appears on one text line.
  const rowPattern = /^\s*(\d+)\s+([A-Z0-9][A-Z0-9._\/-]{1,39})\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+([A-Za-z]{1,12})\s*$/;
  for (const rawLine of text.split(/\r?\n/)) {
    const match = rawLine.match(rowPattern);
    if (!match) continue;

    const lineNumber = Number(match[1]);
    const quantity = Number(match[4].replace(",", "."));

    if (!Number.isInteger(lineNumber) || lineNumber <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    lines.push({
      line_number: lineNumber,
      raw_sku: match[2],
      raw_description: match[3].trim(),
      raw_quantity: quantity,
      raw_unit: match[5],
    });
  }

  // Fallback for PDFs whose extractor emits each table cell as a separate line.
  if (!lines.length && unitHeader >= 0) {
    const rowTokens = rawLines.slice(unitHeader + 1, notesIndex > unitHeader ? notesIndex : undefined);
    let i = 0;

    while (i < rowTokens.length) {
      const lineNumber = Number(rowTokens[i]);
      const sku = rowTokens[i + 1];
      const description = rowTokens[i + 2];
      const quantity = Number(String(rowTokens[i + 3] ?? "").replace(",", "."));
      const unit = rowTokens[i + 4];

      if (
        Number.isInteger(lineNumber) &&
        lineNumber > 0 &&
        typeof sku === "string" &&
        sku.length >= 2 &&
        typeof description === "string" &&
        description.length >= 2 &&
        Number.isFinite(quantity) &&
        quantity > 0 &&
        typeof unit === "string" &&
        unit.length >= 1
      ) {
        lines.push({
          line_number: lineNumber,
          raw_sku: sku,
          raw_description: description,
          raw_quantity: quantity,
          raw_unit: unit,
        });
        i += 5;
      } else {
        i += 1;
      }
    }
  }

  return {
    poNumber: poMatch?.[1] ?? null,
    orderDate: parseDate(dateMatches[0]),
    requestedDeliveryDate: parseDate(dateMatches[1]),
    businessId,
    customerName: companyCandidates[0] ?? null,
    lines,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return response({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  try {
    const { order_id } = await req.json();
    if (!order_id || typeof order_id !== "string") {
      return response({ error: "order_id is required" }, 400);
    }

    const { data: order, error: orderError } = await userClient
      .from("orders")
      .select("id, organization_id, source_file_name, source_storage_path, source_type")
      .eq("id", order_id)
      .single();

    if (orderError || !order) return response({ error: "Order not found" }, 404);
    if (order.source_type !== "pdf" || !order.source_storage_path) {
      return response({ error: "A stored PDF is required" }, 400);
    }

    await admin.from("orders").update({ status: "processing", error_message: null }).eq("id", order.id);
    await admin.from("order_events").insert({
      organization_id: order.organization_id,
      order_id: order.id,
      event_type: "processing_started",
      message: "Structured order extraction started.",
    });

    const { data: file, error: downloadError } = await admin.storage
      .from("order-files")
      .download(order.source_storage_path);

    if (downloadError || !file) throw downloadError ?? new Error("Could not read uploaded PDF");

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
      await admin.from("orders")
        .update({ status: "failed", error_message: "Uploaded file is not a valid PDF." })
        .eq("id", order.id);
      return response({ error: "Invalid PDF" }, 422);
    }

    const pdf = await getDocumentProxy(bytes, { maxImageSize: 16_777_216 });
    if (pdf.numPages > 30) {
      await admin.from("orders")
        .update({ status: "failed", error_message: "PDF exceeds the 30-page pilot limit." })
        .eq("id", order.id);
      return response({ error: "PDF exceeds page limit" }, 422);
    }

    const extraction = await Promise.race([
      extractText(pdf, { mergePages: true }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("PDF text extraction timed out")), 15_000)
      ),
    ]);

    const text = Array.isArray(extraction.text) ? extraction.text.join("\n") : extraction.text;
    const parsed = parseOrder(text);

    if (!parsed.lines.length) {
      await admin.from("orders")
        .update({
          status: "needs_review",
          po_number: parsed.poNumber,
          order_date: parsed.orderDate,
          requested_delivery_date: parsed.requestedDeliveryDate,
          raw_customer_name: parsed.customerName,
          extraction_version: "unpdf-rules-v2",
          extraction_metadata: {
            pages: extraction.totalPages,
            extracted_lines: 0,
            requires_manual_extraction: true,
          },
          processed_at: new Date().toISOString(),
          error_message: "No structured order lines were detected automatically.",
        })
        .eq("id", order.id);

      await admin.from("order_events").insert({
        organization_id: order.organization_id,
        order_id: order.id,
        event_type: "extraction_needs_review",
        message: "PDF text was extracted, but order lines need manual review.",
      });

      return response({ ok: true, order_id: order.id, stage: "needs_manual_extraction", lines: 0 });
    }

    const { data: customers } = await admin
      .from("customers")
      .select("id, name, business_id")
      .eq("organization_id", order.organization_id)
      .eq("active", true);

    let matchedCustomer: { id: string; name: string } | null = null;
    if (customers?.length) {
      if (parsed.businessId) {
        const byBusinessId = customers.find((customer) => customer.business_id === parsed.businessId);
        if (byBusinessId) matchedCustomer = { id: byBusinessId.id, name: byBusinessId.name };
      }

      if (!matchedCustomer && parsed.customerName) {
        const wanted = normalize(parsed.customerName);
        const exact = customers.find((customer) => normalize(customer.name) === wanted);
        if (exact) matchedCustomer = { id: exact.id, name: exact.name };
      }
    }

    const { data: productsData } = await admin
      .from("products")
      .select("id, sku, name, manufacturer, unit, search_text")
      .eq("organization_id", order.organization_id)
      .eq("active", true)
      .limit(3000);

    const products = (productsData ?? []) as ProductRow[];
    const productById = new Map(products.map((product) => [product.id, product]));

    const mappings = matchedCustomer
      ? (await admin
          .from("customer_product_mappings")
          .select("customer_sku, product_id, confidence")
          .eq("organization_id", order.organization_id)
          .eq("customer_id", matchedCustomer.id)).data ?? []
      : [];

    const mappingBySku = new Map(
      mappings.map((mapping) => [normalize(mapping.customer_sku), mapping]),
    );

    const lineRows = parsed.lines.map((line) => {
      let matchedProduct: ProductRow | null = null;
      let confidence: number | null = null;
      let method: "customer_mapping" | "catalogue" | null = null;

      const knownMapping = line.raw_sku ? mappingBySku.get(normalize(line.raw_sku)) : null;
      if (knownMapping) {
        matchedProduct = productById.get(knownMapping.product_id) ?? null;
        if (matchedProduct) {
          confidence = Number(knownMapping.confidence) || 100;
          method = "customer_mapping";
        }
      }

      if (!matchedProduct && line.raw_sku) {
        const exactSku = products.find((product) => normalize(product.sku) === normalize(line.raw_sku));
        if (exactSku) {
          matchedProduct = exactSku;
          confidence = 99;
          method = "catalogue";
        }
      }

      if (!matchedProduct && line.raw_description && products.length) {
        let best: ProductRow | null = null;
        let bestScore = 0;

        for (const product of products) {
          const candidateText = [product.name, product.manufacturer, product.search_text]
            .filter(Boolean)
            .join(" ");
          const score = similarity(line.raw_description, candidateText);
          if (score > bestScore) {
            best = product;
            bestScore = score;
          }
        }

        if (best && bestScore >= 0.42) {
          matchedProduct = best;
          confidence = Math.min(94, Math.round(74 + bestScore * 22));
          method = "catalogue";
        }
      }

      return {
        order_id: order.id,
        line_number: line.line_number,
        raw_sku: line.raw_sku,
        raw_description: line.raw_description,
        raw_quantity: line.raw_quantity,
        raw_unit: line.raw_unit,
        matched_product_id: matchedProduct?.id ?? null,
        match_confidence: confidence,
        match_method: method,
        review_status: confidence !== null && confidence >= 98 ? "matched" : "needs_review",
      };
    });

    await admin.from("order_lines").delete().eq("order_id", order.id);
    const { error: lineInsertError } = await admin.from("order_lines").insert(lineRows);
    if (lineInsertError) throw lineInsertError;

    const confidences = lineRows
      .map((line) => line.match_confidence)
      .filter((value): value is number => value !== null);
    const overallConfidence = confidences.length
      ? Math.round(confidences.reduce((sum, value) => sum + value, 0) / parsed.lines.length)
      : 0;

    const needsReview =
      !matchedCustomer ||
      lineRows.some((line) => line.review_status === "needs_review");

    await admin.from("orders")
      .update({
        customer_id: matchedCustomer?.id ?? null,
        raw_customer_name: parsed.customerName,
        po_number: parsed.poNumber,
        order_date: parsed.orderDate,
        requested_delivery_date: parsed.requestedDeliveryDate,
        overall_confidence: overallConfidence,
        status: needsReview ? "needs_review" : "ready",
        extraction_version: "unpdf-rules-v2",
        extraction_metadata: {
          pages: extraction.totalPages,
          extracted_lines: parsed.lines.length,
          customer_matched: Boolean(matchedCustomer),
          product_matches: lineRows.filter((line) => line.matched_product_id).length,
        },
        processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", order.id);

    await admin.from("order_events").insert({
      organization_id: order.organization_id,
      order_id: order.id,
      event_type: "extraction_completed",
      message: `Extracted ${parsed.lines.length} order lines and matched ${lineRows.filter((line) => line.matched_product_id).length} catalogue items.`,
      metadata: {
        po_number: parsed.poNumber,
        customer_name: parsed.customerName,
        customer_matched: Boolean(matchedCustomer),
        line_count: parsed.lines.length,
        overall_confidence: overallConfidence,
      },
    });

    return response({
      ok: true,
      order_id: order.id,
      stage: needsReview ? "needs_review" : "ready",
      po_number: parsed.poNumber,
      customer: matchedCustomer?.name ?? parsed.customerName,
      customer_matched: Boolean(matchedCustomer),
      lines: lineRows.length,
      product_matches: lineRows.filter((line) => line.matched_product_id).length,
      overall_confidence: overallConfidence,
    });
  } catch (error) {
    return response(
      { error: error instanceof Error ? error.message : "Processing failed" },
      500,
    );
  }
});
