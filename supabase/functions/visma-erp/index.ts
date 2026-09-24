
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

function basicAuth(clientId: string, clientSecret: string) {
  return "Basic " + btoa(`${clientId}:${clientSecret}`);
}

async function getAccessToken(clientId: string, clientSecret: string, scopes: string[]) {
  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("scope", scopes.join(" "));

  const response = await fetch("https://connect.visma.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: basicAuth(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(text); } catch {}

  if (!response.ok || typeof parsed.access_token !== "string") {
    const error =
      typeof parsed.error_description === "string"
        ? parsed.error_description
        : typeof parsed.error === "string"
          ? parsed.error
          : `Visma token request failed with HTTP ${response.status}`;
    throw new Error(error);
  }

  return parsed.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const input = await req.json();
    const action = input?.action;

    const { data: membership, error: membershipError } = await userClient
      .from("organization_members")
      .select("organization_id")
      .limit(1)
      .single();

    if (membershipError || !membership) {
      return json({ error: "Workspace not found" }, 403);
    }

    const { data: connection, error: connectionError } = await userClient
      .from("erp_connections")
      .select("id, organization_id, provider, status, client_id, tenant_id, secret_ref, scopes, sales_order_endpoint, write_enabled, default_order_type, default_warehouse, customer_authorized, visma_ai_written_consent, human_review_required, end_user_terms_ready, no_ai_training_ack, data_minimization_ack")
      .eq("organization_id", membership.organization_id)
      .eq("provider", "visma_net")
      .single();

    if (action === "create_sales_order") {
      const orderId = input?.order_id;
      const dryRun = input?.dry_run !== false;

      if (!orderId || typeof orderId !== "string") {
        return json({ error: "order_id is required" }, 400);
      }

      const { data: preview, error: previewError } = await userClient.rpc(
        "prepare_visma_sales_order_payload",
        { target_order_id: orderId }
      );

      if (previewError || !preview) {
        return json({ error: previewError?.message || "Could not prepare Visma payload" }, 400);
      }

      if (dryRun) return json(preview);

      if (connectionError || !connection) {
        return json({ error: "Visma Net connection is not configured" }, 400);
      }

      const complianceReady = [
        connection.customer_authorized,
        connection.visma_ai_written_consent,
        connection.human_review_required,
        connection.end_user_terms_ready,
        connection.no_ai_training_ack,
        connection.data_minimization_ack,
      ].every(Boolean);

      if (!complianceReady) {
        return json({
          error: "Compliance gate is incomplete. Live Visma writes are blocked.",
          dry_run_available: true,
        }, 409);
      }

      if (!connection.write_enabled) {
        return json({ error: "Live Visma writes are disabled for this workspace", dry_run_available: true }, 409);
      }

      if (!connection.client_id || !connection.secret_ref) {
        return json({ error: "Visma client credentials are incomplete" }, 400);
      }

      const { data: secret, error: secretError } = await admin.rpc(
        "get_orderdesk_vault_secret",
        { input_secret_name: connection.secret_ref }
      );

      if (secretError || typeof secret !== "string" || !secret) {
        return json({
          error: "Visma client secret is not stored in Supabase Vault",
          secret_ref: connection.secret_ref,
        }, 409);
      }

      const scopes = Array.isArray(connection.scopes)
        ? connection.scopes
        : ["vismanet_erp_service_api:read","vismanet_erp_service_api:create","vismanet_erp_service_api:update"];

      const token = await getAccessToken(connection.client_id, secret, scopes);
      const endpoint = preview.endpoint;
      const payload = preview.payload;

      const create = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseText = await create.text();
      let responseBody: unknown = null;
      try { responseBody = responseText ? JSON.parse(responseText) : null; } catch { responseBody = responseText || null; }

      if (!create.ok) {
        await admin.from("order_events").insert({
          organization_id: membership.organization_id,
          order_id: orderId,
          event_type: "visma_create_failed",
          message: "Visma Net Sales Order creation failed.",
          metadata: {
            status: create.status,
            response: typeof responseBody === "string" ? responseBody.slice(0, 1000) : responseBody,
          },
        });

        return json({ error: "Visma Net rejected the sales order", status: create.status, response: responseBody }, 502);
      }

      const location = create.headers.get("location");
      const orderNumber =
        typeof responseBody === "object" && responseBody && "orderId" in responseBody
          ? String((responseBody as Record<string, unknown>).orderId ?? "")
          : location?.split("/").pop() ?? null;

      await admin.from("orders").update({
        status: "created",
        erp_order_id: orderNumber,
        erp_order_number: orderNumber,
      }).eq("id", orderId);

      await admin.from("order_events").insert({
        organization_id: membership.organization_id,
        order_id: orderId,
        event_type: "visma_order_created",
        message: "Sales order created in Visma Net.",
        metadata: { location, order_number: orderNumber },
      });

      return json({ ok: true, created: true, order_number: orderNumber, location, response: responseBody });
    }

    if (connectionError || !connection) {
      return json({ error: "Visma Net connection is not configured" }, 400);
    }

    if (action === "test_connection") {
      if (!connection.client_id || !connection.secret_ref) {
        return json({ error: "Visma client credentials are incomplete" }, 400);
      }

      const { data: secret, error: secretError } = await admin.rpc(
        "get_orderdesk_vault_secret",
        { input_secret_name: connection.secret_ref }
      );

      if (secretError || typeof secret !== "string" || !secret) {
        return json({
          error: "Visma client secret is not stored in Supabase Vault",
          secret_ref: connection.secret_ref,
        }, 409);
      }

      const scopes = Array.isArray(connection.scopes)
        ? connection.scopes
        : ["vismanet_erp_service_api:read","vismanet_erp_service_api:create","vismanet_erp_service_api:update"];

      let token: string;
      try {
        token = await getAccessToken(connection.client_id, secret, scopes);
      } catch (error) {
        await admin.rpc("mark_visma_connection_test", {
          input_connection_id: connection.id,
          input_ok: false,
          input_error: error instanceof Error ? error.message : "Token request failed",
        });
        throw error;
      }

      const endpoint = connection.sales_order_endpoint || "https://salesorder.visma.net/api/v3/SalesOrders";
      const verify = await fetch(`${endpoint}?pageSize=1&pageIndex=1`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });

      if (!verify.ok) {
        const body = await verify.text();
        const message = `Sales Order API test failed with HTTP ${verify.status}${body ? `: ${body.slice(0, 400)}` : ""}`;
        await admin.rpc("mark_visma_connection_test", {
          input_connection_id: connection.id,
          input_ok: false,
          input_error: message,
        });
        return json({ ok: false, error: message }, 502);
      }

      await admin.rpc("mark_visma_connection_test", {
        input_connection_id: connection.id,
        input_ok: true,
        input_error: null,
      });

      return json({
        ok: true,
        provider: "visma_net",
        endpoint,
        tenant_id: connection.tenant_id,
        message: "Visma Connect token and Sales Order API access verified.",
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Visma operation failed" }, 500);
  }
});
