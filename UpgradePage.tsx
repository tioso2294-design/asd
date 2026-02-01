import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Crown, CheckCircle, ArrowRight, ArrowLeft, CreditCard,
  Users, BarChart3, Shield, Zap, Star, Gift, Target,
  Loader2, AlertCircle
} from 'lucide-react';
import { SubscriptionService } from '../services/subscriptionService';
import { useAuth } from '../contexts/AuthContext';
import CustomCheckout from './CustomCheckout';
import { useCurrency } from '../contexts/CurrencyContext';
import { SUBSCRIPTION_PLANS } from '../constants/currencyConfig';

const UpgradePage: React.FC = () => {
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState(SUBSCRIPTION_PLANS.monthly.id);
  const [autoRenew, setAutoRenew] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [error, setError] = useState('');
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currency, formatPrice } = useCurrency(); 

  // --- PLANS CONFIGURATION ---

  // 1. Construct All Potential Plans
  const allPlans = [
    {
      ...SUBSCRIPTION_PLANS.monthly,
      planId: SUBSCRIPTION_PLANS.monthly.id,
      price: formatPrice(SUBSCRIPTION_PLANS.monthly.prices[currency] / 100),
      period: 'per month',
      description: 'Perfect for growing restaurants',
      popular: true,
      savings: undefined, // ✅ FIXED: Changed null to undefined for TS
      priceId: SUBSCRIPTION_PLANS.monthly.stripePriceIds[currency] || SUBSCRIPTION_PLANS.monthly.stripePriceIds['USD']
    },
    {
      ...SUBSCRIPTION_PLANS.semiannual,
      planId: SUBSCRIPTION_PLANS.semiannual.id,
      price: formatPrice(SUBSCRIPTION_PLANS.semiannual.prices[currency] / 100),
      period: 'one-time',
      description: 'Save 44% with 6-month plan',
      popular: false,
      savings: SUBSCRIPTION_PLANS.semiannual.savings,
      priceId: SUBSCRIPTION_PLANS.semiannual.stripePriceIds[currency] || SUBSCRIPTION_PLANS.semiannual.stripePriceIds['USD']
    },
    {
      ...SUBSCRIPTION_PLANS.annual,
      planId: SUBSCRIPTION_PLANS.annual.id,
      price: formatPrice(SUBSCRIPTION_PLANS.annual.prices[currency] / 100),
      period: 'one-time',
      description: 'Best value - Save 67%',
      popular: false,
      savings: SUBSCRIPTION_PLANS.annual.savings,
      priceId: SUBSCRIPTION_PLANS.annual.stripePriceIds[currency] || SUBSCRIPTION_PLANS.annual.stripePriceIds['USD']
    }
  ];

  // 2. Filter Plans Logic
  const plans = allPlans.filter(p => {
    if (!currentSubscription?.subscription) return true;

    const { plan_type, status } = currentSubscription.subscription;

    // ✅ If on Trial, show EVERYTHING (allow them to upgrade/convert to anything)
    if (plan_type === 'trial' || status === 'trialing') {
        return true; 
    }
    
    // If Paid, hide the plan they already have
    return p.planId !== plan_type;
  });

  const currentPlan = plans.find(p => p.planId === selectedPlan) || plans[0];

  useEffect(() => {
    if (user) {
      loadCurrentSubscription();
    }
  }, [user]);

  const loadCurrentSubscription = async () => {
    if (!user) return;

    try {
      const data = await SubscriptionService.checkSubscriptionAccess(user.id);
      setCurrentSubscription(data);
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => {
    setShowCheckout(true);
  };

  const handlePaymentSuccess = async () => {
    setShowCheckout(false);
    await loadCurrentSubscription();
    window.dispatchEvent(new CustomEvent('subscription-updated'));
    navigate('/dashboard', { state: { paymentSuccess: true } });
    
    setTimeout(() => window.dispatchEvent(new CustomEvent('subscription-updated')), 3000);
    setTimeout(() => window.dispatchEvent(new CustomEvent('subscription-updated')), 8000);
  };

  const handlePaymentCancel = () => {
    setShowCheckout(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#E6A85C] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading subscription details...</p>
        </div>
      </div>
    );
  }

  if (showCheckout) {
    return (
      <CustomCheckout
        plan={currentPlan}
        priceId={currentPlan.priceId}
        autoRenew={autoRenew}
        currency={currency} 
        onSuccess={handlePaymentSuccess}
        onCancel={handlePaymentCancel}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 font-['Inter',sans-serif]">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src="/leyls-svg.svg" alt="Leyls" className="w-10 h-10 object-contain" />
              <span className="text-2xl font-bold font-['Space_Grotesk'] bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] bg-clip-text text-transparent">
                VOYA
              </span>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Current Plan Status */}
        {currentSubscription && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 border border-gray-200 mb-8"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 font-['Space_Grotesk']">
                  Current Plan: {currentSubscription.subscription?.plan_type || 'Trial'}
                </h3>
                <p className="text-gray-600">
                  {currentSubscription.daysRemaining > 0 
                    ? `${currentSubscription.daysRemaining} days remaining`
                    : 'Expired'
                  }
                </p>
              </div>
              <div className={`px-4 py-2 rounded-full text-sm font-medium ${
                currentSubscription.hasAccess 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {currentSubscription.hasAccess ? 'Active' : 'Expired'}
              </div>
            </div>
          </motion.div>
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 font-['Space_Grotesk']">
            Upgrade Your
            <span className="block bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] bg-clip-text text-transparent">
              Voya Experience
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Unlock advanced features and take your loyalty program to the next level
          </p>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl mb-8 flex items-center gap-3"
          >
            <AlertCircle className="h-5 w-5" />
            {error}
          </motion.div>
        )}

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.planId}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative bg-white rounded-2xl p-8 border-2 transition-all duration-300 hover:shadow-xl cursor-pointer ${
                selectedPlan === plan.planId
                  ? 'border-[#E6A85C] shadow-lg scale-105'
                  : 'border-gray-200 hover:border-gray-300'
              } ${plan.popular ? 'ring-2 ring-[#E6A85C]/20' : ''}`}
              onClick={() => setSelectedPlan(plan.planId)}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white px-4 py-2 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              {plan.savings && (
                <div className="absolute -top-2 -right-2">
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                    {plan.savings}
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2 font-['Space_Grotesk']">
                  {plan.name}
                </h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-600 ml-2">{plan.period}</span>
                </div>
                <p className="text-gray-600">{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {selectedPlan === plan.planId && (
                <div className="absolute inset-0 bg-gradient-to-r from-[#E6A85C]/10 via-[#E85A9B]/10 to-[#D946EF]/10 rounded-2xl pointer-events-none" />
              )}
            </motion.div>
          ))}
        </div>

        {/* Upgrade Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <button
            onClick={handleUpgrade}
            disabled={loading || !currentPlan}
            className="bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white px-8 py-4 rounded-xl text-lg font-semibold hover:shadow-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-3 mx-auto"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <CreditCard className="h-5 w-5" />
                Proceed to Payment
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default UpgradePage;