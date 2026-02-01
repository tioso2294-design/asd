import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { SubscriptionService } from '../services/subscriptionService';
import { StarterPackService, StarterPackOrder, DeliveryAddress } from '../services/starterPackService';
import SmartAddressSelector from '../components/SmartAddressSelector';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrency } from '../contexts/CurrencyContext'; 

import {
  Package, Tablet, CheckCircle2, Clock, AlertCircle,
  MapPin, ChevronRight, X, CreditCard,
  Loader2, ArrowRight, ShieldCheck, Zap, Calendar,
  Gift, ZoomIn
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#1F2937',
      fontFamily: 'sans-serif',
      '::placeholder': { color: '#9CA3AF' },
      iconColor: '#E85A9B',
    },
    invalid: { color: '#EF4444' },
  },
};

// --- ASSETS ---

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

const TabletGraphic = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
    <rect x="25" y="15" width="50" height="70" rx="6" stroke="url(#brandGradient)" strokeWidth="2" fill="white" />
    <rect x="30" y="20" width="40" height="50" rx="2" fill="#F9FAFB" />
    <circle cx="50" cy="78" r="3" fill="#E85A9B" fillOpacity="0.5" />
  </svg>
);

// --- COMPONENTS ---

const GradientFillButton = ({ children, onClick, disabled, isLoading, className = "" }: any) => (
  <button
    onClick={onClick}
    disabled={disabled || isLoading}
    className={`relative w-full py-4 rounded-2xl font-bold text-white shadow-lg shadow-pink-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group ${className}`}
  >
    <div className="absolute inset-0 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] transition-transform duration-500 group-hover:scale-105" />
    <span className="relative flex items-center justify-center gap-2">
      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : children}
    </span>
  </button>
);

export default function StarterPackPage() {
  return (
    <Elements stripe={stripePromise}>
      <StarterPackContent />
    </Elements>
  );
}

