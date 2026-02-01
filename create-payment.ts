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
    const authHeader = req.headers.get('Authorization');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader! } } }
    );
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2023-10-16' });

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { planType, autoRenew, paymentMethodId, priceId, isTrial } = await req.json();
    if (!priceId) throw new Error("Missing Price ID.");

    // --- 1. SECURITY: GLOBAL FINGERPRINT CHECK ---
    let cardFingerprint: string | null = null;
    if (paymentMethodId) {
        try {
            const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
            cardFingerprint = pm.card?.fingerprint || null;
        } catch (e) {}
    }

    if (isTrial && cardFingerprint) {
        const { data: duplicates } = await supabaseAdmin.from('subscriptions')
            .select('id').eq('card_fingerprint', cardFingerprint).neq('user_id', user.id).limit(1);
        if (duplicates && duplicates.length > 0) throw new Error("This card has already been used for a trial.");
    }

    // --- 2. CUSTOMER SETUP ---
    let stripeCustomerId;
    const { data: dbSub } = await supabaseAdmin.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle();
    if (dbSub?.stripe_customer_id) { stripeCustomerId = dbSub.stripe_customer_id; } else {
        const c = await stripe.customers.create({ email: user.email, metadata: { supabase_user_id: user.id } });
        stripeCustomerId = c.id;
    }
    if (paymentMethodId) {
        try { await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId });
              await stripe.customers.update(stripeCustomerId, { invoice_settings: { default_payment_method: paymentMethodId } });
        } catch (e: any) { if (!e.message.includes('attached')) throw e; }
    }

    // --- 3. LOGIC: CREATE OR UPDATE ---
    let subscription;
    let activeStripeSubId = dbSub?.stripe_subscription_id;
    if (activeStripeSubId) {
        try { const s = await stripe.subscriptions.retrieve(activeStripeSubId); if (s.status === 'canceled') activeStripeSubId = null; } catch { activeStripeSubId = null; }
    }

    // ✅ DETERMINE FINAL PLAN TYPE NOW
    const finalPlanType = isTrial ? 'trial' : planType;

    if (activeStripeSubId) {
        // === UPGRADE/CHANGE PATH ===
        console.log(`🔄 Updating Subscription: ${activeStripeSubId}`);
        const currentSub = await stripe.subscriptions.retrieve(activeStripeSubId);
        const isSwitchingFromRealTrial = (dbSub.plan_type === 'trial');

        const updateParams: any = {
            items: [{ id: currentSub.items.data[0].id, price: priceId }],
            cancel_at_period_end: !autoRenew,
            metadata: { plan_type: finalPlanType, is_trial: String(!!isTrial) }
        };

        if (isSwitchingFromRealTrial && !isTrial) {
            // Case: Real Trial -> Paid Plan. Charge immediately.
            updateParams.trial_end = 'now';
            updateParams.proration_behavior = 'create_prorations';
        } else {
            // Case: Paid -> Paid. Defer billing to end of period.
            updateParams.trial_end = currentSub.current_period_end;
            updateParams.proration_behavior = 'none';
        }
        subscription = await stripe.subscriptions.update(activeStripeSubId, updateParams);
    } else {
        // === NEW SUBSCRIPTION PATH ===
        console.log(`✨ Creating New Subscription (Trial: ${isTrial})`);
        subscription = await stripe.subscriptions.create({
            customer: stripeCustomerId,
            items: [{ price: priceId }],
            default_payment_method: paymentMethodId,
            trial_period_days: isTrial ? 30 : undefined,
            cancel_at_period_end: !isTrial && !autoRenew,
            metadata: { user_id: user.id, plan_type: finalPlanType, is_trial: String(!!isTrial) }
        });
    }

    // --- 4. DB WRITE (CRITICAL FIX) ---
    const subData: any = {
        user_id: user.id,
        plan_type: finalPlanType, // ✅ STRICTLY ENFORCED
        status: subscription.status,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: stripeCustomerId,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString()
    };
    if (cardFingerprint) subData.card_fingerprint = cardFingerprint; // Always save fingerprint

    if (dbSub) { await supabaseAdmin.from('subscriptions').update(subData).eq('id', dbSub.id); }
    else { await supabaseAdmin.from('subscriptions').insert(subData); }

    return new Response(JSON.stringify({
      clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
      subscriptionId: subscription.id
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error: any) {
    console.error('Payment Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
});