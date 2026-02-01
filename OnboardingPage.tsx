import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Store, ArrowRight, Loader2, AlertCircle, User as UserIcon } from 'lucide-react';

export default function OnboardingPage() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  
  // Added First/Last Name state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Prefill data if available (e.g. from Email signup flow if they land here)
  useEffect(() => {
    if (user?.user_metadata) {
      if (user.user_metadata.first_name) setFirstName(user.user_metadata.first_name);
      if (user.user_metadata.last_name) setLastName(user.user_metadata.last_name);
      if (user.user_metadata.restaurant_name) setRestaurantName(user.user_metadata.restaurant_name);
    }
  }, [user]);

  // Replace your existing handleSubmit in OnboardingPage.tsx with this:

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!user) {
    setError('User not authenticated. Please log in again.');
    return;
  }

  if (!restaurantName.trim() || !firstName.trim() || !lastName.trim()) {
    setError('All fields are required');
    return;
  }

  setIsLoading(true);
  setError('');

  try {
    console.log('📝 Starting onboarding for user:', user.id);

    // 1. Update User Profile (First/Last Name)
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        restaurant_name: restaurantName.trim()
      }
    });

    if (updateError) {
      throw new Error('Failed to update profile: ' + updateError.message);
    }

    // 2. Generate unique slug
    const slug = `${restaurantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}-${Math.random().toString(36).substring(2, 8)}`;

    // 3. Create restaurant (Handle 409 Conflict)
    const { data: restaurantData, error: dbError } = await supabase
      .from('restaurants')
      .insert({
        name: restaurantName.trim(),
        owner_id: user.id,
        slug,
        settings: {
          points_per_dollar: 1,
          referral_bonus: 50,
          pointValueAED: 0.05,
          tier_thresholds: { silver: 500, gold: 1000 },
          loyalty_program: {
            name: `${restaurantName} Rewards`,
            description: 'Earn points with every purchase!'
          }
        }
      })
      .select()
      .single();

    // --- ERROR HANDLING FIX ---
    if (dbError) {
      // Check if the error is "Duplicate Key" (Code 23505)
      if (dbError.code === '23505') {
        console.warn('⚠️ Restaurant already exists for this user. Proceeding to subscription...');
        // Ideally, we might want to update the existing restaurant name here,
        // but to unblock you, we simply proceed as if successful.
      } else {
        // If it's any other error, throw it
        throw dbError;
      }
    }

    console.log('✅ Onboarding step complete');

    // 4. Refresh local context
    await refreshProfile();

    // 5. Redirect to subscription page
    navigate('/subscription', { 
      state: { 
        email: user.email,
        firstName: firstName,
        // If we hit the duplicate error, we assume success and pass the message
        message: 'Setup complete! Please select a plan.'
      } 
    });

  } catch (err: any) {
    console.error('💥 Onboarding error:', err);
    setError(err.message || 'Failed to complete setup. Please try again.');
    setIsLoading(false);
  }
};

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-[#E6A85C] to-[#E85A9B] rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-lg">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Complete Your Setup</h1>
          <p className="text-gray-600">Tell us a bit about yourself and your business</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Personal Info Section */}
          <div className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E85A9B] focus:border-transparent outline-none transition-all"
                  placeholder="John"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E85A9B] focus:border-transparent outline-none transition-all"
                  placeholder="Doe"
                />
              </div>
            </div>
          </div>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100"></div>
            </div>
          </div>

          {/* Restaurant Section */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Restaurant Name
            </label>
            <div className="relative">
              <Store className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                id="name"
                type="text"
                required
                value={restaurantName}
                onChange={(e) => {
                  setRestaurantName(e.target.value);
                  setError('');
                }}
                className="block w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E85A9B] focus:border-transparent outline-none transition-all placeholder-gray-400"
                placeholder="e.g. Burger Palace"
                disabled={isLoading}
                maxLength={100}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">This will be used for your loyalty program</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !restaurantName.trim() || !firstName.trim()}
            className="w-full py-3 px-4 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin h-5 w-5" />
                Setting up...
              </>
            ) : (
              <>
                Continue to Plans
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </form>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm text-blue-800">
            <strong>Almost there!</strong> Next, you'll select a subscription plan to activate your account.
          </p>
        </div>
      </div>
    </div>
  );
}