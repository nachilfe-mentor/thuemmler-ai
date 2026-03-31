import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Stripe API helper
// ---------------------------------------------------------------------------
async function stripeRequest(
  endpoint: string,
  params: Record<string, string>,
  secretKey: string
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams(params).toString();
  const response = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    const msg =
      (data as Record<string, Record<string, string>>)?.error?.message ||
      "Stripe API error";
    throw new Error(msg);
  }
  return data as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- Authenticate user ----
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- Parse request ----
    const body = await req.json();
    const interval: string = body.interval || "month";

    if (!["month", "year"].includes(interval)) {
      return new Response(
        JSON.stringify({ success: false, error: "interval must be 'month' or 'year'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      console.error("[stripe-checkout] STRIPE_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Payment service is not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- Check if user already has a Stripe customer ID ----
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    // ---- Build checkout session params ----
    // Price configuration: use env vars if available, otherwise provide defaults
    const monthlyPriceId = Deno.env.get("STRIPE_PRICE_MONTHLY") || "";
    const yearlyPriceId = Deno.env.get("STRIPE_PRICE_YEARLY") || "";
    const priceId = interval === "month" ? monthlyPriceId : yearlyPriceId;

    const params: Record<string, string> = {
      "mode": "subscription",
      "success_url": "https://shift07.ai/app/#/dashboard?checkout=success",
      "cancel_url": "https://shift07.ai/app/#/settings?checkout=cancelled",
      "metadata[user_id]": user.id,
      "allow_promotion_codes": "true",
    };

    // If we have pre-created price IDs, use them
    if (priceId) {
      params["line_items[0][price]"] = priceId;
      params["line_items[0][quantity]"] = "1";
    } else {
      // Create the price inline via price_data
      const unitAmount = interval === "month" ? "2900" : "24900"; // EUR 29/mo or EUR 249/yr
      params["line_items[0][price_data][currency]"] = "eur";
      params["line_items[0][price_data][product_data][name]"] =
        "shift07.ai Pro";
      params["line_items[0][price_data][product_data][description]"] =
        interval === "month"
          ? "shift07.ai Pro - Monatlich"
          : "shift07.ai Pro - Jährlich";
      params["line_items[0][price_data][unit_amount]"] = unitAmount;
      params["line_items[0][price_data][recurring][interval]"] = interval;
      params["line_items[0][quantity]"] = "1";
    }

    // If the user already has a Stripe customer, reuse it
    if (profile?.stripe_customer_id) {
      params["customer"] = profile.stripe_customer_id;
    } else {
      params["customer_email"] = user.email!;
    }

    console.log(
      `[stripe-checkout] Creating checkout session for user ${user.id}, interval: ${interval}`
    );

    const session = await stripeRequest(
      "/checkout/sessions",
      params,
      stripeSecretKey
    );

    console.log(`[stripe-checkout] Session created: ${session.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: { checkout_url: session.url },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[stripe-checkout] Error: ${message}`);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
