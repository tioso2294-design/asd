import React, { useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom'; // Added useNavigate
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';

const LoginPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate(); // Hook for navigation
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Forgot Password State
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  
  const { signIn, signInWithGoogle, resetPassword } = useAuth();

  const successMessage = location.state?.message;
  const prefilledEmail = location.state?.email;

  React.useEffect(() => {
    if (prefilledEmail) {
      setEmail(prefilledEmail);
    }
  }, [prefilledEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    const result = await signIn(email, password);
    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError('');
    const result = await signInWithGoogle();
    if (result.error) {
      setError(result.error);
      setIsGoogleLoading(false);
    }
  };

  // --- MODIFIED FUNCTION ---
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // 1. Send the OTP code
    const result = await resetPassword(resetEmail);
    
    setIsLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      // 2. Navigate to Reset Page immediately, passing the email
      // This ensures they don't have to type it again
      navigate('/reset-password', { state: { email: resetEmail } });
    }
  };

  // --- REUSED LAYOUT COMPONENT ---
  // We extract the left side to keep code clean, but it renders exactly as before
  const BrandingSidebar = () => (
    <div className="hidden lg:flex lg:w-3/5 bg-gradient-to-br from-[#E6A85C] via-[#E85A9B] to-[#D946EF] relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20"></div>
      <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-white">
        <div className="mb-8">
          <img src="/leyls-svg.svg" alt="Leyls" className="h-12 w-auto mb-8 brightness-0 invert" />
        </div>
        <h1 className="text-5xl xl:text-6xl font-bold mb-6 leading-tight">
          Transform Your Restaurant's Loyalty Program
        </h1>
        <p className="text-xl xl:text-2xl text-white/90 mb-12 leading-relaxed">
          Engage customers, boost revenue, and build lasting relationships.
        </p>
        <div className="space-y-6">
          {[
            { title: 'Automated Rewards', desc: 'Set up custom rules effortlessly' },
            { title: 'Real-time Analytics', desc: 'Track performance instantly' },
            { title: 'Seamless Integration', desc: 'Works with your existing systems' }
          ].map((item, idx) => (
            <div key={idx} className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">{item.title}</h3>
                <p className="text-white/80">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // VIEW: Forgot Password Input
  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex">
        <BrandingSidebar />
        <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
              <div className="mb-8">
                <button
                  onClick={() => setShowForgotPassword(false)}
                  className="text-gray-600 hover:text-gray-900 font-medium mb-4 inline-flex items-center gap-2 transition-colors"
                >
                  <ArrowRight className="h-4 w-4 rotate-180" />
                  Back to Sign In
                </button>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Reset Password</h2>
                <p className="text-gray-600">Enter your email to receive a secure code.</p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-6">
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="reset-email"
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="block w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E85A9B] outline-none transition-all"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Sending Code...' : 'Send Code'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // VIEW: Standard Login
  return (
    <div className="min-h-screen flex">
      <BrandingSidebar />
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
           <div className="mb-8 lg:hidden">
              <img src="/leyls-svg.svg" alt="Leyls" className="h-10 w-auto mx-auto" />
            </div>

            {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">
              {successMessage}
            </div>
          )}

          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h2>
              <p className="text-gray-600">Sign in to your restaurant dashboard</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E85A9B] outline-none"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-[#E85A9B] hover:text-[#D946EF] font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E85A9B] outline-none"
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                   <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
                className="w-full py-3 px-4 bg-white border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-3"
              >
                 <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {isGoogleLoading ? 'Signing in...' : 'Sign in with Google'}
              </button>
               <div className="text-center pt-4">
                <p className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <Link to="/signup" className="text-[#E85A9B] hover:text-[#D946EF] font-semibold">
                    Sign up for free
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;