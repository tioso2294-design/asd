/**
 * FILE: src/App.tsx
 */

import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SupportAuthProvider } from './contexts/SupportAuthContext';
import { MaintenanceProvider } from './contexts/MaintenanceContext'; 
import { CurrencyProvider } from './contexts/CurrencyContext'; 
import { useCampaignTracking } from './hooks/useCampaignTracking';
import { supabase } from './lib/supabase';

import LandingPage from './components/LandingPage';
import SignupPage from './components/SignupPage';
import SubscriptionPage from './components/SubscriptionPage';
import UpgradePage from './components/UpgradePage';
import SubscriptionGuard from './components/SubscriptionGuard';
import LoginPage from './components/LoginPage';
import DashboardLayout from './components/DashboardLayout';
import DashboardHome from './components/DashboardHome';
import CustomerWallet from './components/CustomerWallet';
import RewardsPage from './components/RewardsPage';
import DebugAuth from './components/DebugAuth';
import MenuItemsPage from './components/MenuItemsPage';
import LoyaltyConfigPage from './components/LoyaltyConfigPage';
import BranchManagement from './components/BranchManagement';
import StaffUI from './components/StaffUI';
import SuperAdminUI from './components/SuperAdminUI';
import SupportUI from './components/SupportUI';
import SuperAdminLogin from './components/SuperAdminLogin';
import SupportPortal from './components/SupportPortal';
import SupportPortalLogin from './components/SupportPortalLogin';
import PrivacyPage from './components/PrivacyPage';
import TermsPage from './components/TermsPage';
import BillingPage from './components/BillingPage';
import LoadingBar from './components/LoadingBar';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import LoyaltyROIDashboard from './components/LoyaltyROIDashboard';
import CustomersPage from './components/CustomersPage';
import StarterPackPage from './components/StarterPackPage';
import CampaignsPage from './components/CampaignsPage';
import CampaignWizard from './components/CampaignWizard';
import CampaignSettings from './components/CampaignSettings';
import CampaignMonitoring from './components/CampaignMonitoring';
import OnboardingPage from './components/OnboardingPage';
import SettingsPage from './components/SettingsPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import AuthCallback from './components/AuthCallback';
import QRPage from './components/QRPage';

const CampaignTracker = () => {
  const { checkCampaignClick } = useCampaignTracking();
  useEffect(() => { checkCampaignClick(); }, [checkCampaignClick]);
  return null;
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingBar isLoading={true} />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <SubscriptionGuard>{children}</SubscriptionGuard>;
};

// ✅ STRICT PUBLIC ROUTE (THE FIX)
// This prevents the "Back Button Bypass" by waiting for a DB check before redirecting.
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const [decision, setDecision] = useState<'loading' | 'redirect' | 'allow'>('loading');
  const [redirectPath, setRedirectPath] = useState('');

  useEffect(() => {
    // 1. Wait for Auth to Initialize
    if (loading) return;

    // 2. If Not Logged In -> Allow access to Login/Signup page
    if (!user) {
      setDecision('allow');
      return;
    }

    // 3. If Logged In -> CHECK DATABASE FIRST
    const checkStatus = async () => {
      try {
        // Check Restaurant
        const { data: rest } = await supabase
          .from('restaurants')
          .select('id')
          .eq('owner_id', user.id)
          .maybeSingle();

        if (!rest) {
          setRedirectPath('/onboarding');
          setDecision('redirect');
          return;
        }

        // Check Subscription (Get the LATEST one)
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('plan_type')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }) // ✅ IMPORTANT: Get latest
          .limit(1)
          .maybeSingle();

        // 🔒 TRAP: If no plan, force them to Subscription
        if (!sub || !sub.plan_type) {
          console.log('⛔ PublicRoute: Logged in but no plan. Trapping in Subscription.');
          setRedirectPath('/subscription');
        } else {
          console.log('✅ PublicRoute: Plan found. Proceeding to Dashboard.');
          setRedirectPath('/dashboard');
        }
        setDecision('redirect');
      } catch (err) {
        console.error('PublicRoute check failed', err);
        setRedirectPath('/subscription'); // Fail safe
        setDecision('redirect');
      }
    };

    checkStatus();
  }, [user, loading]);

  // Block rendering until we know where to go
  if (decision === 'loading') return null; // Or <LoadingBar isLoading={true} />

  // Perform the Redirect
  if (decision === 'redirect') {
    return <Navigate to={redirectPath} replace />;
  }

  // Allow access to public page (Login/Signup)
  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <MaintenanceProvider>
          <CurrencyProvider>
            <CampaignTracker />
            <Routes>
              {/* Public Routes - Wrapped in Strict PublicRoute */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
              <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
              
              {/* Emergency Exits (Always Accessible) */}
              <Route path="/subscription" element={<SubscriptionPage />} />
              <Route path="/upgrade" element={<UpgradePage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />

              {/* Auth Callback */}
              <Route path="/auth/callback" element={<AuthCallback />} />

              {/* Reset Password */}
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Onboarding */}
              <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />

              {/* Dashboard */}
              <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<DashboardHome />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="rewards" element={<RewardsPage />} />
                <Route path="campaigns" element={<CampaignsPage />} />
                <Route path="campaigns/create" element={<CampaignWizard />} />
                <Route path="campaigns/settings" element={<CampaignSettings />} />
                <Route path="campaigns/:campaignId/edit" element={<CampaignWizard />} />
                <Route path="campaigns/:campaignId/monitoring" element={<CampaignMonitoring />} />
                <Route path="menu-items" element={<MenuItemsPage />} />
                <Route path="loyalty-config" element={<LoyaltyConfigPage />} />
                <Route path="branches" element={<BranchManagement />} />
                <Route path="starter-pack" element={<StarterPackPage />} />
                <Route path="billing" element={<BillingPage />} />
                <Route path="support" element={<SupportUI />} />
                <Route path="analytics" element={<AnalyticsDashboard />} />
                <Route path="roi" element={<LoyaltyROIDashboard timeRange="30d" />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="qr" element={<QRPage />} />
              </Route>

              {/* Wallet - UNPROTECTED */}
              <Route path="/wallet" element={<CustomerWallet />} />
              <Route path="/staff/:slug" element={<StaffUI />} />
              <Route path="/staff/:restaurantSlug" element={<StaffUI />} />
              
              {/* Admin/Support */}
              <Route path="/super-admin" element={<SuperAdminUI />} />
              <Route path="/super-admin-login" element={<SuperAdminLogin />} />
              <Route path="/support-portal" element={<SupportAuthProvider><SupportPortal /></SupportAuthProvider>} />
              <Route path="/support-portal-login" element={<SupportAuthProvider><SupportPortalLogin /></SupportAuthProvider>} />

              <Route path="/debug" element={<DebugAuth />} />
              <Route path="/app" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </CurrencyProvider>
        </MaintenanceProvider>
      </Router>
    </AuthProvider>
  );
}

export default App;