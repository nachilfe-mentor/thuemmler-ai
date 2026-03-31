import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function stripeGet(
  endpoint: string,
  secretKey: string
): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });
  return (await response.json()) as Record<string, unknown>;
}

/**
 * This endpoint checks Stripe for the user's subscription status
 * and updates the profiles table accordingly.
 * Called by the frontend after a successful checkout redirect.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate user
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
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, subscription_status")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    // If no customer ID stored, search Stripe by email
    if (!customerId) {
      const customers = (await stripeGet(
        `/customers?email=${encodeURIComponent(user.email!)}&limit=1`,
        stripeSecretKey
      )) as { data?: { id: string }[] };

      if (customers.data && customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    if (!customerId) {
      return new Response(
        JSON.stringify({
          success: true,
          data: { subscription_status: "free", message: "No Stripe customer found" },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get active subscriptions for this customer
    const subs = (await stripeGet(
      `/subscriptions?customer=${customerId}&status=active&limit=1`,
      stripeSecretKey
    )) as { data?: { id: string; status: string; current_period_end: number }[] };

    let subscriptionStatus = "free";
    let subscriptionId = null;
    let periodEnd = null;

    if (subs.data && subs.data.length > 0) {
      const sub = subs.data[0];
      subscriptionStatus = sub.status === "active" ? "pro" : "free";
      subscriptionId = sub.id;
      periodEnd = new Date(sub.current_period_end * 1000).toISOString();
    } else {
      // Also check trialing
      const trialSubs = (await stripeGet(
        `/subscriptions?customer=${customerId}&status=trialing&limit=1`,
        stripeSecretKey
      )) as { data?: { id: string; status: string; current_period_end: number }[] };

      if (trialSubs.data && trialSubs.data.length > 0) {
        const sub = trialSubs.data[0];
        subscriptionStatus = "pro";
        subscriptionId = sub.id;
        periodEnd = new Date(sub.current_period_end * 1000).toISOString();
      }
    }

    // Update the profile in the database
    const { error: updateError } = await supabase.from("profiles").update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      subscription_status: subscriptionStatus,
      subscription_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);

    if (updateError) {
      console.error(`[verify-subscription] DB update error: ${JSON.stringify(updateError)}`);
    }

    console.log(
      `[verify-subscription] User ${user.id}: ${subscriptionStatus} (customer: ${customerId})`
    );

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          subscription_status: subscriptionStatus,
          stripe_customer_id: customerId,
          subscription_period_end: periodEnd,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[verify-subscription] Error: ${message}`);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
