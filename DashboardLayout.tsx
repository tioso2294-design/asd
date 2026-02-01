import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { SubscriptionService } from '../services/subscriptionService';
import { useAuth } from '../contexts/AuthContext';
import {
  Home, Users, Gift, Settings, LogOut, Menu, X, ChefHat, MapPin,
  Headphones as HeadphonesIcon, CreditCard, BarChart3, Crown,
  ChevronLeft, ChevronRight, TrendingUp, Package, Target, Shield,
  QrCode, Sliders // ✅ Added Sliders icon for Loyalty Engine
} from 'lucide-react';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, loading, restaurant } = useAuth();

  React.useEffect(() => {
    if (user && !subscriptionData) {
      SubscriptionService.checkSubscriptionAccess(user.id).then(setSubscriptionData);
    }
  }, [user]);

  // Handle Onboarding Redirect
  React.useEffect(() => {
    if (!loading && user && !restaurant) {
      navigate('/onboarding');
    }
  }, [user, restaurant, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    // ✅ ADDED LOYALTY ENGINE HERE
    { name: 'Loyalty Engine', href: '/dashboard/loyalty-config', icon: Sliders }, 
    { name: 'QR Assets', href: '/dashboard/qr', icon: QrCode },
    { name: 'Rewards', href: '/dashboard/rewards', icon: Gift },
    { name: 'Campaigns', href: '/dashboard/campaigns', icon: Target },
    { name: 'Customers', href: '/dashboard/customers', icon: Users },
    { name: 'Branches', href: '/dashboard/branches', icon: MapPin },
    { name: 'Starter Pack', href: '/dashboard/starter-pack', icon: Package },
    { name: 'Billing', href: '/dashboard/billing', icon: CreditCard },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { name: 'ROI Analysis', href: '/dashboard/roi', icon: TrendingUp },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
    { name: 'Support', href: '/dashboard/support', icon: HeadphonesIcon },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(href) && href !== '/dashboard';
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] flex font-sans overflow-hidden">
      
      {/* --- Mobile Sidebar Overlay --- */}
      <div 
        className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        <div className={`absolute inset-y-0 left-0 w-72 bg-white shadow-2xl transform transition-transform duration-300 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
           <div className="h-24 px-6 flex items-center justify-between border-b border-gray-50">
             <img src="/leyls-svg.svg" alt="Leyls" className="h-8 w-auto" />
             <button onClick={() => setSidebarOpen(false)} className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
               <X className="w-6 h-6" />
             </button>
           </div>
           <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
             {navigation.map((item) => (
               <button
                 key={item.name}
                 onClick={() => { navigate(item.href); setSidebarOpen(false); }}
                 className={`w-full flex items-center px-4 py-3 rounded-2xl transition-all duration-200 ${
                   isActive(item.href)
                     ? 'bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white shadow-lg shadow-pink-500/20' 
                     : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                 }`}
               >
                 <item.icon className="w-5 h-5 mr-3" />
                 <span className="font-medium">{item.name}</span>
               </button>
             ))}
           </nav>
        </div>
      </div>

      {/* --- Desktop Sidebar --- */}
      <div 
        className={`hidden lg:flex flex-col bg-white border-r border-gray-100 transition-all duration-300 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.01)] relative h-screen
        ${sidebarCollapsed ? 'w-24' : 'w-72'}`}
      >
        {/* HEADER */}
        <div className="h-24 flex items-center justify-between px-6 border-b border-gray-50 flex-shrink-0 relative">
          {!sidebarCollapsed ? (
            <>
              <img src="/leyls-svg.svg" alt="Leyls" className="h-8 w-auto object-contain" />
              <button 
                onClick={() => setSidebarCollapsed(true)} 
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </>
          ) : (
            <div className="w-full flex flex-col items-center gap-2">
               <img src="/SwooshLogo.svg" alt="Leyls" className="w-8 h-8 object-contain" />
               <button 
                 onClick={() => setSidebarCollapsed(false)} 
                 className="absolute -right-3 top-1/2 -translate-y-1/2 bg-white border border-gray-100 shadow-sm p-1 rounded-full text-gray-400 hover:text-[#E85A9B] hover:border-[#E85A9B] transition-all z-50"
               >
                 <ChevronRight className="w-3 h-3" />
               </button>
            </div>
          )}
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-6 px-4 space-y-2 custom-scrollbar">
          {navigation.map((item) => {
            const active = isActive(item.href);
            return (
              <button
                key={item.name}
                onClick={() => navigate(item.href)}
                className={`group relative flex items-center w-full p-3.5 rounded-2xl transition-all duration-300 outline-none ${
                  active 
                    ? 'bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white shadow-lg shadow-pink-500/20' 
                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-900'
                } ${sidebarCollapsed ? 'justify-center' : ''}`}
              >
                <item.icon className={`w-6 h-6 flex-shrink-0 transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`} />
                
                {!sidebarCollapsed && (
                  <span className={`ml-3.5 font-normal text-[15px] truncate ${active ? 'font-medium' : ''}`}>{item.name}</span>
                )}

                {sidebarCollapsed && (
                  <div className="absolute left-full ml-4 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-xl">
                    {item.name}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-gray-50 bg-white flex flex-col gap-3 flex-shrink-0">
          {!sidebarCollapsed && subscriptionData?.subscription?.plan_type === 'trial' && (
             <div className="bg-gradient-to-br from-orange-50 to-pink-50 border border-pink-100 rounded-2xl p-4 text-center mb-1">
               <div className="flex items-center justify-center w-8 h-8 bg-white rounded-full shadow-sm mx-auto mb-2 text-[#E85A9B]">
                 <Crown className="w-4 h-4" />
               </div>
               <h4 className="font-bold text-gray-900 text-xs">Free Trial</h4>
               <button onClick={() => navigate('/upgrade')} className="mt-2 w-full py-2 bg-white text-gray-900 text-xs font-bold rounded-lg shadow-sm hover:shadow-md transition-all">
                 Upgrade
               </button>
             </div>
          )}

          <div className={`flex items-center rounded-2xl transition-all duration-300 ${sidebarCollapsed ? 'justify-center py-2' : 'bg-gray-50 p-3'}`}>
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E6A85C] to-[#E85A9B] flex items-center justify-center text-white font-bold text-sm shadow-sm ring-2 ring-white">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
            </div>
            
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0 ml-3 flex items-center justify-between">
                <div className="overflow-hidden">
                  <p className="text-sm font-bold text-gray-900 truncate" title={user?.email}>
                    {user?.email?.split('@')[0]}
                  </p>
                  <p className="text-xs text-gray-400 font-medium truncate">Owner</p>
                </div>
                <button onClick={handleSignOut} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- Main Content Area --- */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Mobile Header */}
        <div className="lg:hidden h-16 bg-white/90 backdrop-blur-md flex-shrink-0 z-30 flex items-center justify-between px-4 border-b border-gray-200 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-gray-600 rounded-lg hover:bg-gray-100">
            <Menu className="w-6 h-6" />
          </button>
          <img src="/leyls-svg.svg" alt="Leyls" className="h-6 w-auto" />
          <div className="w-9 h-9 rounded-full bg-gradient-to-r from-[#E6A85C] to-[#E85A9B] p-[2px]">
             <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                <span className="text-xs font-bold text-gray-900">{user?.email?.charAt(0).toUpperCase()}</span>
             </div>
          </div>
        </div>

        {/* Content Outlet */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 scroll-smooth">
           <div className="max-w-[1600px] mx-auto w-full animate-fade-in pb-10">
              <Outlet />
           </div>
        </main>
      </div>
    </div>
  );
}