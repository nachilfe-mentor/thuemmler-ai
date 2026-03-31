import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// No CORS headers needed for webhooks — Stripe calls this directly.

// ---------------------------------------------------------------------------
// Stripe signature verification
// ---------------------------------------------------------------------------
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string
): Promise<boolean> {
  const parts = sigHeader.split(",").reduce(
    (acc, part) => {
      const [key, value] = part.split("=");
      if (key === "t") acc.timestamp = value;
      if (key === "v1") acc.signatures.push(value);
      return acc;
    },
    { timestamp: "", signatures: [] as string[] }
  );

  if (!parts.timestamp || parts.signatures.length === 0) {
    return false;
  }

  // Check timestamp tolerance (5 minutes)
  const timestampAge = Math.floor(Date.now() / 1000) - parseInt(parts.timestamp);
  if (Math.abs(timestampAge) > 300) {
    console.error("[stripe-webhook] Timestamp outside tolerance window");
    return false;
  }

  // Compute expected signature
  const signedPayload = `${parts.timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload)
  );

  // Convert to hex
  const expectedSig = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  return parts.signatures.some((sig) => {
    if (sig.length !== expectedSig.length) return false;
    let result = 0;
    for (let i = 0; i < sig.length; i++) {
      result |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
    }
    return result === 0;
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeSecretKey || !webhookSecret) {
      console.error("[stripe-webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
      return new Response(
        JSON.stringify({ error: "Webhook not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // ---- Verify signature ----
    const sigHeader = req.headers.get("stripe-signature");
    if (!sigHeader) {
      console.error("[stripe-webhook] Missing stripe-signature header");
      return new Response(
        JSON.stringify({ error: "Missing signature" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const payload = await req.text();
    const isValid = await verifyStripeSignature(payload, sigHeader, webhookSecret);
    if (!isValid) {
      console.error("[stripe-webhook] Invalid signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const event = JSON.parse(payload);
    console.log(`[stripe-webhook] Received event: ${event.type} (${event.id})`);

    // ---- Supabase client ----
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ---- Handle events ----
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (!userId) {
          console.error("[stripe-webhook] checkout.session.completed: missing user_id in metadata");
          break;
        }

        console.log(
          `[stripe-webhook] Activating Pro for user ${userId}, customer ${customerId}`
        );

        // Fetch subscription details for period end
        let periodEnd: string | null = null;
        if (subscriptionId) {
          try {
            const subResponse = await fetch(
              `https://api.stripe.com/v1/subscriptions/${subscriptionId}`,
              {
                headers: { Authorization: `Bearer ${stripeSecretKey}` },
              }
            );
            if (subResponse.ok) {
              const subData = await subResponse.json();
              periodEnd = new Date(
                subData.current_period_end * 1000
              ).toISOString();
            }
          } catch (err) {
            console.error(`[stripe-webhook] Failed to fetch subscription: ${err}`);
          }
        }

        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: "pro",
            subscription_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (updateError) {
          console.error(
            `[stripe-webhook] Failed to update profile: ${JSON.stringify(updateError)}`
          );
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const periodEnd = new Date(
          subscription.current_period_end * 1000
        ).toISOString();

        // Determine status
        let status = "pro";
        if (subscription.cancel_at_period_end) {
          status = "cancelling";
        }
        if (subscription.status === "past_due") {
          status = "past_due";
        }
        if (
          subscription.status === "canceled" ||
          subscription.status === "unpaid"
        ) {
          status = "cancelled";
        }

        console.log(
          `[stripe-webhook] Subscription updated for customer ${customerId}: status=${status}`
        );

        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            subscription_status: status,
            subscription_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", customerId);

        if (updateError) {
          console.error(
            `[stripe-webhook] Failed to update profile: ${JSON.stringify(updateError)}`
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        console.log(
          `[stripe-webhook] Subscription deleted for customer ${customerId}`
        );

        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            subscription_status: "cancelled",
            stripe_subscription_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", customerId);

        if (updateError) {
          console.error(
            `[stripe-webhook] Failed to update profile: ${JSON.stringify(updateError)}`
          );
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const attemptCount = invoice.attempt_count || 0;

        console.log(
          `[stripe-webhook] Payment failed for customer ${customerId}, attempt ${attemptCount}`
        );

        // Grace period: only cancel after 3 failed attempts
        if (attemptCount >= 3) {
          const { error: updateError } = await supabase
            .from("profiles")
            .update({
              subscription_status: "cancelled",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_customer_id", customerId);

          if (updateError) {
            console.error(
              `[stripe-webhook] Failed to update profile: ${JSON.stringify(updateError)}`
            );
          }
        } else {
          // Mark as past_due but keep access
          const { error: updateError } = await supabase
            .from("profiles")
            .update({
              subscription_status: "past_due",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_customer_id", customerId);

          if (updateError) {
            console.error(
              `[stripe-webhook] Failed to update profile: ${JSON.stringify(updateError)}`
            );
          }
        }
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }

    // Always return 200 to acknowledge receipt
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[stripe-webhook] Unhandled error: ${message}`);
    // Return 200 anyway to prevent Stripe retries on parse errors
    return new Response(JSON.stringify({ received: true, error: message }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
