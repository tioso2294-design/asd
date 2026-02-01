import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Mail, Lock, Building, ArrowLeft, ArrowRight,
  AlertCircle, Eye, EyeOff, Loader2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext'; // ✅ IMPORTED

const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { currency } = useCurrency(); // ✅ GET DETECTED CURRENCY (e.g. 'MYR')
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    restaurantName: '',
    password: '',
    confirmPassword: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.firstName.trim()) errors.firstName = 'First name is required';
    if (!formData.lastName.trim()) errors.lastName = 'Last name is required';
    if (!formData.email.trim()) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Please enter a valid email';
    if (!formData.restaurantName.trim()) errors.restaurantName = 'Restaurant name is required';
    if (!formData.password) errors.password = 'Password is required';
    else if (formData.password.length < 6) errors.password = 'Password must be at least 6 characters';
    if (formData.password !== formData.confirmPassword) errors.confirmPassword = 'Passwords do not match';

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      // 1. Create account with DETECTED CURRENCY
      const result = await signUp(formData.email, formData.password, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        restaurantName: formData.restaurantName,
        currency: currency // ✅ PASSING MYR (or detected region)
      });

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      // 2. On success, navigate to the subscription page
      navigate('/subscription', { 
        state: { 
          email: formData.email,
          firstName: formData.firstName,
          message: 'Account created! Please select a plan.'
        } 
      });

    } catch (err: any) {
      setError(err.message || 'Failed to complete signup. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 font-['Inter',sans-serif]">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <img src="/leyls-svg.svg" alt="Leyls" className="h-9 w-auto object-contain" />
            </Link>
            <Link to="/login" className="text-gray-600 hover:text-gray-900 transition-colors">
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </header>

      <div className="flex items-center justify-center min-h-[calc(100vh-64px)] p-4">
        <div className="w-full max-w-2xl">
          <motion.div
            className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {error && (
              <div className="bg-red-50 border-b border-red-200 text-red-700 px-6 py-4 flex items-center gap-3">
                <AlertCircle className="h-5 w-5" />
                {error}
              </div>
            )}

            <div className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2 font-['Space_Grotesk']">
                  Create Your Account
                </h2>
                <p className="text-gray-600">
                  Get started with Leyls loyalty platform in minutes
                </p>
              </div>

              <div className="space-y-6">
                {/* Form Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent transition-all ${
                        validationErrors.firstName ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'
                      }`}
                      placeholder="John"
                    />
                    {validationErrors.firstName && <p className="text-red-600 text-sm mt-1">{validationErrors.firstName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent transition-all ${
                        validationErrors.lastName ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'
                      }`}
                      placeholder="Doe"
                    />
                    {validationErrors.lastName && <p className="text-red-600 text-sm mt-1">{validationErrors.lastName}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`w-full pl-12 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent transition-all ${
                        validationErrors.email ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'
                      }`}
                      placeholder="john@restaurant.com"
                    />
                  </div>
                  {validationErrors.email && <p className="text-red-600 text-sm mt-1">{validationErrors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Restaurant Name *</label>
                  <div className="relative">
                    <Building className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={formData.restaurantName}
                      onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
                      className={`w-full pl-12 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent transition-all ${
                        validationErrors.restaurantName ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'
                      }`}
                      placeholder="Your Restaurant Name"
                    />
                  </div>
                  {validationErrors.restaurantName && <p className="text-red-600 text-sm mt-1">{validationErrors.restaurantName}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className={`w-full pl-12 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent transition-all ${
                          validationErrors.password ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'
                        }`}
                        placeholder="Create a secure password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {validationErrors.password && <p className="text-red-600 text-sm mt-1">{validationErrors.password}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password *</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className={`w-full pl-12 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent transition-all ${
                          validationErrors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'
                        }`}
                        placeholder="Confirm your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {validationErrors.confirmPassword && <p className="text-red-600 text-sm mt-1">{validationErrors.confirmPassword}</p>}
                  </div>
              </div>

              <div className="flex gap-4 mt-8">
                <Link
                  to="/"
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-6 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Home
                </Link>
                <button
                  onClick={handleSignup}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Create Account
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
              
              <p className="text-xs text-gray-500 text-center mt-6">
                 By creating an account, you agree to our <Link to="/terms" className="text-blue-600 hover:underline">Terms of Service</Link> and <Link to="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;