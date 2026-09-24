// Deployed Supabase Edge Function: visma-erp
// Handles service-credential connection tests, dry-run payload previews,
// and guarded live Sales Order v3 creation when write_enabled=true.
//
// Runtime implementation is deployed in Supabase and intentionally keeps
// the client secret in Vault. Browser code never receives the secret.
//
// Endpoint: /functions/v1/visma-erp
// Actions:
//   { action: "test_connection" }
//   { action: "create_sales_order", order_id, dry_run: true }
//   { action: "create_sales_order", order_id, dry_run: false }
//
// Authentication:
//   Supabase user JWT is required.
//   Live Visma access uses OAuth2 Client Credentials against:
//   https://connect.visma.com/connect/token
//
// Sales Order endpoint:
//   https://salesorder.visma.net/api/v3/SalesOrders
//
// The deployed source is managed through the Supabase project and mirrors
// the integration contract documented above.
