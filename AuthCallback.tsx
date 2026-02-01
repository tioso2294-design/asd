import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const handleCallback = async () => {
      try {
        console.log('🔐 Processing auth callback...');

        // 1. Handle Google "Cancel" or Errors
        const params = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const error = params.get('error') || hashParams.get('error');
        const errorDesc = params.get('error_description') || hashParams.get('error_description');

        if (error) {
          console.warn('❌ Auth Error:', error, errorDesc);
          navigate('/login', { replace: true, state: { error: 'Login canceled or failed.' } });
          return;
        }

        // 2. Check for Password Recovery
        if (window.location.hash.includes('type=recovery')) {
          navigate('/reset-password');
          return;
        }

        // 3. Exchange Code for Session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('❌ Session Error:', sessionError);
          navigate('/login', { replace: true });
          return;
        }

        if (session) {
          await checkRouting(session.user.id);
        } else {
          // Safety Timeout
          const timeout = setTimeout(() => navigate('/login', { replace: true }), 5000);

          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
              if (event === 'SIGNED_IN' && newSession) {
                clearTimeout(timeout);
                subscription.unsubscribe();
                await checkRouting(newSession.user.id);
              }
            }
          );
        }
      } catch (err) {
        console.error('💥 Callback Exception:', err);
        navigate('/login', { replace: true });
      }
    };

    const checkRouting = async (userId: string) => {
        // A. Check Restaurant
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('id')
          .eq('owner_id', userId)
          .maybeSingle();

        if (!restaurant) {
           navigate('/onboarding', { replace: true });
           return;
        }

        // B. Check Subscription (STRICT)
        // If plan_type is missing, they haven't finished setup
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('status, plan_type')
          .eq('user_id', userId)
          .maybeSingle();

        if (!sub || !sub.plan_type) {
           console.log('⚠️ No valid plan found. Redirecting to subscription.');
           navigate('/subscription', { replace: true });
        } else {
           console.log('✅ Access granted. Redirecting to Dashboard.');
           navigate('/dashboard', { replace: true });
        }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#E85A9B]"></div>
        <p className="mt-4 text-gray-600">Verifying credentials...</p>
      </div>
    </div>
  );
};

export default AuthCallback;