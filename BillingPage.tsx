import React, { useState, useEffect } from 'react';
import { 
  CreditCard, AlertCircle, RefreshCw, 
  Download, Plus, Trash2, Shield, Receipt, 
  X, Loader2, Check, AlertTriangle, Clock, Sparkles
} from 'lucide-react';
import { SubscriptionService } from '../services/subscriptionService';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useCurrency } from '../contexts/CurrencyContext';
import { SUBSCRIPTION_PLANS, CurrencyCode } from '../constants/currencyConfig'; 

// ... (Keep existing imports and config)
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

// ... (Keep PaymentMethod and Invoice interfaces)
interface PaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  is_default: boolean;
}

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  invoice_pdf?: string;
  period_start: number;
  period_end: number;
  db_id?: string;
}

// ... (Keep BrandGradientDefs and GradientOutlineButton components)
const BrandGradientDefs = () => (
  <svg width="0" height="0" className="absolute">
    <defs>
      <linearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#E6A85C" />
        <stop offset="50%" stopColor="#E85A9B" />
        <stop offset="100%" stopColor="#D946EF" />
      </linearGradient>
    </defs>
  </svg>
);

const GradientOutlineButton = ({ 
  children, 
  onClick, 
  isLoading, 
  disabled, 
  type = "button",
  className = "",
  variant = "primary"
}: any) => {
  if (variant === 'danger') {
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled || isLoading}
        className={`relative w-full inline-flex items-center justify-center px-6 py-4 font-bold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed bg-red-50 text-red-600 hover:bg-red-100 rounded-2xl ${className}`}
      >
         {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : children}
      </button>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`group relative w-full inline-flex items-center justify-center px-6 py-4 font-bold transition-transform duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] p-[2px] opacity-100">
        <div className="h-full w-full bg-white rounded-[14px] transition-colors group-hover:bg-gray-50/50" />
      </div>
      <span className="relative flex items-center gap-2 text-gray-700 group-hover:text-gray-900 transition-colors">
        {isLoading ? <Loader2 className="animate-spin w-5 h-5 text-[#E85A9B]" /> : children}
      </span>
    </button>
  );
};

// ... (Keep AddPaymentMethodForm component)
const AddPaymentMethodForm: React.FC<{
  onSuccess: () => void;
  onCancel: () => void;
  customerId: string;
}> = ({ onSuccess, onCancel, customerId }) => {
  // ... (Keep existing form logic)
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError('');

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error('Card element not found');

      const { error: paymentMethodError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (paymentMethodError) throw new Error(paymentMethodError.message);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/attach-payment-method`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentMethodId: paymentMethod.id,
          customerId: customerId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add payment method');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to add payment method');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-2 block">
          Card Details
        </label>
        <div className="bg-gray-50 rounded-2xl p-4 border-2 border-transparent focus-within:bg-white focus-within:border-[#E85A9B]/30 focus-within:ring-4 focus-within:ring-[#E85A9B]/10 transition-all">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#111827',
                  fontFamily: 'Inter, sans-serif',
                  '::placeholder': { color: '#9CA3AF' },
                  iconColor: '#E85A9B',
                },
                invalid: { color: '#EF4444' },
              },
              hidePostalCode: false,
            }}
          />
        </div>
      </div>

      <div className="flex gap-4 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-4 font-bold text-gray-500 hover:bg-gray-50 rounded-2xl transition-colors"
        >
          Cancel
        </button>
        <div className="flex-1">
          <GradientOutlineButton type="submit" isLoading={loading} disabled={!stripe}>
             Save Card
          </GradientOutlineButton>
        </div>
      </div>
    </form>
  );
};

