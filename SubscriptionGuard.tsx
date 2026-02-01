import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Crown, AlertTriangle, Clock, ArrowRight,
  CheckCircle, Loader2
} from 'lucide-react';
import { SubscriptionService } from '../services/subscriptionService';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

interface SubscriptionGuardProps {
  children: React.ReactNode;
  requiredFeature?: 'advancedAnalytics' | 'customBranding' | 'apiAccess' | 'prioritySupport';
}

const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({ children, requiredFeature }) => {
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) {
      checkSubscription();
    }
  }, [user]);

  const checkSubscription = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await SubscriptionService.checkSubscriptionAccess(user.id);
      
      // 🔒 STRICT SECURITY FIX
      // Must have data, a subscription row, AND a valid plan_type
      if (!data || !data.subscription || !data.subscription.plan_type) {
        console.warn('⛔ Invalid or missing subscription. Redirecting.');
        navigate('/subscription', { replace: true, state: { from: location } });
        return;
      }

      setSubscriptionData(data);

      if (requiredFeature && !data.features[requiredFeature]) {
        setShowUpgradeModal(true);
      } else {
        setShowUpgradeModal(false);
      }
    } catch (error) {
      console.error('Guard Error:', error);
      navigate('/subscription', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => navigate('/upgrade');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-[#E6A85C] animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium text-sm">Verifying subscription...</p>
        </div>
      </div>
    );
  }

  // 1. Upgrade Modal
  if (showUpgradeModal && requiredFeature && !subscriptionData?.features[requiredFeature]) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl p-8 max-w-md w-full border border-gray-200 shadow-xl"
        >
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Crown className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Upgrade Required</h3>
            <p className="text-gray-600">This feature requires a premium plan.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowUpgradeModal(false)} className="flex-1 py-3 border rounded-xl hover:bg-gray-50">Back</button>
            <button onClick={handleUpgrade} className="flex-1 py-3 bg-black text-white rounded-xl hover:bg-gray-800">Upgrade</button>
          </div>
        </motion.div>
      </div>
    );
  }

  // 2. Expired Block
  if (subscriptionData && !subscriptionData.hasAccess && subscriptionData.isExpired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Subscription Expired</h3>
          <p className="text-gray-600 mb-6">Please renew your plan to access the dashboard.</p>
          <button onClick={handleUpgrade} className="w-full py-3 bg-red-600 text-white rounded-xl hover:bg-red-700">Renew Now</button>
        </motion.div>
      </div>
    );
  }

  // 3. Trial Warning
  if (subscriptionData?.hasAccess && subscriptionData?.subscription?.plan_type === 'trial' && subscriptionData?.daysRemaining <= 7) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-3 relative z-50">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 px-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5" />
              <span className="font-bold text-sm">Trial expires in {subscriptionData.daysRemaining} days</span>
            </div>
            <button onClick={handleUpgrade} className="bg-white text-gray-900 px-4 py-1.5 rounded-lg text-sm font-bold">Upgrade Now</button>
          </div>
        </div>
        {children}
      </div>
    );
  }

  return <>{children}</>;
};

export default SubscriptionGuard;