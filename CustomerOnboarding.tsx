import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, User, Phone, ArrowRight, Loader2, Shield, Lock, Eye, EyeOff } from 'lucide-react';
import { SupabaseClient } from '@supabase/supabase-js';

// Define Props Interface
interface OnboardingProps {
  restaurant?: {
    id: string;
    name: string;
    logo_url?: string;
  };
  onComplete: (user: any) => void;
  // This prop allows us to use the specific Wallet Client
  supabaseClient: SupabaseClient; 
}

const CustomerOnboarding: React.FC<OnboardingProps> = ({ restaurant, onComplete, supabaseClient }) => {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: ''
  });
  
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!formData.email || !formData.password) {
      setError("Please fill in all fields");
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      let result;
      
      // USE THE PASSED supabaseClient PROP, NOT THE GLOBAL IMPORT
      if (authMode === 'signup') {
        const { data, error: signUpError } = await supabaseClient.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              first_name: formData.firstName,
              last_name: formData.lastName,
              phone: formData.phone,
              role: 'customer' // Explicitly set role
            }
          }
        });
        if (signUpError) throw signUpError;
        result = data;
      } else {
        const { data, error: signInError } = await supabaseClient.auth.signInWithPassword({
          email: formData.email,
          password: formData.password
        });
        if (signInError) throw signInError;
        result = data;
      }

      if (result.user) {
        onComplete(result.user);
      }
    } catch (e: any) {
      setError(e.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const isRestaurantMode = !!restaurant;

  return (
    <div className="min-h-screen bg-[#F8F9FC] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-[#E85A9B]/10 to-transparent pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="w-full max-w-md space-y-8 relative z-10"
      >
        <div className="text-center">
           <div className="w-24 h-24 bg-white rounded-[2rem] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] mx-auto mb-8 flex items-center justify-center p-5 relative overflow-hidden border border-gray-50">
              {isRestaurantMode && restaurant.logo_url ? (
                 <img src={restaurant.logo_url} className="w-full h-full object-cover rounded-xl" />
              ) : (
                 <img src="/leyls-svg.svg" className="w-full h-full object-contain" />
              )}
           </div>
           
           <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
             {authMode === 'login' ? 'Welcome Back' : (isRestaurantMode ? 'Join the Club' : 'Setup Wallet')}
           </h1>
           
           <p className="text-gray-500 font-medium px-4">
             {isRestaurantMode ? (
               <>Unlock exclusive rewards at <span className="text-gray-900 font-bold">{restaurant.name}</span></>
             ) : (
               "One login for all your favorite restaurants."
             )}
           </p>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-gray-100 space-y-5">
           {error && (
             <motion.div 
               initial={{ opacity: 0, height: 0 }} 
               animate={{ opacity: 1, height: 'auto' }}
               className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold flex items-center gap-2"
             >
               <Shield className="w-4 h-4 flex-shrink-0" /> 
               {error}
             </motion.div>
           )}
           
           {authMode === 'signup' && (
             <div className="space-y-4 animate-in slide-in-from-top-4 fade-in duration-300">
               <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      placeholder="First Name" 
                      className="w-full h-14 pl-10 pr-4 bg-gray-50 rounded-2xl outline-none focus:bg-white focus:ring-2 ring-[#E85A9B]/20 font-bold text-gray-900 placeholder-gray-400 text-sm transition-all" 
                      onChange={e => setFormData({...formData, firstName: e.target.value})} 
                    />
                  </div>
                  <input 
                    placeholder="Last Name" 
                    className="w-full h-14 px-6 bg-gray-50 rounded-2xl outline-none focus:bg-white focus:ring-2 ring-[#E85A9B]/20 font-bold text-gray-900 placeholder-gray-400 text-sm transition-all" 
                    onChange={e => setFormData({...formData, lastName: e.target.value})} 
                  />
               </div>
               <div className="relative">
                 <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                 <input 
                    placeholder="Phone (Optional)" 
                    className="w-full h-14 pl-10 pr-4 bg-gray-50 rounded-2xl outline-none focus:bg-white focus:ring-2 ring-[#E85A9B]/20 font-bold text-gray-900 placeholder-gray-400 text-sm transition-all" 
                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                 />
               </div>
             </div>
           )}

           <div className="relative">
             <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
             <input 
               type="email"
               placeholder="email@example.com" 
               className="w-full h-14 pl-10 pr-4 bg-gray-50 rounded-2xl outline-none focus:bg-white focus:ring-2 ring-[#E85A9B]/20 font-bold text-gray-900 placeholder-gray-400 text-sm transition-all" 
               onChange={e => setFormData({...formData, email: e.target.value})} 
             />
           </div>

           <div className="relative">
             <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
             <input 
               type={showPassword ? "text" : "password"}
               placeholder="Password" 
               className="w-full h-14 pl-10 pr-12 bg-gray-50 rounded-2xl outline-none focus:bg-white focus:ring-2 ring-[#E85A9B]/20 font-bold text-gray-900 placeholder-gray-400 text-sm transition-all" 
               onChange={e => setFormData({...formData, password: e.target.value})} 
             />
             <button 
               onClick={() => setShowPassword(!showPassword)}
               className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
             >
               {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
             </button>
           </div>

           <button 
             onClick={handleSubmit} 
             disabled={loading} 
             className="w-full h-16 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-lg shadow-pink-200 hover:shadow-pink-300"
           >
              {loading ? <Loader2 className="animate-spin" /> : (
                <>
                  {authMode === 'login' ? 'Enter Wallet' : 'Create Account'} 
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
           </button>

           <div className="pt-2 text-center">
             <button 
               onClick={() => {
                 setAuthMode(authMode === 'login' ? 'signup' : 'login');
                 setError('');
               }} 
               className="text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-[#E85A9B] transition-colors"
             >
               {authMode === 'login' ? 'New here? Create Account' : 'Already a member? Sign in'}
             </button>
           </div>
        </div>
        
        <div className="text-center flex items-center justify-center gap-2 opacity-30">
           <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">Secured by</span>
           <img src="/leyls-svg.svg" className="h-4 w-auto" />
        </div>
      </motion.div>
    </div>
  );
};

export default CustomerOnboarding;