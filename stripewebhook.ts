import Stripe from "npm:stripe@18.4.0";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, stripe-signature"
};
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16'
    });
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const signature = req.headers.get('stripe-signature');
    const body = await req.text();
    if (!signature) {
      console.error('No Stripe signature found');
      return new Response('No signature', {
        status: 400
      });
    }
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('No webhook secret configured');
      return new Response('Webhook secret not configured', {
        status: 500
      });
    }
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    console.log(`Processing webhook event: ${event.type} at ${new Date().toISOString()}`);
    console.log(`Event ID: ${event.id}, Created: ${new Date(event.created * 1000).toISOString()}`);
    let processingResult = {
      success: false,
      action: 'unknown'
    };
    switch(event.type){
      case 'checkout.session.completed':
        {
          processingResult = await handleCheckoutCompleted(event, stripe, supabase);
          break;
        }
      case 'payment_intent.succeeded':
        {
          processingResult = await handlePaymentSucceeded(event, stripe, supabase);
          break;
        }
      case 'invoice.payment_succeeded':
      case 'invoice.finalized':
      case 'invoice.created':
        {
          processingResult = await handleInvoiceEvent(event, stripe, supabase);
          break;
        }
      case 'invoice.payment_failed':
        {
          processingResult = await handleInvoicePaymentFailed(event, stripe, supabase);
          break;
        }
      case 'customer.subscription.updated':
        {
          processingResult = await handleSubscriptionUpdated(event, stripe, supabase);
          break;
        }
      case 'customer.subscription.deleted':
        {
          processingResult = await handleSubscriptionDeleted(event, stripe, supabase);
          break;
        }
      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
        processingResult = {
          success: true,
          action: 'ignored'
        };
    }
    console.log(`Webhook processing completed:`, {
      eventType: event.type,
      success: processingResult.success,
      action: processingResult.action,
      userId: processingResult.userId,
      planType: processingResult.planType,
      billingPeriodAccurate: processingResult.billingPeriodAccurate,
      actualDuration: processingResult.actualDuration,
      error: processingResult.error
    });
    return new Response(JSON.stringify({
      received: true,
      processed: processingResult.success,
      action: processingResult.action,
      event_type: event.type,
      user_id: processingResult.userId,
      plan_type: processingResult.planType,
      billing_period_accurate: processingResult.billingPeriodAccurate,
      actual_duration_days: processingResult.actualDuration,
      timestamp: new Date().toISOString(),
      error: processingResult.error
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: processingResult.success ? 200 : 400
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      event_type: 'unknown',
      timestamp: new Date().toISOString()
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
// in stripe-webhook.ts

async function persistInvoiceToDatabase(invoice, stripe, supabase) {
  try {
    console.log(`Persisting invoice ${invoice.id} to database`);
    
    const stripeCustomerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    let userId = null;
    let subscriptionId = null;
    let restaurantName = 'Restaurant';

    if (stripeCustomerId) {
      // 1. Look up user and subscription ID
      const { data: subs, error: subsErr } = await supabase
        .from('subscriptions')
        .select('id, user_id, restaurant_id')
        .eq('stripe_customer_id', stripeCustomerId)
        .limit(1)
        .maybeSingle();

      if (subsErr) throw new Error(`DB Error: ${subsErr.message}`);
      
      if (subs) {
        userId = subs.user_id || null;
        subscriptionId = subs.id || null;
        
        // 2. Fetch restaurant name
        if (userId) {
          const { data: profileData } = await supabase
            .from('restaurants')
            .select('name')
            .eq('owner_id', userId)
            .limit(1)
            .maybeSingle();
            
          if (profileData?.name) restaurantName = profileData.name;
        }
      }
    }

    if (!userId) {
      const errorMsg = `CRITICAL: Could not find user_id for Customer: ${stripeCustomerId}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // --- FIX 1: AMOUNT HANDLING ---
    // Store amounts in CENTS (Integers). Do NOT divide by 100 here.
    const total = invoice.total ?? invoice.amount_paid ?? invoice.amount_due ?? 0;
    const subtotal = invoice.subtotal ?? total;
    const tax = invoice.tax ?? 0;
    const discount = invoice.discount?.amount ?? 
                     invoice.total_discount_amounts?.reduce((sum, d) => sum + d.amount, 0) ?? 0;

    // --- FIX 2: DATE HANDLING ---
    // Prioritize the Line Item period (Service Period) over the Invoice Period (Billing Moment)
    const lineItem = invoice.lines?.data?.[0];
    
    // Logic: If line item has a period, use it. Otherwise fallback to invoice period.
    // Stripe timestamps are in Seconds, Date expects Milliseconds (* 1000)
    const periodStartRaw = lineItem?.period?.start || invoice.period_start;
    const periodEndRaw = lineItem?.period?.end || invoice.period_end;

    const periodStartIso = periodStartRaw ? new Date(periodStartRaw * 1000).toISOString() : null;
    const periodEndIso = periodEndRaw ? new Date(periodEndRaw * 1000).toISOString() : null;

    const invoiceRow = {
      stripe_invoice_id: invoice.id,
      user_id: userId,
      subscription_id: subscriptionId,
      
      // Store as Cents (Integer)
      total: total, 
      subtotal: subtotal,
      tax: tax,
      discount: discount,
      
      currency: invoice.currency || 'usd',
      status: invoice.status || 'unknown',
      
      invoice_date: invoice.created ? new Date(invoice.created * 1000).toISOString() : null,
      paid_at: invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000).toISOString() : null,
      due_date: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
      
      // Use the corrected logic for service dates
      period_start: periodStartIso,
      period_end: periodEndIso,
      
      invoice_pdf: invoice.invoice_pdf || null,
      hosted_invoice_url: invoice.hosted_invoice_url || null,
      payment_method: invoice.charge ? 'card' : invoice.payment_intent ? 'card' : 'unknown',
      description: invoice.description || `${invoice.lines?.data?.[0]?.description || 'Subscription'}`,
      invoice_number: invoice.number || `INV-${invoice.id.slice(3, 11)}`,
      restaurant_name: restaurantName,
      metadata: invoice.metadata || {},
      raw: invoice,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from('invoices').upsert(invoiceRow, {
      onConflict: 'stripe_invoice_id'
    });

    if (error) throw error;
    console.log(`Invoice ${invoice.id} persisted successfully`);

  } catch (error) {
    console.error('Error persisting invoice:', error);
    throw error;
  }
}
function calculatePeriodFromStripe(subscription, planType) {
  const start = new Date(subscription.current_period_start * 1000);
  const end = new Date(subscription.current_period_end * 1000);
  const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  let isAccurate = true;
  switch(planType){
    case 'monthly':
      isAccurate = durationDays >= 28 && durationDays <= 31;
      break;
    case 'semiannual':
      isAccurate = durationDays >= 180 && durationDays <= 186;
      break;
    case 'annual':
      isAccurate = durationDays >= 360 && durationDays <= 370;
      break;
    case 'trial':
      isAccurate = durationDays >= 28 && durationDays <= 32;
      break;
  }
  console.log(`Stripe subscription period analysis:`, {
    planType,
    start: start.toISOString(),
    end: end.toISOString(),
    durationDays,
    isAccurate,
    source: 'stripe_subscription'
  });
  return {
    start,
    end,
    source: 'stripe_subscription',
    durationDays,
    isAccurate
  };
}
function calculatePeriodForPayment(planType) {
  const start = new Date();
  let end = new Date(start);
  let expectedDays;
  switch(planType){
    case 'monthly':
      end.setMonth(end.getMonth() + 1);
      expectedDays = 30;
      break;
    case 'semiannual':
      end.setMonth(end.getMonth() + 6);
      expectedDays = 183;
      break;
    case 'annual':
      end.setFullYear(end.getFullYear() + 1);
      expectedDays = 365;
      break;
    case 'trial':
      end.setDate(end.getDate() + 30);
      expectedDays = 30;
      break;
    default:
      throw new Error(`Invalid plan type: ${planType}`);
  }
  const actualDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  console.log(`Calculated payment period:`, {
    planType,
    start: start.toISOString(),
    end: end.toISOString(),
    expectedDays,
    actualDays,
    source: 'calculated'
  });
  return {
    start,
    end,
    source: 'calculated',
    durationDays: actualDays,
    isAccurate: true
  };
}
async function handleCheckoutCompleted(event, stripe, supabase) {
  try {
    const session = event.data.object;
    console.log('Processing checkout completion:', {
      sessionId: session.id,
      userId: session.metadata?.user_id,
      planType: session.metadata?.plan_type,
      customerId: session.customer,
      subscriptionId: session.subscription,
      mode: session.mode,
      paymentStatus: session.payment_status,
      amountTotal: session.amount_total
    });
    if (!session.metadata?.user_id || !session.metadata?.plan_type) {
      throw new Error('Missing required metadata in checkout session');
    }
    const userId = session.metadata.user_id;
    const planType = session.metadata.plan_type;
    let periodCalculation;
    if (session.mode === 'subscription' && session.subscription) {
      console.log('Retrieving subscription details from Stripe...');
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      periodCalculation = calculatePeriodFromStripe(subscription, planType);
      console.log('Using Stripe subscription periods for checkout completion');
    } else {
      console.log('Calculating periods for one-time payment...');
      periodCalculation = calculatePeriodForPayment(planType);
      console.log('Using calculated periods for one-time payment');
    }
    console.log('Updating subscription in database...');
    const { data: result, error } = await supabase.rpc('handle_subscription_webhook', {
      p_user_id: userId,
      p_plan_type: planType,
      p_status: 'active',
      p_stripe_subscription_id: session.subscription || null,
      p_stripe_customer_id: session.customer,
      p_period_start: periodCalculation.start.toISOString(),
      p_period_end: periodCalculation.end.toISOString()
    });
    if (error) {
      console.error('Database error in checkout completion:', error);
      throw error;
    }
    console.log('Checkout completion processed successfully:', {
      result,
      periodSource: periodCalculation.source,
      durationDays: periodCalculation.durationDays,
      isAccurate: periodCalculation.isAccurate
    });
    return {
      success: true,
      action: 'checkout_completed',
      userId,
      planType,
      billingPeriodAccurate: periodCalculation.isAccurate,
      actualDuration: periodCalculation.durationDays
    };
  } catch (error) {
    console.error('Error handling checkout completion:', error);
    return {
      success: false,
      action: 'checkout_completed',
      error: error.message
    };
  }
}
async function handlePaymentSucceeded(event, stripe, supabase) {
  try {
    const paymentIntent = event.data.object;
    console.log('Processing payment success:', {
      paymentIntentId: paymentIntent.id,
      userId: paymentIntent.metadata?.user_id,
      planType: paymentIntent.metadata?.plan_type,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      customerId: paymentIntent.customer,
      status: paymentIntent.status
    });
    if (!paymentIntent.metadata?.user_id || !paymentIntent.metadata?.plan_type) {
      console.warn('Payment intent missing metadata, skipping subscription update');
      return {
        success: true,
        action: 'payment_succeeded_no_metadata'
      };
    }
    const userId = paymentIntent.metadata.user_id;
    const planType = paymentIntent.metadata.plan_type;
    console.log('Calculating billing periods for one-time payment...');
    const periodCalculation = calculatePeriodForPayment(planType);
    console.log('Updating subscription in database...');
    const { data: result, error } = await supabase.rpc('handle_subscription_webhook', {
      p_user_id: userId,
      p_plan_type: planType,
      p_status: 'active',
      p_stripe_subscription_id: null,
      p_stripe_customer_id: paymentIntent.customer,
      p_period_start: periodCalculation.start.toISOString(),
      p_period_end: periodCalculation.end.toISOString()
    });
    if (error) {
      console.error('Database error in payment success:', error);
      throw error;
    }
    console.log('Payment success processed successfully:', {
      result,
      periodSource: periodCalculation.source,
      durationDays: periodCalculation.durationDays,
      isAccurate: periodCalculation.isAccurate
    });
    return {
      success: true,
      action: 'payment_succeeded',
      userId,
      planType,
      billingPeriodAccurate: periodCalculation.isAccurate,
      actualDuration: periodCalculation.durationDays
    };
  } catch (error) {
    console.error('Error handling payment success:', error);
    return {
      success: false,
      action: 'payment_succeeded',
      error: error.message
    };
  }
}
async function handleInvoiceEvent(event, stripe, supabase) {
  try {
    const invoice = event.data.object;
    console.log('Processing invoice event:', {
      eventType: event.type,
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      customerId: invoice.customer,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      billingReason: invoice.billing_reason,
      status: invoice.status
    });
    await persistInvoiceToDatabase(invoice, stripe, supabase);
    if (!invoice.subscription) {
      console.log('Invoice not associated with subscription, skipping subscription update');
      return {
        success: true,
        action: 'invoice_persisted_no_subscription'
      };
    }
    console.log('Retrieving subscription details from Stripe...');
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    console.log('Retrieved subscription for invoice:', {
      subscriptionId: subscription.id,
      userId: subscription.metadata?.user_id,
      planType: subscription.metadata?.plan_type,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });
    if (!subscription.metadata?.user_id) {
      console.warn('Subscription missing user metadata');
      return {
        success: true,
        action: 'invoice_persisted_no_user_metadata'
      };
    }
    const userId = subscription.metadata.user_id;
    const planType = subscription.metadata.plan_type || 'monthly';
    const periodCalculation = calculatePeriodFromStripe(subscription, planType);
    if (invoice.period_start && invoice.period_end) {
      const invoiceStart = new Date(invoice.period_start * 1000);
      const invoiceEnd = new Date(invoice.period_end * 1000);
      const invoiceDuration = Math.ceil((invoiceEnd.getTime() - invoiceStart.getTime()) / (1000 * 60 * 60 * 24));
      console.log('Cross-referencing with invoice periods:', {
        invoiceStart: invoiceStart.toISOString(),
        invoiceEnd: invoiceEnd.toISOString(),
        invoiceDuration,
        subscriptionDuration: periodCalculation.durationDays,
        periodsMatch: Math.abs(invoiceDuration - periodCalculation.durationDays) <= 1
      });
    }
    console.log('Updating subscription in database...');
    const { data: result, error } = await supabase.rpc('handle_subscription_webhook', {
      p_user_id: userId,
      p_plan_type: planType,
      p_status: invoice.status === 'paid' ? 'active' : invoice.status === 'open' ? 'past_due' : subscription.status,
      p_stripe_subscription_id: subscription.id,
      p_stripe_customer_id: subscription.customer,
      p_period_start: periodCalculation.start.toISOString(),
      p_period_end: periodCalculation.end.toISOString()
    });
    if (error) {
      console.error('Database error in invoice processing:', error);
      throw error;
    }
    console.log('Invoice processed successfully:', {
      result,
      periodSource: periodCalculation.source,
      durationDays: periodCalculation.durationDays,
      isAccurate: periodCalculation.isAccurate
    });
    return {
      success: true,
      action: 'invoice_processed',
      userId,
      planType,
      billingPeriodAccurate: periodCalculation.isAccurate,
      actualDuration: periodCalculation.durationDays
    };
  } catch (error) {
    console.error('Error handling invoice event:', error);
    return {
      success: false,
      action: 'invoice_processing_failed',
      error: error.message
    };
  }
}
async function handleInvoicePaymentFailed(event, stripe, supabase) {
  try {
    const invoice = event.data.object;
    console.log('Processing invoice payment failure:', {
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      customerId: invoice.customer,
      amountDue: invoice.amount_due,
      attemptCount: invoice.attempt_count,
      nextPaymentAttempt: invoice.next_payment_attempt
    });
    await persistInvoiceToDatabase(invoice, stripe, supabase);
    if (!invoice.subscription) {
      console.log('Invoice payment failure not associated with subscription, skipping');
      return {
        success: true,
        action: 'invoice_payment_failed_no_subscription'
      };
    }
    console.log('Retrieving subscription details for failed payment...');
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    if (!subscription.metadata?.user_id) {
      console.warn('Subscription missing user metadata for failed payment');
      return {
        success: true,
        action: 'invoice_payment_failed_no_user_metadata'
      };
    }
    const userId = subscription.metadata.user_id;
    const planType = subscription.metadata.plan_type || 'monthly';
    const periodCalculation = calculatePeriodFromStripe(subscription, planType);
    console.log('Updating subscription status to past_due...');
    const { data: result, error } = await supabase.rpc('handle_subscription_webhook', {
      p_user_id: userId,
      p_plan_type: planType,
      p_status: 'past_due',
      p_stripe_subscription_id: subscription.id,
      p_stripe_customer_id: subscription.customer,
      p_period_start: periodCalculation.start.toISOString(),
      p_period_end: periodCalculation.end.toISOString()
    });
    if (error) {
      console.error('Error updating subscription to past_due:', error);
      throw error;
    }
    console.log('Subscription marked as past_due for failed payment:', {
      result,
      periodSource: periodCalculation.source,
      durationDays: periodCalculation.durationDays
    });
    return {
      success: true,
      action: 'invoice_payment_failed',
      userId,
      planType,
      billingPeriodAccurate: periodCalculation.isAccurate,
      actualDuration: periodCalculation.durationDays
    };
  } catch (error) {
    console.error('Error handling invoice payment failure:', error);
    return {
      success: false,
      action: 'invoice_payment_failed',
      error: error.message
    };
  }
}
async function handleSubscriptionUpdated(event, stripe, supabase) {
  try {
    const subscription = event.data.object;
    console.log('Processing subscription update:', {
      subscriptionId: subscription.id,
      userId: subscription.metadata?.user_id,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at,
      trialStart: subscription.trial_start,
      trialEnd: subscription.trial_end
    });
    if (!subscription.metadata?.user_id) {
      console.warn('Subscription update missing user metadata');
      return {
        success: true,
        action: 'subscription_updated_no_user_metadata'
      };
    }
    const userId = subscription.metadata.user_id;
    const planType = subscription.metadata.plan_type || 'monthly';
    let status;
    switch(subscription.status){
      case 'active':
      case 'trialing':
        // Status is active, or a paid subscription is running its initial trial period.
        status = 'active';
        console.log('Subscription is active');
        break;
      case 'past_due':
        status = 'past_due';
        console.log('Subscription is past due');
        break;
      case 'canceled':
      case 'cancelled':
        status = 'canceled';
        console.log('Subscription is canceled');
        break;
      case 'unpaid':
      case 'incomplete':
      case 'incomplete_expired':
        status = subscription.status;
        console.log(`Subscription is ${status}`);
        break;
      // Removed redundant case 'trialing', it's handled above.
      default:
        // For unknown statuses, default to 'active' only if the subscription is still current.
        // The safest path is often to rely on specific status events.
        status = 'active';
        console.log(`Unknown subscription status: ${subscription.status}, defaulting to active`);
    }
    const periodCalculation = calculatePeriodFromStripe(subscription, planType);
    console.log('Updating subscription in database...');
    const { data: result, error } = await supabase.rpc('handle_subscription_webhook', {
      p_user_id: userId,
      p_plan_type: planType,
      p_status: status,
      p_stripe_subscription_id: subscription.id,
      p_stripe_customer_id: subscription.customer,
      p_period_start: periodCalculation.start.toISOString(),
      p_period_end: periodCalculation.end.toISOString()
    });
    if (error) {
      console.error('Database error in subscription update:', error);
      throw error;
    }
    console.log('Subscription update processed successfully:', {
      result,
      statusChange: status,
      periodSource: periodCalculation.source,
      durationDays: periodCalculation.durationDays,
      isAccurate: periodCalculation.isAccurate
    });
    return {
      success: true,
      action: 'subscription_updated',
      userId,
      planType,
      billingPeriodAccurate: periodCalculation.isAccurate,
      actualDuration: periodCalculation.durationDays
    };
  } catch (error) {
    console.error('Error handling subscription update:', error);
    return {
      success: false,
      action: 'subscription_updated',
      error: error.message
    };
  }
}
async function handleSubscriptionDeleted(event, stripe, supabase) {
  try {
    const subscription = event.data.object;
    console.log('Processing subscription deletion:', {
      subscriptionId: subscription.id,
      userId: subscription.metadata?.user_id,
      customerId: subscription.customer,
      canceledAt: subscription.canceled_at,
      endedAt: subscription.ended_at,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end
    });
    if (!subscription.metadata?.user_id) {
      console.warn('Subscription deletion missing user metadata');
      return {
        success: true,
        action: 'subscription_deleted_no_user_metadata'
      };
    }
    const userId = subscription.metadata.user_id;
    const planType = subscription.metadata.plan_type || 'monthly';
    const periodCalculation = calculatePeriodFromStripe(subscription, planType);
    console.log('Updating subscription status to canceled...');
    const { data: result, error } = await supabase.rpc('handle_subscription_webhook', {
      p_user_id: userId,
      p_plan_type: planType,
      p_status: 'canceled',
      p_stripe_subscription_id: subscription.id,
      p_stripe_customer_id: subscription.customer,
      p_period_start: periodCalculation.start.toISOString(),
      p_period_end: periodCalculation.end.toISOString()
    });
    if (error) {
      console.error('Error cancelling subscription:', error);
      throw error;
    }
    console.log('Subscription cancellation processed successfully:', {
      result,
      periodSource: periodCalculation.source,
      durationDays: periodCalculation.durationDays,
      finalPeriodAccurate: periodCalculation.isAccurate
    });
    return {
      success: true,
      action: 'subscription_deleted',
      userId,
      planType,
      billingPeriodAccurate: periodCalculation.isAccurate,
      actualDuration: periodCalculation.durationDays
    };
  } catch (error) {
    console.error('Error handling subscription deletion:', error);
    return {
      success: false,
      action: 'subscription_deleted',
      error: error.message
    };
  }
}