const BillingPage: React.FC = () => {
  // ... (Keep existing state)
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [downloadingInvoice, setDownloadingInvoice] = useState<string | null>(null);
  
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showResubscribeModal, setShowResubscribeModal] = useState(false);
  const [deletePaymentMethodId, setDeletePaymentMethodId] = useState<string | null>(null);
  
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [resubscribeLoading, setResubscribeLoading] = useState(false);

  const { user, session } = useAuth();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();

  // ... (Keep loadBillingData, loadPaymentMethods, handleSubscriptionUpdate)
  const loadBillingData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError('');
      
      const subscriptionData = await SubscriptionService.checkSubscriptionAccess(user.id);
      setSubscription(subscriptionData);

      if (subscriptionData?.subscription?.stripe_customer_id) {
        await loadPaymentMethods(subscriptionData.subscription.stripe_customer_id);
      }

      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!invoicesError) {
        const mappedInvoices = (invoicesData || []).map((invoice: any) => {
          return {
            id: invoice.stripe_invoice_id || invoice.id,
            amount: parseFloat(invoice.total || 0), 
            currency: invoice.currency || 'USD',
            status: invoice.status,
            created: invoice.invoice_date,
            period_start: invoice.period_start || invoice.invoice_date,
            period_end: invoice.period_end || invoice.invoice_date,
            db_id: invoice.id,
            invoice_pdf: invoice.invoice_pdf,
          };
        });
        setInvoices(mappedInvoices);
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentMethods = async (customerId: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-payment-methods`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customerId })
      });

      if (!response.ok) throw new Error('Failed');

      const { paymentMethods: methods } = await response.json();
      
      const uniqueMethods: PaymentMethod[] = [];
      const seenCards = new Set();
      (methods || []).forEach((method: any) => {
        const cardKey = `${method.card?.brand}-${method.card?.last4}-${method.card?.exp_month}-${method.card?.exp_year}`;
        if (!seenCards.has(cardKey)) {
          seenCards.add(cardKey);
          uniqueMethods.push(method);
        }
      });

      setPaymentMethods(uniqueMethods);
    } catch (error) {
      console.error('Error loading payment methods:', error);
      setPaymentMethods([]);
    }
  };

  useEffect(() => {
    if (user) loadBillingData();
  }, [user]);

  useEffect(() => {
    const handleSubscriptionUpdate = () => {
      setTimeout(() => loadBillingData(), 500);
      setTimeout(() => loadBillingData(), 5000);
    };
    window.addEventListener('subscription-updated', handleSubscriptionUpdate);
    return () => window.removeEventListener('subscription-updated', handleSubscriptionUpdate);
  }, []);

  const handleCancelSubscription = async () => {
    if (!subscription?.subscription?.id) return;
    try {
      setActionLoading('cancel');
      await SubscriptionService.cancelSubscription(subscription.subscription.id);
      setTimeout(() => loadBillingData(), 1000);
      setShowCancelModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel subscription');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResubscribe = async () => {
    if (!subscription?.subscription?.id || !selectedPaymentMethod) return;
    try {
      setResubscribeLoading(true);
      const accessToken = session?.access_token;
      
      const planType = subscription.subscription.plan_type as keyof typeof SUBSCRIPTION_PLANS;
      const userCurrency = (user?.user_metadata?.currency || 'USD') as CurrencyCode;
      
      // Fallback: If on trial, reactivate as Monthly
      const targetPlan = planType === 'trial' ? 'monthly' : planType;
      const planConfig = SUBSCRIPTION_PLANS[targetPlan] || SUBSCRIPTION_PLANS.monthly;
      const priceId = planConfig.stripePriceIds[userCurrency] || planConfig.stripePriceIds['USD'];

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reactivate-subscription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: subscription.subscription.id,
          paymentMethodId: selectedPaymentMethod,
          priceId: priceId 
        })
      });

      if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to reactivate');
      }

      await loadBillingData();
      setShowResubscribeModal(false);
      window.dispatchEvent(new CustomEvent('subscription-updated'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResubscribeLoading(false);
    }
  };
  // ... (Keep handleRemovePaymentMethod, handleSetDefaultPaymentMethod, handleDownloadInvoice, formatDate)
  const handleRemovePaymentMethod = async () => {
    if (!deletePaymentMethodId) return;
    try {
      setActionLoading(`remove-${deletePaymentMethodId}`);
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detach-payment-method`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentMethodId: deletePaymentMethodId })
      });

      if (!response.ok) throw new Error('Failed');

      if (subscription?.subscription?.stripe_customer_id) {
        await loadPaymentMethods(subscription.subscription.stripe_customer_id);
      }
      setDeletePaymentMethodId(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetDefaultPaymentMethod = async (paymentMethodId: string) => {
    if (!subscription?.subscription?.stripe_customer_id) return;
    try {
      setActionLoading(`default-${paymentMethodId}`);
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-default-payment-method`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentMethodId,
          customerId: subscription.subscription.stripe_customer_id
        })
      });

      if (!response.ok) throw new Error('Failed');
      await loadPaymentMethods(subscription.subscription.stripe_customer_id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadInvoice = async (invoice: Invoice) => {
    try {
      setDownloadingInvoice(invoice.id);
      const invoiceUUID = invoice.db_id || invoice.id;
      const downloadUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-receipt/${invoiceUUID}`;
      
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}` }
      });

      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Receipt-${invoice.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      setError('Download failed. Please try again.');
    } finally {
      setDownloadingInvoice(null);
    }
  };

  const formatDate = (timestampOrString: number | string) => {
    let date;
    if (typeof timestampOrString === 'number') {
        date = new Date(timestampOrString * 1000); 
    } else {
        date = new Date(timestampOrString); 
    }
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getPlanDisplayName = (planType: string, status: string) => {
    if (planType === 'trial') {
        return status === 'canceled' ? 'Free Trial (Cancelled)' : 'Free Trial (Monthly)';
    }
  };

 

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#E85A9B]" />
      </div>
    );
  }

  const planName = getPlanDisplayName(
    subscription?.subscription?.plan_type, 
    subscription?.subscription?.status
  );
  
  const isCancelled = subscription?.isCancelled;
  const isExpired = subscription?.isExpired;
  const isTrial = subscription?.subscription?.plan_type === 'trial' || subscription?.subscription?.status === 'trialing';
  const status = subscription?.subscription?.status || 'inactive';

  return (
    <>
      <div className="space-y-8 animate-fade-in font-sans pb-20 w-full text-gray-900">
        <BrandGradientDefs />
        
        {/* Header */}
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 border-b border-gray-100 pb-8">
          <div>
            <h1 className="text-4xl font-light text-gray-900 tracking-tight mb-2">Billing & Subscription</h1>
            <p className="text-gray-500 font-medium text-lg">Manage your active plan and payment details.</p>
          </div>
          <button onClick={loadBillingData} className="group flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full text-gray-500 hover:text-[#E85A9B] transition-colors">
            <RefreshCw className="h-4 w-4 transition-transform group-hover:rotate-180" />
            <span className="text-sm font-bold">Refresh</span>
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-700 animate-fade-in">
            <AlertCircle className="h-5 w-5" />
            <p className="font-medium">{error}</p>
            <button onClick={() => setError('')} className="ml-auto p-1 hover:bg-red-100 rounded-full"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* --- MAIN CONTENT GRID --- */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Current Plan & Payment */}
          <div className="xl:col-span-8 space-y-8">
            
            {/* 1. STATUS CARD */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-gray-100">
               <div className="flex justify-between items-start mb-8">
                 <div>
                   <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Current Plan</p>
                   <h2 className="text-3xl font-light text-gray-900 tracking-tight">{planName}</h2>
                 </div>
                 <div className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize flex items-center gap-1.5 ${
                    status === 'active' || isTrial ? 'bg-emerald-50 text-emerald-700' : 
                    status === 'past_due' ? 'bg-amber-50 text-amber-700' : 
                    'bg-gray-50 text-gray-600'
                 }`}>
                   <span className={`w-2 h-2 rounded-full ${status === 'active' || isTrial ? 'bg-emerald-500' : status === 'past_due' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                   {isTrial ? 'Trial Active' : status.replace('_', ' ')}
                 </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <div className="bg-gray-50 rounded-2xl p-5 border border-transparent hover:border-gray-200 transition-colors">
                     <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Billing Period</p>
                     <p className="text-gray-900 font-bold">
                        {isTrial ? '30 Days Access' : (subscription?.subscription?.billing_period_text || 'Standard')}
                     </p>
                  </div>
                  
                  <div className="bg-gray-50 rounded-2xl p-5 border border-transparent hover:border-gray-200 transition-colors">
                     <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">
                        {isCancelled ? 'Access Ends' : isTrial ? 'Trial Expires' : 'Next Renewal'}
                     </p>
                     <div className="flex items-center gap-2">
                        <Clock className={`w-4 h-4 ${isCancelled || isTrial ? 'text-amber-500' : 'text-gray-400'}`} />
                        <p className={`font-bold ${isCancelled ? 'text-red-600' : 'text-gray-900'}`}>
                           {subscription?.subscription?.current_period_end 
                              ? new Date(subscription.subscription.current_period_end).toLocaleDateString()
                              : 'N/A'}
                        </p>
                     </div>
                  </div>
               </div>

               <div className="pt-6 border-t border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-end">
                  {isExpired ? (
                     <div className="w-full md:w-auto">
                        <GradientOutlineButton onClick={() => navigate('/upgrade')}>
                           Renew Subscription
                        </GradientOutlineButton>
                     </div>
                  ) : isCancelled ? (
                     <div className="w-full md:w-auto">
                        <GradientOutlineButton onClick={() => setShowResubscribeModal(true)}>
                           Reactivate Plan
                        </GradientOutlineButton>
                     </div>
                  ) : (
                     <button 
                        onClick={() => setShowCancelModal(true)}
                        className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                     >
                        {isTrial ? 'Cancel Trial' : 'Cancel Subscription'}
                     </button>
                  )}

                  {/* ✅ FIXED: Show Change/Upgrade button for ALL active plans, not just Trial */}
                  {!isCancelled && !isExpired && (
                     <div className="w-full md:w-auto">
                        <GradientOutlineButton onClick={() => navigate('/upgrade')}>
                           {isTrial ? 'Upgrade Now' : 'Change Plan'}
                        </GradientOutlineButton>
                     </div>
                  )}
               </div>
            </div>

            {/* 2. INVOICE HISTORY */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-gray-100">
               <div className="mb-6 flex items-center gap-3">
                  <Receipt className="w-5 h-5 text-gray-400" />
                  <h3 className="text-lg font-bold text-gray-900">Billing History</h3>
               </div>

               {invoices.length === 0 ? (
                 <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-2xl">
                   <p className="text-gray-400 font-medium text-sm">No invoices found.</p>
                 </div>
               ) : (
                 <div className="overflow-hidden">
                   <table className="w-full">
                     <thead>
                       <tr className="border-b border-gray-100">
                         <th className="text-left py-4 px-2 text-xs font-bold text-gray-400 uppercase tracking-widest">Date</th>
                         <th className="text-left py-4 px-2 text-xs font-bold text-gray-400 uppercase tracking-widest">Amount</th>
                         <th className="text-left py-4 px-2 text-xs font-bold text-gray-400 uppercase tracking-widest">Status</th>
                         <th className="text-right py-4 px-2 text-xs font-bold text-gray-400 uppercase tracking-widest"></th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                       {invoices.map((invoice) => (
                         <tr key={invoice.id} className="group hover:bg-gray-50/50 transition-colors">
                           <td className="py-4 px-2 font-medium text-gray-900">{formatDate(invoice.created)}</td>
                           <td className="py-4 px-2 font-bold text-gray-900">
                              {formatPrice(invoice.amount / 100, invoice.currency)}
                           </td>
                           <td className="py-4 px-2">
                             <span className={`text-xs font-bold capitalize ${
                               invoice.status === 'paid' ? 'text-emerald-600' : 'text-gray-400'
                             }`}>
                               {invoice.status}
                             </span>
                           </td>
                           <td className="py-4 px-2 text-right">
                             <button
                               onClick={() => handleDownloadInvoice(invoice)}
                               disabled={downloadingInvoice === invoice.id}
                               className="p-2 text-gray-300 hover:text-[#E85A9B] hover:bg-pink-50 rounded-xl transition-all"
                             >
                               {downloadingInvoice === invoice.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>}
                             </button>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               )}
            </div>
          </div>

          {/* RIGHT COLUMN: Payment Methods / Upgrade CTA */}
          <div className="xl:col-span-4 space-y-6">
             {/* Show Upgrade Banner if Trial */}
             {isTrial && (
                <div className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] rounded-[2.5rem] p-8 text-white relative overflow-hidden group cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-xl" onClick={() => navigate('/upgrade')}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#E85A9B] rounded-full blur-[60px] opacity-20 -translate-y-1/2 translate-x-1/2" />
                    <Sparkles className="w-8 h-8 text-[#E6A85C] mb-4" />
                    <h3 className="text-xl font-bold mb-2">Upgrade Your Plan</h3>
                    <p className="text-gray-400 text-sm mb-6">Unlock physical starter packs, advanced analytics, and priority support.</p>
                    <div className="flex items-center gap-2 font-bold text-[#E6A85C] text-sm">
                        View Plans <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                </div>
             )}

             <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-gray-100 h-full">
                <div className="flex items-center justify-between mb-8">
                   <div>
                     <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Payment</p>
                     <h2 className="text-xl font-bold text-gray-900">Methods</h2>
                   </div>
                   <button onClick={() => setShowAddPaymentModal(true)} className="p-3 bg-gray-50 rounded-full text-gray-400 hover:text-[#E85A9B] hover:bg-white hover:shadow-md transition-all">
                     <Plus className="w-5 h-5" />
                   </button>
                </div>

                <div className="space-y-4">
                  {paymentMethods.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm font-medium">No cards added.</div>
                  ) : (
                    paymentMethods.map(method => (
                      <div key={method.id} className="group relative p-4 rounded-2xl border border-gray-100 hover:border-[#E85A9B]/30 hover:shadow-sm transition-all bg-white">
                         <div className="flex items-center gap-3 mb-3">
                            {/* ✅ FIXED: Robust Card Icon */}
                            <div className="w-12 h-8 bg-slate-800 rounded-md flex items-center justify-center text-white font-bold text-[9px] uppercase tracking-wider">
                               {method.card?.brand || 'CARD'}
                            </div>
                            <span className="font-bold text-gray-900">•••• {method.card?.last4}</span>
                         </div>
                         
                         <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 font-medium">Exp: {method.card?.exp_month}/{method.card?.exp_year}</span>
                            <div className="flex items-center gap-2">
                               {method.is_default && <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Default</span>}
                               {!method.is_default && (
                                  <button onClick={() => handleSetDefaultPaymentMethod(method.id)} className="text-[10px] font-bold text-gray-400 hover:text-[#E85A9B] transition-colors">
                                    {actionLoading === `default-${method.id}` ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Set Default'}
                                  </button>
                               )}
                               <button onClick={() => setDeletePaymentMethodId(method.id)} className="text-gray-300 hover:text-red-500 transition-colors pl-2">
                                 <Trash2 className="w-3.5 h-3.5" />
                               </button>
                            </div>
                         </div>
                      </div>
                    ))
                  )}
                </div>
             </div>
          </div>
        </div>
      </div>
      
      {/* ... (All Modals: AddPayment, Cancel, Resubscribe, Delete) - Kept same ... */}
      {showAddPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowAddPaymentModal(false)} />
          <div className="relative bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl animate-fade-in-up">
             <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-gray-900">Add New Card</h3>
                <button onClick={() => setShowAddPaymentModal(false)} className="p-2 hover:bg-gray-50 rounded-full text-gray-400"><X className="w-5 h-5"/></button>
             </div>
             <Elements stripe={stripePromise}>
                <AddPaymentMethodForm 
                  customerId={subscription?.subscription?.stripe_customer_id || ''}
                  onSuccess={() => { setShowAddPaymentModal(false); if (subscription?.subscription?.stripe_customer_id) loadPaymentMethods(subscription.subscription.stripe_customer_id); }}
                  onCancel={() => setShowAddPaymentModal(false)}
                />
             </Elements>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowCancelModal(false)} />
          <div className="relative bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl animate-fade-in-up text-center">
             <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6 mx-auto">
               <AlertTriangle className="w-8 h-8 text-red-500" />
             </div>
             <h3 className="text-2xl font-bold text-gray-900 mb-2">
               {isTrial ? 'Cancel Free Trial?' : 'Cancel Subscription?'}
             </h3>
             <p className="text-gray-500 mb-8 leading-relaxed">
               {isTrial 
                  ? "You will lose access to premium features immediately upon cancellation."
                  : <>You will lose access to premium features when your current period ends on <span className="font-bold text-gray-900">{subscription?.subscription?.current_period_end ? new Date(subscription.subscription.current_period_end).toLocaleDateString() : ''}</span>.</>
               }
             </p>
             <div className="flex flex-col gap-3">
               <GradientOutlineButton onClick={handleCancelSubscription} isLoading={actionLoading === 'cancel'} variant="danger">
                 Confirm Cancellation
               </GradientOutlineButton>
               <button onClick={() => setShowCancelModal(false)} className="py-3 font-bold text-gray-400 hover:text-gray-600 transition-colors">
                 Keep My Plan
               </button>
             </div>
          </div>
        </div>
      )}

      {showResubscribeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowResubscribeModal(false)} />
          <div className="relative bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl animate-fade-in-up">
             <h3 className="text-2xl font-bold text-gray-900 mb-2">Reactivate Plan</h3>
             <p className="text-gray-500 mb-8">Select a card to resume your subscription.</p>
             {paymentMethods.length === 0 ? (
               <div className="text-center py-6 bg-gray-50 rounded-2xl">
                 <p className="text-gray-400 font-bold text-sm mb-4">No payment methods found.</p>
                 <button onClick={() => { setShowResubscribeModal(false); setShowAddPaymentModal(true); }} className="text-[#E85A9B] font-bold hover:underline">
                   Add a Card First
                 </button>
               </div>
             ) : (
               <div className="space-y-4">
                 {paymentMethods.map(method => (
                   <button
                     key={method.id}
                     onClick={() => setSelectedPaymentMethod(method.id)}
                     className={`w-full p-4 rounded-2xl border-2 flex items-center gap-4 transition-all text-left ${
                       selectedPaymentMethod === method.id 
                       ? 'border-[#E85A9B] bg-white ring-4 ring-[#E85A9B]/10' 
                       : 'border-transparent bg-gray-50 hover:bg-gray-100'
                     }`}
                   >
                     <div className="w-12 h-8 bg-slate-800 rounded-md flex items-center justify-center text-white font-bold text-[9px] uppercase tracking-wider">
                        {method.card?.brand || 'CARD'}
                     </div>
                     <span className="font-bold text-gray-700 flex-1">•••• {method.card?.last4}</span>
                     {selectedPaymentMethod === method.id && <Check className="w-5 h-5 text-[#E85A9B]" />}
                   </button>
                 ))}
                 <div className="flex gap-4 mt-8 pt-4 border-t border-gray-100">
                   <button onClick={() => setShowResubscribeModal(false)} className="flex-1 font-bold text-gray-400 hover:text-gray-600">Cancel</button>
                   <div className="flex-[2]">
                     <GradientOutlineButton onClick={handleResubscribe} isLoading={resubscribeLoading} disabled={!selectedPaymentMethod}>
                       Confirm Reactivation
                     </GradientOutlineButton>
                   </div>
                 </div>
               </div>
             )}
          </div>
        </div>
      )}

      {deletePaymentMethodId && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setDeletePaymentMethodId(null)} />
            <div className="relative bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl animate-fade-in-up text-center">
               <h3 className="text-xl font-bold text-gray-900 mb-2">Remove Card?</h3>
               <p className="text-gray-500 mb-8 text-sm">You won't be able to use this card for future billing.</p>
               <div className="flex gap-3">
                 <button onClick={() => setDeletePaymentMethodId(null)} className="flex-1 py-3 font-bold text-gray-500 hover:bg-gray-50 rounded-2xl">Cancel</button>
                 <button onClick={handleRemovePaymentMethod} className="flex-1 py-3 bg-red-50 text-red-600 font-bold rounded-2xl hover:bg-red-100 transition-colors">
                   {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto"/> : 'Remove'}
                 </button>
               </div>
            </div>
         </div>
      )}
    </>
  );
}; 

export default BillingPage;