import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { SubscriptionService } from '../services/subscriptionService';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  settings: any;
  logo_url?: string;
  banner_url?: string;
  owner_id: string;
  currency?: string; 
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  restaurant: Restaurant | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, metadata: {
    firstName: string;
    lastName: string;
    restaurantName: string;
    currency: string; 
  }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper: Strict Role Verification
  const isAuthorizedRole = (user: User) => {
    const role = user.user_metadata?.role;
    // Explicitly BLOCK these roles
    if (role === 'customer' || role === 'support' || role === 'admin') {
      return false;
    }
    return true;
  };

  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          console.error('❌ Error getting session:', error);
          setLoading(false);
          return;
        }

        // 🔒 GATEKEEPER: Check role on initial load
        if (session?.user && !isAuthorizedRole(session.user)) {
           console.warn('⛔ Unauthorized role detected on load. Signing out.');
           await supabase.auth.signOut();
           setSession(null);
           setUser(null);
           setLoading(false);
           return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchRestaurant(session.user.id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('💥 Error in initSession:', err);
        if (mounted) setLoading(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log('🔐 Auth Event:', event);

        // 🔒 GATEKEEPER: Check role on state changes
        if (session?.user && !isAuthorizedRole(session.user)) {
          console.warn('⛔ Unauthorized role detected during auth change. Signing out.');
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setRestaurant(null);
          setLoading(false);
          return;
        }

        if (event === 'PASSWORD_RECOVERY') {
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          fetchRestaurant(session.user.id);
        } else {
          setRestaurant(null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleSubscriptionUpdate = () => {
      if (user) {
        setTimeout(() => {
          SubscriptionService.getUserSubscription(user.id) 
            .catch(console.warn);
        }, 1000);
      }
    };
    window.addEventListener('subscription-updated', handleSubscriptionUpdate);
    return () => window.removeEventListener('subscription-updated', handleSubscriptionUpdate);
  }, [user]);

  const fetchRestaurant = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, slug, settings, logo_url, banner_url, owner_id, currency') 
        .eq('owner_id', userId)
        .maybeSingle();

      if (data) {
        setRestaurant(data);
      } else {
        setRestaurant(null);
      }
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        if (error.message === 'Invalid login credentials') return { error: 'Incorrect email or password.' };
        return { error: error.message };
      }

      // 🔒 GATEKEEPER: Check Role Immediately
      if (data.user && !isAuthorizedRole(data.user)) {
        await supabase.auth.signOut();
        // Return generic error to simulate "invalid credentials" for wrong role
        return { error: 'Incorrect email or password.' }; 
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const signUp = async (
    email: string, 
    password: string, 
    metadata: { firstName: string; lastName: string; restaurantName: string; currency: string }
  ) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { 
          data: { 
            first_name: metadata.firstName, 
            last_name: metadata.lastName, 
            restaurant_name: metadata.restaurantName,
            currency: metadata.currency,
            role: 'restaurant_owner' // ✅ Explicitly set role
          } 
        }
      });
      if (error) return { error: error.message };

      // 🛑 STOP: Do NOT auto-create subscription here.
      // The user MUST go to /subscription and click "Start Free Trial" or Pay.
      // This ensures if they hit "Back", they have NO subscription and get blocked.

      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const signOut = async () => {
    setUser(null);
    setSession(null);
    setRestaurant(null);
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const verifyOtp = async (email: string, token: string) => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'recovery',
      });
      
      if (error) return { error: error.message };
      
      // 🔒 GATEKEEPER Check on OTP login
      if (data.session?.user && !isAuthorizedRole(data.session.user)) {
         await supabase.auth.signOut();
         return { error: 'Unauthorized access.' };
      }

      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        await fetchRestaurant(data.session.user.id);
      }
      
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchRestaurant(user.id);
  };

  const value = { 
    user, 
    session, 
    restaurant, 
    loading, 
    signIn, 
    signInWithGoogle, 
    signUp, 
    signOut, 
    resetPassword,
    verifyOtp,
    refreshProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};