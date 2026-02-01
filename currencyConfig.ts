// src/constants/currencyConfig.ts

export type CurrencyCode = 
  | 'USD' | 'EUR' | 'CAD' | 'GBP' | 'INR' 
  | 'AED' | 'MYR' | 'AUD' | 'SAR' | 'QAR';

interface CurrencyDetails {
  code: CurrencyCode;
  locale: string;     // for Intl.NumberFormat
  name: string;
  countryCode: string; // ISO 3166-1 alpha-2 (Required for Google Maps)
  dialCode: string;    // For phone formatting
  phoneFormat: string; // Visual mask
  isZeroDecimal?: boolean; 
}

export const DEFAULT_CURRENCY: CurrencyCode = 'USD';

export const CURRENCIES: Record<CurrencyCode, CurrencyDetails> = {
  USD: { 
    code: 'USD', locale: 'en-US', name: 'US Dollar',
    countryCode: 'US', dialCode: '+1', phoneFormat: '(###) ###-####'
  },
  EUR: { 
    code: 'EUR', locale: 'de-DE', name: 'Euro',
    countryCode: 'DE', dialCode: '+49', phoneFormat: '#### ######',
    // Note: Defaulting to Germany for Maps strictness. 
  },
  CAD: { 
    code: 'CAD', locale: 'en-CA', name: 'Canadian Dollar',
    countryCode: 'CA', dialCode: '+1', phoneFormat: '(###) ###-####'
  },
  GBP: { 
    code: 'GBP', locale: 'en-GB', name: 'British Pound',
    countryCode: 'GB', dialCode: '+44', phoneFormat: '##### ######',
  },
  INR: { 
    code: 'INR', locale: 'en-IN', name: 'Indian Rupee',
    countryCode: 'IN', dialCode: '+91', phoneFormat: '##### #####'
  },
  AED: { 
    code: 'AED', locale: 'en-AE', name: 'UAE Dirham',
    countryCode: 'AE', dialCode: '+971', phoneFormat: '## ### ####'
  },
  MYR: { 
    code: 'MYR', locale: 'en-MY', name: 'Malaysian Ringgit',
    countryCode: 'MY', dialCode: '+60', phoneFormat: '##-### ####'
  },
  AUD: { 
    code: 'AUD', locale: 'en-AU', name: 'Australian Dollar',
    countryCode: 'AU', dialCode: '+61', phoneFormat: '#### ### ###'
  },
  SAR: { 
    code: 'SAR', locale: 'en-SA', name: 'Saudi Riyal',
    countryCode: 'SA', dialCode: '+966', phoneFormat: '## ### ####'
  },
  QAR: { 
    code: 'QAR', locale: 'en-QA', name: 'Qatari Riyal',
    countryCode: 'QA', dialCode: '+974', phoneFormat: '#### ####'
  },
};