function StarterPackContent() {
  const { user, restaurant } = useAuth();
  const { formatPrice } = useCurrency();
  
  const operatingCurrency = restaurant?.currency || 'USD';

  const stripe = useStripe();
  const elements = useElements();

  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [orders, setOrders] = useState<StarterPackOrder[]>([]);
  const [dismissedOrders, setDismissedOrders] = useState<string[]>([]);
  
  const [includesTablet, setIncludesTablet] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [pendingAddress, setPendingAddress] = useState<DeliveryAddress | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [totalCost, setTotalCost] = useState(0);
  const [basePackCost, setBasePackCost] = useState(0);

  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<StarterPackOrder | null>(null);

  const tabletDisplayPrice = StarterPackService.getTabletCost(operatingCurrency);

  useEffect(() => {
    if (user) {
      const init = async () => {
        await Promise.all([checkAccess(), loadOrders()]);
        setLoading(false);
      };
      init();
      const interval = setInterval(loadOrders, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (user) calculateCost();
  }, [includesTablet, hasAccess, user, operatingCurrency]);

  const checkAccess = async () => {
    try {
      const accessData = await SubscriptionService.checkSubscriptionAccess(user!.id);
      
      // ✅ STRICT TRIAL BLOCK
      // We check both plan_type AND status to be safe.
      // Trials have dashboard access but should not have Starter Pack access.
      const isTrial = 
          accessData.subscription?.plan_type === 'trial' || 
          accessData.subscription?.status === 'trialing';
      
      if (isTrial) {
        setHasAccess(false); 
      } else {
        setHasAccess(accessData.hasAccess);
      }
    } catch (err) { 
      console.error(err);
      setHasAccess(false); 
    }
  };

  const loadOrders = async () => {
    try {
      const data = await StarterPackService.getUserOrders(user!.id);
      setOrders(data);
    } catch (err) { console.error(err); }
  };

  const calculateCost = async () => {
    try {
      const cost = await StarterPackService.calculateTotalCost(user!.id, includesTablet, operatingCurrency);
      setTotalCost(cost);
      
      const first = await StarterPackService.isFirstOrder(user!.id);
      const hasPaid = await StarterPackService.hasActivePaidSubscription(user!.id);
      
      const baseCost = StarterPackService.calculateTotalCostSync(first, hasPaid, false, operatingCurrency);
      setBasePackCost(baseCost);
    } catch (err) { console.error(err); }
  };

  const handlePlaceOrder = () => {
    setError(null);
    setShowAddressModal(true);
  };

  const handleAddressSubmit = async (address: DeliveryAddress) => {
    setShowAddressModal(false);
    if (totalCost > 0) {
      setPendingAddress(address);
    } else {
      await processOrder(address);
    }
  };

  const processOrder = async (address: DeliveryAddress) => {
    setIsProcessing(true);
    setError(null);

    try {
      const order = await StarterPackService.createOrder(user!.id, includesTablet, address, operatingCurrency);

      const isFirst = await StarterPackService.isFirstOrder(user!.id);
      const hasPaid = await StarterPackService.hasActivePaidSubscription(user!.id);
      
      const safeAmountInCents = StarterPackService.calculateStripeAmount(
        isFirst, 
        hasPaid,
        includesTablet,
        operatingCurrency
      );

      if (safeAmountInCents > 0) {
        if (!stripe || !elements) throw new Error('Payment system not ready');
        
        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-starterpack-payment`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              amount: safeAmountInCents, 
              currency: operatingCurrency, 
              metadata: { orderId: order.id, orderType: "starter_pack" },
            })
          }
        );

        if (!response.ok) throw new Error('Payment initialization failed');
        const { clientSecret } = await response.json();
        
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) throw new Error('Card element not found');

        const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: { card: cardElement }
        });

        if (stripeError) throw new Error(stripeError.message);
        await StarterPackService.updateOrderPaymentStatus(order.id, paymentIntent!.id, 'completed');
      }

      await loadOrders();
      setIncludesTablet(false);
      setPendingAddress(null);
    } catch (err: any) {
      setError(err.message || 'Order failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const sortedOrders = [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const latestOrder = sortedOrders[0];

  let activeOrder = null;
  if (latestOrder) {
    const isDismissed = dismissedOrders.includes(latestOrder.id);
    if (latestOrder.order_status !== 'delivered') {
      activeOrder = latestOrder;
    } else if (!isDismissed) {
      activeOrder = latestOrder;
    }
  }

  const handleDismissOrder = (orderId: string) => {
    setDismissedOrders(prev => [...prev, orderId]);
  };

  if (loading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-10 h-10 text-[#E85A9B] animate-spin" /></div>;

  // ✅ IF NOT ACCESS (E.g. Trial), SHOW LOCKED STATE
  if (!hasAccess) return <LockedState />;

  if (selectedHistoryOrder) return (
    <HistoryDetailView 
      order={selectedHistoryOrder} 
      onBack={() => setSelectedHistoryOrder(null)} 
      formatPrice={formatPrice}
      currency={operatingCurrency}
    />
  );

  return (
    <div className="space-y-8 animate-fade-in font-sans pb-20 w-full text-gray-900">
      <BrandGradientDefs />
      
      <AnimatePresence>
        {showAddressModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowAddressModal(false)}
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden z-10"
            >
              <SmartAddressSelector 
                currency={operatingCurrency}
                isLoading={isProcessing}
                onCancel={() => setShowAddressModal(false)}
                onSubmit={handleAddressSubmit}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-light text-gray-900 tracking-tight mb-2">Starter Pack</h1>
          <p className="text-gray-500 font-medium text-lg">Everything you need to launch your loyalty program.</p>
        </div>
      </div>

      {/* --- CONTENT SWITCHER --- */}
      
      {/* 1. PAYMENT STATE */}
      {pendingAddress && (
        <div className="max-w-2xl mx-auto bg-white rounded-[2.5rem] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-gray-100 overflow-hidden animate-fade-in-up">
           <div className="p-8 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Complete Payment</h2>
              <button onClick={() => setPendingAddress(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                <X className="w-6 h-6" />
              </button>
           </div>
           
           <div className="p-8 space-y-8">
              <div className="bg-gray-50 rounded-2xl p-6 space-y-3">
                 <div className="flex justify-between items-center text-gray-600">
                    <span>Base Pack</span>
                    <span className="font-bold">{formatPrice(basePackCost, operatingCurrency)}</span>
                 </div>
                 {includesTablet && (
                   <div className="flex justify-between items-center text-gray-600">
                      <span>Android Tablet</span>
                      <span className="font-bold">{formatPrice(tabletDisplayPrice, operatingCurrency)}</span>
                   </div>
                 )}
                 <div className="pt-3 border-t border-gray-200 flex justify-between items-center text-lg font-bold text-gray-900">
                    <span>Total</span>
                    <span>{formatPrice(totalCost, operatingCurrency)}</span>
                 </div>
              </div>

              <div className="space-y-4">
                 <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Card Details</label>
                 <div className="bg-white border-2 border-gray-100 rounded-2xl p-4 focus-within:border-[#E85A9B] transition-colors">
                    <CardElement options={CARD_ELEMENT_OPTIONS} />
                 </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold flex items-center gap-2">
                   <AlertCircle className="w-5 h-5" /> {error}
                </div>
              )}

              <GradientFillButton onClick={() => processOrder(pendingAddress)} isLoading={isProcessing} disabled={!stripe}>
                 Pay {formatPrice(totalCost, operatingCurrency)}
              </GradientFillButton>
           </div>
        </div>
      )}

      {/* 2. ACTIVE ORDER TRACKING (Including Manual Close Phase) */}
      {!pendingAddress && activeOrder && (
        <OrderTrackingView 
          order={activeOrder} 
          onDismiss={() => handleDismissOrder(activeOrder!.id)} 
        />
      )}

      {/* 3. ORDER CREATION (Only if no active/undismissed order) */}
      {!pendingAddress && !activeOrder && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           
           {/* LEFT: The Package Visualization */}
           <div className="lg:col-span-7 space-y-6">
              <div className="relative bg-white rounded-[2.5rem] p-8 shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-gray-100 overflow-hidden min-h-[400px] flex flex-col justify-between group">
                 <div className="relative z-10">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-bold uppercase tracking-wider mb-4">
                       <Zap className="w-3.5 h-3.5" /> Essential
                    </span>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">Restaurant Kit</h2>
                    <p className="text-gray-500 max-w-md font-medium text-lg leading-relaxed">
                       High-quality QR stands, NFC tags, and marketing materials designed to convert diners into loyal members instantly.
                    </p>
                 </div>

                 <div className="relative z-10 mt-8 space-y-3">
                    {[
                      '9x Acrylic Stands (Tables)', 
                      '1x Acrylic Stand (Cashier)', 
                      'Window Decal'
                    ].map(item => (
                       <div key={item} className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#E6A85C] to-[#E85A9B] flex items-center justify-center shadow-sm">
                             <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="font-medium text-gray-700">{item}</span>
                       </div>
                    ))}
                 </div>

                 <div className="hidden lg:block absolute -right-6 -bottom-8 w-72 h-72 xl:w-96 xl:h-96 z-0 transition-transform duration-700 group-hover:scale-105 pointer-events-none">
                     <img 
                       src="/stand1.svg" 
                       alt="Display Stand" 
                       className="w-full h-full object-contain"
                     />
                 </div>
              </div>
           </div>

           {/* RIGHT: Configuration & Checkout */}
           <div className="lg:col-span-5 space-y-6">
              
              <div 
                onClick={() => setIncludesTablet(!includesTablet)}
                className={`relative cursor-pointer rounded-[2.5rem] p-6 border-2 transition-all duration-300 flex items-center gap-5 overflow-hidden group
                  ${includesTablet ? 'bg-white border-[#E85A9B] shadow-[0_10px_40px_rgba(232,90,155,0.1)]' : 'bg-white border-gray-100 hover:border-gray-200'}
                `}
              >
                 <div className="w-16 h-16 shrink-0 relative">
                    <TabletGraphic />
                 </div>
                 <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                       <h3 className="font-bold text-gray-900">Add Tablet?</h3>
                       <span className="text-[#E85A9B] font-bold">+{formatPrice(tabletDisplayPrice, operatingCurrency)}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed font-medium">
                       Dedicated device for staff to scan rewards. <br/> Samsung Tablet A9 with rugged cover.
                    </p>
                 </div>
                 <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${includesTablet ? 'bg-[#E85A9B] border-[#E85A9B]' : 'border-gray-300'}`}>
                    {includesTablet && <CheckCircle2 className="w-4 h-4 text-white" />}
                 </div>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-[0_2px_20px_rgba(0,0,0,0.02)]">
                 <h3 className="text-lg font-bold text-gray-900 mb-6">Order Summary</h3>
                 
                 <div className="space-y-4 mb-8">
                    <div className="flex justify-between items-center text-sm font-medium text-gray-500">
                       <span>Starter Kit</span>
                       <span className="text-gray-900 font-bold">
                          {basePackCost === 0 ? <span className="text-green-600">FREE</span> : formatPrice(basePackCost, operatingCurrency)}
                       </span>
                    </div>
                    {includesTablet && (
                       <div className="flex justify-between items-center text-sm font-medium text-gray-500">
                          <span>Tablet Add-on</span>
                          <span className="text-gray-900 font-bold">{formatPrice(tabletDisplayPrice, operatingCurrency)}</span>
                       </div>
                    )}
                    <div className="h-px bg-gray-100 my-4" />
                    <div className="flex justify-between items-center text-xl font-bold text-gray-900">
                       <span>Total</span>
                       <span>{formatPrice(totalCost, operatingCurrency)}</span>
                    </div>
                 </div>

                 {basePackCost === 0 && (
                    <div className="mb-6 p-4 bg-green-50 rounded-2xl flex items-start gap-3">
                       <ShieldCheck className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                       <p className="text-xs font-bold text-green-700 leading-relaxed">
                          Your first starter pack is complimentary with your subscription.
                       </p>
                    </div>
                 )}

                 <GradientFillButton onClick={handlePlaceOrder} isLoading={isProcessing}>
                    {totalCost === 0 ? 'Claim Free Pack' : `Pay ${formatPrice(totalCost, operatingCurrency)}`} <ArrowRight className="w-5 h-5" />
                 </GradientFillButton>
              </div>
           </div>
        </div>
      )}

      {/* 4. ORDER HISTORY (Compact List View) */}
      {!pendingAddress && !selectedHistoryOrder && orders.some(o => o.order_status === 'delivered') && (
        <div className="pt-8">
           <h2 className="text-2xl font-light text-gray-900 mb-6 px-1">Past Orders</h2>
           
           <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
             <div className="max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                {orders
                  .filter(o => o.order_status === 'delivered')
                  .filter(o => !activeOrder || o.id !== activeOrder.id)
                  .map((order, idx) => (
                    <div 
                      key={order.id} 
                      onClick={() => setSelectedHistoryOrder(order)}
                      className={`
                        group flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50 transition-colors
                        ${idx !== 0 ? 'border-t border-gray-100' : ''}
                      `}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-[#E85A9B] group-hover:text-white transition-colors duration-300">
                            <Package className="w-5 h-5" />
                        </div>
                        <div>
                           <p className="font-bold text-gray-900 text-sm">#{order.id.slice(0, 8)}</p>
                           <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
                              {new Date(order.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              <span>•</span>
                              <span className="text-xs">{order.includes_tablet ? 'Kit + Tablet' : 'Starter Kit'}</span>
                           </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                         <div className="hidden sm:block text-right">
                           <p className="text-xs font-bold text-gray-900">
                             {order.total_cost === 0 ? 'Free' : formatPrice(order.total_cost, operatingCurrency)}
                           </p>
                           <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Delivered</p>
                         </div>
                         <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#E85A9B] transition-colors" />
                      </div>
                    </div>
                ))}
             </div>
           </div>
        </div>
      )}
    </div>
  );
}

// ... (Rest of components: OrderTrackingView, HistoryDetailView kept as is) ...

function OrderTrackingView({ order, onDismiss }: { order: StarterPackOrder, onDismiss: () => void }) {
  const [showImageModal, setShowImageModal] = useState(false);

  // Map stages to CUSTOM ICONS
  const stages = [
    { key: 'received', label: 'Order Placed', svg: '/reciept.svg' },
    { key: 'preparing', label: 'Preparing', svg: '/box.svg' },
    { key: 'out_for_delivery', label: 'On The Way', svg: '/car.svg' },
    { key: 'delivered', label: 'Delivered', svg: '/tick.svg' }
  ];

  // Explicit Status Mapping
  const getExplicitStatusIndex = (status: string) => {
    switch (status) {
      case 'received': return 0;
      case 'preparing':
      case 'configuring':
        return 1;
      case 'out_for_delivery': return 2;
      case 'delivered': return 3;
      default: return 0;
    }
  };

  const currentIdx = getExplicitStatusIndex(order.order_status);
  const activeStage = stages[currentIdx] || stages[0];
  const isDelivered = currentIdx === 3;

  return (
    <div className="bg-white rounded-[2.5rem] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden">
       <div className="flex flex-col md:flex-row h-full min-h-[400px]">
          
          {/* LEFT: Info & Details */}
          <div className="flex-1 p-8 md:p-12 flex flex-col justify-center">
             
             {/* Dynamic Status Text */}
             <div className="mb-8">
               {!isDelivered ? (
                 <div className="inline-flex items-center gap-2 px-3 py-1 bg-black/5 rounded-full text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
                    <Clock className="w-3 h-3" /> 
                    Est. Delivery: {StarterPackService.calculateEstimatedDelivery(order.created_at).toLocaleDateString(undefined, { weekday: 'long' })}
                 </div>
               ) : (
                 <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full text-xs font-bold text-green-600 uppercase tracking-widest mb-4">
                    <CheckCircle2 className="w-3 h-3" /> Arrived
                 </div>
               )}
               
               <h2 className="text-4xl font-light text-gray-900 tracking-tight mb-2">
                 {activeStage.label}
               </h2>
               
               {isDelivered ? (
                 <p className="text-gray-500 font-medium">Your package has been delivered successfully.</p>
               ) : (
                 <p className="text-gray-500 font-medium">Your starter pack is moving through our network.</p>
               )}
             </div>

             {/* Order Details (Visible when Delivered) */}
             {isDelivered && (
               <div className="space-y-6">
                  {/* Items Summary */}
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                     <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Order Items</p>
                     <div className="space-y-2">
                        <div className="flex items-center gap-3">
                           <CheckCircle2 className="w-4 h-4 text-green-500" />
                           <span className="text-sm font-bold text-gray-900">Restaurant Starter Kit</span>
                        </div>
                        {order.includes_tablet && (
                           <div className="flex items-center gap-3">
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                              <span className="text-sm font-bold text-gray-900">Samsung Tablet A9</span>
                           </div>
                        )}
                     </div>
                  </div>

                  {/* Actions Row - Visibile Immediately */}
                  <div className="flex items-center gap-3">
                     {/* 1. View Proof Button */}
                     {order.proof_of_delivery_url && (
                        <button 
                           onClick={() => setShowImageModal(true)}
                           className="px-6 py-3.5 rounded-2xl border-2 border-gray-100 font-bold text-gray-600 hover:border-[#E85A9B] hover:text-[#E85A9B] transition-colors flex items-center gap-2"
                        >
                           <ZoomIn className="w-4 h-4" /> View Proof
                        </button>
                     )}
                     
                     {/* 2. Close & Archive Button (Soft Black) */}
                     <button 
                        onClick={onDismiss}
                        className="px-8 py-3.5 bg-[#2A2A2A] text-white rounded-2xl font-bold hover:bg-black transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                     >
                        Close & Archive
                     </button>
                  </div>
               </div>
             )}

             {/* Address (Only show if NOT delivered) */}
             {!isDelivered && (
               <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl max-w-sm border border-gray-100">
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm text-[#E85A9B]">
                     <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                     <p className="text-sm font-bold text-gray-900">{order.delivery_city}, {order.delivery_emirate}</p>
                     <p className="text-xs text-gray-500 truncate max-w-[200px]">{order.delivery_address_line1}</p>
                  </div>
               </div>
             )}
          </div>

          {/* RIGHT: Segmented Ring Animation */}
          <div className="flex-1 bg-gradient-to-br from-gray-50 to-white border-l border-gray-100 relative flex items-center justify-center p-12 overflow-hidden">
             
             <div className="relative w-80 h-80 flex items-center justify-center">
                {/* Ring SVGs */}
                <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                   {[0, 1, 2, 3].map((i) => {
                      const isFilled = i <= currentIdx;
                      return (
                        <motion.circle
                          key={i}
                          cx="160" cy="160" r="140"
                          fill="none"
                          stroke={isFilled ? "url(#brandGradient)" : "#e5e7eb"}
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeDasharray="200 680" 
                          strokeDashoffset={0}
                          style={{ transformOrigin: "center", rotate: i * 90 }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1, stroke: isFilled ? "url(#brandGradient)" : "#f3f4f6" }}
                          transition={{ duration: 0.5, delay: i * 0.2 }}
                        />
                      );
                   })}
                </svg>

                {/* Center Static Icon */}
                <div className="relative z-10 w-48 h-48 flex items-center justify-center">
                   <div className="w-full h-full relative flex items-center justify-center">
                      <img 
                        src={activeStage.svg} 
                        alt={activeStage.label}
                        className="w-full h-full object-contain drop-shadow-xl"
                      />
                   </div>
                </div>
             </div>
          </div>
       </div>

       {/* POD Modal for Tracking View */}
       <AnimatePresence>
        {showImageModal && order.proof_of_delivery_url && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm"
            onClick={() => setShowImageModal(false)}
          >
             <button className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
                <X className="w-8 h-8" />
             </button>
             <motion.img 
               initial={{ scale: 0.9 }} animate={{ scale: 1 }}
               src={order.proof_of_delivery_url} 
               alt="Proof of Delivery Full" 
               className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain" 
               onClick={(e) => e.stopPropagation()} 
             />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HistoryDetailView({ order, onBack, formatPrice, currency }: { order: StarterPackOrder, onBack: () => void, formatPrice: (v: number, c: string) => string, currency: string }) {
  const isFree = order.total_cost === 0;
  const [showImageModal, setShowImageModal] = useState(false);

  return (
    <>
      <div className="w-full bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden animate-fade-in-up">
         <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-6">
               <button onClick={onBack} className="p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-colors group">
                  <ChevronRight className="w-6 h-6 rotate-180 text-gray-400 group-hover:text-gray-900" />
               </button>
               <div>
                  <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Order Details</h2>
                  <p className="text-gray-500 font-medium mt-1">#{order.id.slice(0, 8)}</p>
               </div>
            </div>
            <span className="px-5 py-2.5 bg-green-50 text-green-700 font-bold rounded-2xl text-sm border border-green-100 flex items-center gap-2">
               <CheckCircle2 className="w-4 h-4" /> Delivered
            </span>
         </div>

         <div className="p-8 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <div className="lg:col-span-2 space-y-8">
                  <div className="bg-gray-50/50 rounded-[2rem] p-8 border border-gray-100">
                     <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-6">Summary</h3>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div>
                           <p className="text-xs font-bold text-gray-400 uppercase mb-1">Date</p>
                           <p className="text-lg font-bold text-gray-900">{new Date(order.created_at).toLocaleDateString()}</p>
                        </div>
                        <div>
                           <p className="text-xs font-bold text-gray-400 uppercase mb-1">Payment</p>
                           {isFree ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-100 text-green-800 text-xs font-bold uppercase tracking-wide">
                                 <Gift className="w-3.5 h-3.5" /> Complimentary
                              </span>
                           ) : (
                              <span className="flex items-center gap-2 font-bold text-gray-900">
                                 <CreditCard className="w-4 h-4 text-gray-400"/> Card
                              </span>
                           )}
                        </div>
                        <div>
                           <p className="text-xs font-bold text-gray-400 uppercase mb-1">Total</p>
                           <p className="text-lg font-bold text-gray-900">{formatPrice(order.total_cost, currency)}</p>
                        </div>
                     </div>
                  </div>

                  <div>
                     <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 px-2">Items</h3>
                     <div className="space-y-3">
                        <div className="flex items-center justify-between p-5 rounded-[1.5rem] border border-gray-100 hover:border-gray-200 transition-colors">
                           <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-[#E6A85C]/10 flex items-center justify-center">
                                 <Package className="w-6 h-6 text-[#E6A85C]" />
                              </div>
                              <span className="font-bold text-gray-900 text-lg">Restaurant Starter Kit</span>
                           </div>
                           <span className="text-sm font-bold text-gray-400">x1</span>
                        </div>
                        {order.includes_tablet && (
                           <div className="flex items-center justify-between p-5 rounded-[1.5rem] border border-gray-100 hover:border-gray-200 transition-colors">
                              <div className="flex items-center gap-4">
                                 <div className="w-12 h-12 rounded-2xl bg-[#E85A9B]/10 flex items-center justify-center">
                                    <Tablet className="w-6 h-6 text-[#E85A9B]" />
                                 </div>
                                 <span className="font-bold text-gray-900 text-lg">Samsung Tablet A9</span>
                              </div>
                              <span className="text-sm font-bold text-gray-400">x1</span>
                           </div>
                        )}
                     </div>
                  </div>
               </div>

               <div className="lg:col-span-1">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 px-2">Proof of Delivery</h3>
                  <div 
                    className={`relative w-full aspect-[3/4] bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden transition-all group ${order.proof_of_delivery_url ? 'cursor-zoom-in hover:border-[#E85A9B] hover:shadow-lg' : ''}`}
                    onClick={() => order.proof_of_delivery_url && setShowImageModal(true)}
                  >
                     {order.proof_of_delivery_url ? (
                        <>
                          <img 
                             src={order.proof_of_delivery_url} 
                             alt="POD" 
                             className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-105" 
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                             <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 flex items-center gap-2">
                                <ZoomIn className="w-4 h-4 text-[#E85A9B]" />
                                <span className="text-xs font-bold text-gray-900">View Full</span>
                             </div>
                          </div>
                        </>
                     ) : (
                        <div className="text-center p-6">
                           <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-4">
                              <CheckCircle2 className="w-8 h-8 text-gray-300" />
                           </div>
                           <p className="text-gray-900 font-bold">Delivered Successfully</p>
                           <p className="text-gray-400 text-sm mt-1">No photo provided</p>
                        </div>
                     )}
                  </div>
               </div>
            </div>
         </div>
      </div>

      <AnimatePresence>
        {showImageModal && order.proof_of_delivery_url && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm"
            onClick={() => setShowImageModal(false)}
          >
             <button className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
                <X className="w-8 h-8" />
             </button>
             <motion.img 
               initial={{ scale: 0.9 }} animate={{ scale: 1 }}
               src={order.proof_of_delivery_url} 
               alt="Proof of Delivery Full" 
               className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain" 
               onClick={(e) => e.stopPropagation()} 
             />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function LockedState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-fade-in">
       <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 shadow-sm">
          <CreditCard className="w-10 h-10 text-gray-300" />
       </div>
       <h2 className="text-3xl font-light text-gray-900 mb-4 tracking-tight">Upgrade Required</h2>
       <p className="text-gray-500 max-w-md mb-8 text-lg font-medium leading-relaxed">
          Starter packs and physical devices are only available for paid subscription plans.
       </p>
       <a href="/upgrade" className="px-8 py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center gap-2">
          Upgrade Now <ArrowRight className="w-4 h-4" />
       </a>
    </div>
  );
}