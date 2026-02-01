import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Lock, KeyRound, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';

const ResetPasswordPage: React.FC = () => {
  const { verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get the email passed from the previous page
  const emailFromState = location.state?.email || '';

  const [email, setEmail] = useState(emailFromState);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [step, setStep] = useState<'verify' | 'reset'>('verify');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // If user refreshes and loses state, show the email input again
  const [missingEmail, setMissingEmail] = useState(!emailFromState);

  // STEP 1: Verify OTP
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const { error } = await verifyOtp(email, otp);

    if (error) {
      setError(error);
      setIsLoading(false);
    } else {
      setStep('reset');
      setIsLoading(false);
    }
  };

  // STEP 2: Update Password
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setIsLoading(false);
        return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccess(true);
      setTimeout(() => {
        navigate('/dashboard', { state: { message: 'Password updated successfully!' } });
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
       <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-gray-100 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">All Set!</h2>
          <p className="text-gray-600 mt-2">Your password has been changed. Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* --- BRANDING SIDEBAR (Same as Login) --- */}
      <div className="hidden lg:flex lg:w-3/5 bg-gradient-to-br from-[#E6A85C] via-[#E85A9B] to-[#D946EF] relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20"></div>

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-white">
          <div className="mb-8">
            <img src="/leyls-svg.svg" alt="Leyls" className="h-12 w-auto mb-8 brightness-0 invert" />
          </div>
          <h1 className="text-5xl xl:text-6xl font-bold mb-6 leading-tight">
            Secure Your Account
          </h1>
          <p className="text-xl xl:text-2xl text-white/90 mb-12 leading-relaxed">
            Protecting your business data is our top priority. Reset your password to get back to growing your loyalty program.
          </p>
          <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Bank-Grade Security</h3>
                <p className="text-white/80">Your customer data is encrypted and safe</p>
              </div>
            </div>
        </div>
      </div>

      {/* --- FORM SECTION --- */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
           <div className="mb-8 lg:hidden">
            <img src="/leyls-svg.svg" alt="Leyls" className="h-10 w-auto mx-auto" />
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {step === 'verify' ? 'Enter Security Code' : 'Set New Password'}
              </h2>
              <p className="text-gray-600">
                {step === 'verify' 
                  ? <span>We sent a code to <span className="font-semibold text-gray-900">{email}</span></span>
                  : 'Create a strong password for your account'}
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-4 mb-6 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {step === 'verify' ? (
              <form onSubmit={handleVerify} className="space-y-6">
                {/* Fallback: If no email in state, ask for it here */}
                {missingEmail && (
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                     <input 
                       type="email" 
                       value={email} 
                       onChange={e => setEmail(e.target.value)}
                       className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E85A9B] outline-none"
                       required 
                       placeholder="Enter your email"
                     />
                   </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">6-Digit Code</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="block w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-2xl tracking-widest text-center font-mono focus:ring-2 focus:ring-[#E85A9B] outline-none"
                      placeholder="000000"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white font-semibold rounded-xl hover:shadow-lg transition-all"
                >
                  {isLoading ? 'Verifying...' : 'Verify Code'}
                </button>
                
                <div className="text-center">
                    <button type="button" onClick={() => navigate('/login')} className="text-sm text-gray-500 hover:text-gray-900">
                        Wrong email? Go back
                    </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleReset} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E85A9B] outline-none"
                      placeholder="At least 6 characters"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E85A9B] outline-none"
                      placeholder="Confirm password"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white font-semibold rounded-xl shadow-lg transition-all"
                >
                  {isLoading ? 'Updating...' : 'Set New Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;