import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CURRENCIES, CurrencyCode, DEFAULT_CURRENCY } from '../constants/currencyConfig';

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  formatPrice: (amount: number, currencyOverride?: string) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);

  useEffect(() => {
    // 1. Check Local Storage (Manual Override)
    const stored = localStorage.getItem('leyls_currency') as CurrencyCode;
    if (stored && CURRENCIES[stored]) {
      setCurrency(stored);
      return;
    }

    // 2. Smart Detection via Timezone (Most Accurate for Physical Location)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.log("📍 Detected Timezone:", timeZone); // Debug log

    if (timeZone.includes('Kuala_Lumpur') || timeZone.includes('Malaysia')) {
      setCurrency('MYR');
      return;
    } 
    if (timeZone.includes('Dubai') || timeZone.includes('Abu_Dhabi')) {
      setCurrency('AED');
      return;
    }
    if (timeZone.includes('Riyadh')) {
      setCurrency('SAR');
      return;
    }
    if (timeZone.includes('Qatar')) {
      setCurrency('QAR');
      return;
    }
    if (timeZone.includes('London') || timeZone.includes('Europe/London')) {
      setCurrency('GBP');
      return;
    }
    if (timeZone.includes('Berlin') || timeZone.includes('Paris') || timeZone.includes('Madrid') || timeZone.includes('Rome')) {
      setCurrency('EUR');
      return;
    }
    if (timeZone.includes('Calcutta') || timeZone.includes('Kolkata') || timeZone.includes('India')) {
      setCurrency('INR');
      return;
    }

    // 3. Fallback to Browser Language Locale
    const locale = navigator.language.toUpperCase();
    if (locale.includes('MY')) { setCurrency('MYR'); return; }
    if (locale.includes('AE')) { setCurrency('AED'); return; }
    if (locale.includes('GB') || locale.includes('UK')) { setCurrency('GBP'); return; }
    if (locale.includes('IN')) { setCurrency('INR'); return; }
    if (locale.includes('CA')) { setCurrency('CAD'); return; }
    if (locale.includes('AU')) { setCurrency('AUD'); return; }
    
    // Default to USD
    setCurrency('USD');
  }, []);

  const updateCurrency = (code: CurrencyCode) => {
    setCurrency(code);
    localStorage.setItem('leyls_currency', code);
  };

  const formatPrice = (amount: number, currencyOverride?: string) => {
    const code = (currencyOverride as CurrencyCode) || currency;
    const config = CURRENCIES[code] || CURRENCIES[DEFAULT_CURRENCY];

    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency: updateCurrency, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error('useCurrency must be used within a CurrencyProvider');
  return context;
};