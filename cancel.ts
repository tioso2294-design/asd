import Stripe from "npm:stripe@18.4.0";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Get User from Auth Header (Security Fix)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
        global: { headers: { Authorization: authHeader } }
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      throw new Error('Unauthorized');
    }

    // 2. Get Subscription ID
    const { subscriptionId } = await req.json();
    if (!subscriptionId) {
      throw new Error("Missing subscriptionId in body");
    }

    // 3. Initialize Admin Client & Stripe
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16'
    });

    console.log(`🗑️ Cancelling subscription: ${subscriptionId} for User: ${user.id}`);

    // 4. Fetch Subscription details securely
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, user_id')
      .eq('id', subscriptionId)
      .maybeSingle();

    if (subError || !subscription) {
      throw new Error('Subscription not found');
    }

    // Security Check: Ensure the user owns this subscription
    if (subscription.user_id !== user.id) {
      throw new Error('Unauthorized access to subscription');
    }

    if (!subscription.stripe_subscription_id) {
      // If it's a legacy trial with no stripe ID, we just cancel it in DB
      console.warn("Legacy subscription with no Stripe ID. Cancelling locally.");
    } else {
      // 5. Cancel in Stripe
      // We use delete() to cancel immediately.
      const deletedSub = await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      console.log(`✅ Stripe Subscription Cancelled: ${deletedSub.id}`);
    }

    // 6. Update Database immediately
    await supabaseAdmin
      .from('subscriptions')
      .update({ 
        status: 'cancelled', 
        updated_at: new Date().toISOString()
      })
      .eq('id', subscriptionId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});