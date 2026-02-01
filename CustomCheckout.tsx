import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCard, Lock, Shield, AlertCircle, Loader2, Crown, Zap 
} from 'lucide-react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { SubscriptionService } from '../services/subscriptionService';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface Plan {
  planId: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features?: string[];
  popular?: boolean;
  savings?: string;
  priceId?: string;
  currency?: string; 
}

interface CustomCheckoutProps {
  plan: Plan;
  priceId?: string;
  autoRenew: boolean;
  currency?: string;
  onSuccess: () => void;
  onCancel: () => void;
  isTrial?: boolean;
}

const CheckoutForm: React.FC<CustomCheckoutProps> = ({ 
  plan, 
  priceId, 
  autoRenew, 
  onSuccess, 
  onCancel, 
  isTrial 
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  const effectiveAutoRenew = isTrial ? true : autoRenew;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !user) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      // 1. Create payment method via Stripe
      const { error: paymentMethodError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: {
          email: user.email,
        },
      });

      if (paymentMethodError) {
        throw new Error(paymentMethodError.message);
      }

      // 2. Branch Logic: Trial vs Paid
      if (isTrial) {
        // ✅ TRIAL FLOW
        await SubscriptionService.initiateTrialWithCard(priceId!, paymentMethod.id);
        console.log('✅ Trial initiated successfully via Stripe');
      } else {
        // ✅ STANDARD PAID FLOW
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.access_token) {
          throw new Error('Authentication error. Please refresh and try again.');
        }

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            planType: plan.planId,
            priceId: priceId,
            autoRenew: effectiveAutoRenew,
            paymentMethodId: paymentMethod.id,
            isTrial: false
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Payment processing failed');
        }

        const { clientSecret } = await response.json();

        // Confirm payment
        if (clientSecret) {
          const { error: confirmError } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
              card: cardElement,
              billing_details: { email: user.email },
            },
          });
          if (confirmError) throw new Error(confirmError.message);
        }
      }

      // 3. ✅ WAIT FOR DB UPDATE (The Fix)
      // This holds the loading state until the backend confirms the subscription exists
      await SubscriptionService.waitForSubscription(user.id);

      onSuccess();
      
      // Double tap refresh just in case
      window.dispatchEvent(new CustomEvent('subscription-updated'));

    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'Transaction failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-6">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg ${
          isTrial ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-[#E6A85C] to-[#E85A9B]'
        }`}>
          {isTrial ? <Zap className="w-6 h-6 text-white" /> : <CreditCard className="w-6 h-6 text-white" />}
        </div>
        <h3 className="text-xl font-bold text-gray-900">
          {isTrial ? 'Start 30-Day Free Trial' : 'Confirm Payment'}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {isTrial 
            ? `Total due today: ${plan.currency || '$'}0.00` 
            : `You will be charged ${plan.price} now.`}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-gradient-to-r from-[#E6A85C]/10 via-[#E85A9B]/10 to-[#D946EF]/10 rounded-xl p-5 border border-[#E6A85C]/20">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">{plan.name}</h3>
            <p className="text-xs text-gray-600">{plan.description}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">{plan.price}</p>
            <p className="text-xs text-gray-600">{plan.period}</p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Payment Method
        </label>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 focus-within:ring-2 focus-within:ring-[#E6A85C] transition-all">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#374151',
                  fontFamily: 'Inter, sans-serif',
                  '::placeholder': { color: '#9CA3AF' },
                },
                invalid: { color: '#EF4444' },
              },
              hidePostalCode: false,
            }}
          />
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
          <Lock className="w-3 h-3" />
          Secured by Stripe SSL encryption
        </div>
      </div>

      {isTrial ? (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-blue-900">Standard Verification</p>
              <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                A valid card is required to verify your identity. 
                <span className="font-semibold"> You will not be charged today.</span> Your subscription will 
                automatically renew to the {plan.name} plan ({plan.price}/{plan.period}) after 30 days unless cancelled.
              </p>
            </div>
          </div>
        </div>
      ) : (
        autoRenew && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-yellow-900">Auto-Renewal Enabled</p>
                <p className="text-xs text-yellow-700">
                  Your subscription will automatically renew to avoid service interruption.
                </p>
              </div>
            </div>
          </div>
        )
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          className={`flex-[2] py-3 px-4 text-white rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-bold ${
            isTrial 
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600' 
              : 'bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF]'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Verifying...</span>
            </>
          ) : (
            isTrial ? (
              <>
                <Zap className="h-4 w-4 fill-current" />
                Activate Free Trial
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                Pay {plan.price}
              </>
            )
          )}
        </button>
      </div>
    </form>
  );
};

const CustomCheckout: React.FC<CustomCheckoutProps> = (props) => {
  const elementsOptions: StripeElementsOptions = {
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#E6A85C',
        colorBackground: '#ffffff',
        colorText: '#374151',
        colorDanger: '#EF4444',
        fontFamily: 'Inter, sans-serif',
        borderRadius: '12px',
      },
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl relative overflow-hidden"
      >
        <Elements stripe={stripePromise} options={elementsOptions}>
          <CheckoutForm {...props} />
        </Elements>
      </motion.div>
    </div>
  );
};

export default CustomCheckout;