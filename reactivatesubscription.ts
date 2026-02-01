import Stripe from "npm:stripe@18.4.0";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2023-10-16' });
    const { subscriptionId, paymentMethodId, priceId } = await req.json();

    const { data: currentSub } = await supabaseClient.from('subscriptions').select('*').eq('id', subscriptionId).eq('user_id', user.id).single();
    if (!currentSub) throw new Error('Subscription not found');

    let stripeStatus = 'unknown';
    try { const s = await stripe.subscriptions.retrieve(currentSub.stripe_subscription_id); stripeStatus = s.status; } catch { stripeStatus = 'missing'; }

    let newStripeSubscriptionId = currentSub.stripe_subscription_id;

    if (stripeStatus === 'active' || stripeStatus === 'trialing') {
        // ✅ Scenario 1: Just resume auto-renewal. No charge.
        console.log('✅ Resuming auto-renewal...');
        await stripe.subscriptions.update(currentSub.stripe_subscription_id, { cancel_at_period_end: false, default_payment_method: paymentMethodId });
    } else {
        // ✅ Scenario 2: Re-create dead subscription, restoring remaining time.
        console.log('⚠️ Recreating canceled subscription...');
        const now = new Date(); const periodEnd = new Date(currentSub.current_period_end);
        let trialEndTimestamp = (periodEnd > now) ? Math.floor(periodEnd.getTime() / 1000) : undefined;

        const newSub = await stripe.subscriptions.create({
            customer: currentSub.stripe_customer_id, items: [{ price: priceId }], default_payment_method: paymentMethodId,
            trial_end: trialEndTimestamp, metadata: { user_id: user.id, plan_type: currentSub.plan_type }
        });
        newStripeSubscriptionId = newSub.id;
    }

    await supabaseClient.from('subscriptions').update({
        status: 'active', cancel_at_period_end: false, stripe_subscription_id: newStripeSubscriptionId,
        scheduled_payment_method_id: paymentMethodId, updated_at: new Date().toISOString()
    }).eq('id', subscriptionId);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
});