// --- SUBSCRIPTION PLANS ---
export const SUBSCRIPTION_PLANS = {
  monthly: {
    id: 'monthly',
    name: 'Monthly',
    period: 'month',
    features: ['Full System Access', 'Analytics Dashboard', 'Unlimited Transactions', 'Standard Support'],
    prices: {
      USD: 2999, // $29.99
      EUR: 2799,
      CAD: 3999,
      INR: 249900,
      AED: 11000,
      MYR: 13000,
      AUD: 4500,
      SAR: 11500,
      QAR: 11000,
      GBP: 2499,
    },
    stripePriceIds: {
      USD: "price_1SrmEoDM2LpFBnooi5Uw7Wvh",
      EUR: "price_1SrmEpDM2LpFBnooFxiPtdMz",
      CAD: "price_1SrmEpDM2LpFBnoox5s4X7jK",
      INR: "price_1SrmEpDM2LpFBnootNOOU6NV",
      AED: "price_1SrmEqDM2LpFBnoojgMmN8jc",
      MYR: "price_1SrmEqDM2LpFBnoonIXBTcmX",
      AUD: "price_1SrmEqDM2LpFBnoomiAYNRTh",
      SAR: "price_1SrmErDM2LpFBnooYHbodUSU",
      QAR: "price_1SrmErDM2LpFBnoooxPj6avG",
      GBP: "price_1SrmEsDM2LpFBnooQCmzrAXh"
    }
  },
  semiannual: {
    id: 'semiannual',
    name: '6 Months',
    period: '6 months',
    savings: 'Save 15%',
    features: ['Everything in Monthly', 'Priority Email Support', 'Onboarding Session'],
    prices: {
      USD: 14999,
      EUR: 13999,
      CAD: 19999,
      INR: 1249900,
      AED: 55000,
      MYR: 65000,
      AUD: 22500,
      SAR: 57500,
      QAR: 55000,
      GBP: 12499,
    },
    stripePriceIds: {
      USD: "price_1SrmEsDM2LpFBnoo4Mq0UDEr",
      EUR: "price_1SrmEtDM2LpFBnootVVFOdoD",
      CAD: "price_1SrmEtDM2LpFBnoo7CKKgNxp",
      INR: "price_1SrmEtDM2LpFBnooB8NBAeDf",
      AED: "price_1SrmEuDM2LpFBnoo4phRUd15",
      MYR: "price_1SrmEuDM2LpFBnoodGE6JblH",
      AUD: "price_1SrmEuDM2LpFBnooVFASNpil",
      SAR: "price_1SrmEvDM2LpFBnooYZWstgKI",
      QAR: "price_1SrmEvDM2LpFBnooX2RoOcSr",
      GBP: "price_1SrmEvDM2LpFBnooJzfWYWQY"
    }
  },
  annual: {
    id: 'annual',
    name: 'Yearly',
    period: 'year',
    savings: 'Save 30%',
    features: ['Everything in 6 Months', 'Dedicated Account Manager', 'Custom Integrations', 'White-label Options'],
    prices: {
      USD: 24999,
      EUR: 22999,
      CAD: 32999,
      INR: 2099900,
      AED: 92000,
      MYR: 110000,
      AUD: 38000,
      SAR: 95000,
      QAR: 92000,
      GBP: 19999,
    },
    stripePriceIds: {
      USD: "price_1SrmEwDM2LpFBnooOhoolJDp",
      EUR: "price_1SrmEwDM2LpFBnoobPSTMETw",
      CAD: "price_1SrmExDM2LpFBnooztZix0uC",
      INR: "price_1SrmExDM2LpFBnooMOkEVGdB",
      AED: "price_1SrmExDM2LpFBnoo6YkC20BK",
      MYR: "price_1SrmEyDM2LpFBnooQUBn2zPA",
      AUD: "price_1SrmEyDM2LpFBnoovxHCOs3R",
      SAR: "price_1SrmEyDM2LpFBnook5wpuzvj",
      QAR: "price_1SrmEzDM2LpFBnoowHO038Yr",
      GBP: "price_1SrmEzDM2LpFBnooF45I4NBa"
    }
  }
};

// --- HARDWARE PRICING (One-Time Purchases) ---
export const HARDWARE_PRICING = {
  starter_kit: {
    id: 'starter_kit',
    name: 'Restaurant Starter Kit',
    prices: {
      USD: 1500,
      EUR: 1400,
      CAD: 2000,
      INR: 120000,
      AED: 5000,
      MYR: 6000,
      AUD: 2200,
      SAR: 5000,
      QAR: 5000,
      GBP: 1200
    },
    priceIds: {
      USD: "price_1Sspg0DM2LpFBnooehGazaBV",
      EUR: "price_1Sspg0DM2LpFBnooPubgf59q",
      CAD: "price_1Sspg0DM2LpFBnoolyMeBhwg",
      INR: "price_1Sspg1DM2LpFBnoohhwT38jr",
      AED: "price_1Sspg1DM2LpFBnoo9fuGmQGo",
      MYR: "price_1Sspg1DM2LpFBnooyJsQXZf3",
      AUD: "price_1Sspg2DM2LpFBnoo9TCwpE8y",
      SAR: "price_1Sspg2DM2LpFBnooEAPPxvlu",
      QAR: "price_1Sspg2DM2LpFBnoo938NtnpY",
      GBP: "price_1Sspg3DM2LpFBnoojOWKO2KM"
    }
  },
  tablet_bundle: {
    id: 'tablet_bundle',
    name: 'Samsung Tablet A9 Bundle',
    prices: {
      USD: 14900,
      EUR: 13900,
      CAD: 19900,
      INR: 1250000,
      AED: 49900,
      MYR: 69900,
      AUD: 22900,
      SAR: 55000,
      QAR: 55000,
      GBP: 11900
    },
    priceIds: {
      USD: "price_1Sspg3DM2LpFBnooPcidJZx1",
      EUR: "price_1Sspg4DM2LpFBnoonDlr9Cdj",
      CAD: "price_1Sspg4DM2LpFBnooC9bJuXCG",
      INR: "price_1Sspg4DM2LpFBnoor7QV4yZI",
      AED: "price_1Sspg5DM2LpFBnooKdaZMV60",
      MYR: "price_1Sspg5DM2LpFBnooCwjun21R",
      AUD: "price_1Sspg5DM2LpFBnoo6BGBhXzJ",
      SAR: "price_1Sspg6DM2LpFBnooy9PGfCbi",
      QAR: "price_1Sspg6DM2LpFBnoom87Um6S2",
      GBP: "price_1Sspg6DM2LpFBnoomyUtRRQB"
    }
  }
};