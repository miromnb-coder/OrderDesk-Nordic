import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    },
  );

  try {
    const { order_id } = await req.json();
    if (!order_id || typeof order_id !== "string") {
      return Response.json({ error: "order_id is required" }, { status: 400, headers: corsHeaders });
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, organization_id, source_file_name, source_storage_path, source_type")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return Response.json({ error: "Order not found" }, { status: 404, headers: corsHeaders });
    }

    if (order.source_type !== "pdf" || !order.source_storage_path) {
      await supabase.from("orders")
        .update({ status: "failed", error_message: "A stored PDF is required." })
        .eq("id", order.id);
      return Response.json({ error: "A stored PDF is required" }, { status: 400, headers: corsHeaders });
    }

    await supabase.from("orders")
      .update({ status: "processing", error_message: null })
      .eq("id", order.id);

    await supabase.from("order_events").insert({
      organization_id: order.organization_id,
      order_id: order.id,
      event_type: "processing_started",
      message: "Order processing validation started.",
    });

    const { data: file, error: downloadError } = await supabase.storage
      .from("order-files")
      .download(order.source_storage_path);

    if (downloadError || !file) throw downloadError ?? new Error("Could not read uploaded PDF");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdfMagic = new TextDecoder().decode(bytes.slice(0, 5));

    if (pdfMagic !== "%PDF-") {
      await supabase.from("orders")
        .update({ status: "failed", error_message: "Uploaded file is not a valid PDF." })
        .eq("id", order.id);

      await supabase.from("order_events").insert({
        organization_id: order.organization_id,
        order_id: order.id,
        event_type: "validation_failed",
        message: "Uploaded file failed PDF validation.",
      });

      return Response.json({ error: "Invalid PDF" }, { status: 422, headers: corsHeaders });
    }

    await supabase.from("orders")
      .update({
        status: "needs_review",
        processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", order.id);

    await supabase.from("order_events").insert({
      organization_id: order.organization_id,
      order_id: order.id,
      event_type: "document_validated",
      message: "PDF validated and stored. Extraction engine is the next pipeline stage.",
      metadata: { file_name: order.source_file_name, size_bytes: bytes.byteLength },
    });

    return Response.json(
      { ok: true, order_id: order.id, stage: "document_validated", next_stage: "structured_extraction" },
      { headers: corsHeaders },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500, headers: corsHeaders },
    );
  }
});
