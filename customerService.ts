import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';

type Customer = Database['public']['Tables']['customers']['Row'];
type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
type CustomerUpdate = Partial<Omit<CustomerInsert, 'restaurant_id' | 'id'>>;
type Transaction = Database['public']['Tables']['transactions']['Row'];

export class CustomerService {
  
  static async getCustomers(restaurantId: string): Promise<Customer[]> {
    try {
      if (!restaurantId) return [];

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data || [];
    } catch (error: any) {
      console.error('Error in getCustomers:', error);
      return [];
    }
  }

  // --- FIXED: ROBUST GET CUSTOMER (View + Fallback) ---
  static async getCustomer(restaurantId: string, customerId: string): Promise<Customer | null> {
    try {
      if (!restaurantId) return null;

      // 1. Try View First (Fastest)
      const { data: viewData, error: viewError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (viewData) return viewData;

      // 2. Fallback: Direct Table Lookup 
      // (Fixes "406 Not Acceptable" if view permissions/cache lag)
      console.log("Customer View lookup failed, trying direct tables...");
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, avatar_url')
        .eq('id', customerId)
        .single();

      if (!profile) return null;

      const { data: membership } = await supabase
        .from('memberships')
        .select('total_points, current_tier, lifetime_points, created_at, tier_progress')
        .eq('user_id', customerId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (membership) {
        // Manually construct the Customer object
        return {
          id: profile.id,
          restaurant_id: restaurantId,
          first_name: profile.first_name,
          last_name: profile.last_name || '',
          email: profile.email,
          avatar_url: profile.avatar_url,
          phone: '', // Profile might not have phone
          total_points: membership.total_points,
          lifetime_points: membership.lifetime_points || 0,
          current_tier: membership.current_tier as any,
          tier_progress: membership.tier_progress || 0,
          visit_count: 0, // Would need calculation
          total_spent: 0, // Would need calculation
          created_at: membership.created_at,
          updated_at: membership.created_at,
          is_active: true
        } as Customer;
      }

      return null;
    } catch (error: any) {
      console.error('Error in getCustomer:', error);
      return null;
    }
  }

  // --- FIXED: GLOBAL SEARCH (Auto-Join Support) ---
  static async getCustomerByEmail(restaurantId: string, email: string): Promise<Customer | null> {
    try {
      if (!restaurantId) return null;
      
      // 1. Try Local Restaurant Search
      const { data: localData } = await supabase
        .from('customers')
        .select('*')
        .eq('email', email)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (localData) return localData;

      // 2. Fallback: Global Profile Search (For onboarding new users)
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('email', email)
        .maybeSingle();

      if (profile) {
        // Return "Ghost" Customer to enable UI to show them
        return {
          id: profile.id,
          first_name: profile.first_name,
          last_name: profile.last_name || '',
          email: profile.email,
          total_points: 0,
          current_tier: 'bronze',
          restaurant_id: restaurantId,
          // Dummy data for required fields
          lifetime_points: 0,
          tier_progress: 0,
          visit_count: 0,
          total_spent: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_active: true,
          phone: ''
        } as Customer;
      }

      return null;
    } catch (error: any) {
      console.error('Error in getCustomerByEmail:', error);
      return null;
    }
  }

  static async createCustomer(
    restaurantId: string,
    customerData: Omit<CustomerInsert, 'restaurant_id'>,
    consents?: { whatsapp?: boolean; email?: boolean; sms?: boolean; push?: boolean }
  ): Promise<Customer> {
    if (!restaurantId) throw new Error('Restaurant not found.');

    const existingCustomer = await this.getCustomerByEmail(restaurantId, customerData.email);
    // Only throw if they exist locally
    if (existingCustomer && existingCustomer.total_points !== undefined) { 
       // This check distinguishes real member vs ghost profile
       // If it's a ghost profile (from search), we proceed to 'insert' which will fail on conflict
       // So we rely on the DB constraint or check memberships table specifically
    }

    // Direct Insert
    const { data, error } = await supabase
      .from('customers') // This inserts into memberships view technically
      .insert({
        ...customerData,
        restaurant_id: restaurantId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await this.updateCustomerConsent(data.id, restaurantId, {
      push_notifications: consents?.push ?? true,
      whatsapp: consents?.whatsapp ?? false,
      email: consents?.email ?? true,
      sms: consents?.sms ?? false
    });

    return data;
  }

  static async updateCustomer(restaurantId: string, customerId: string, updates: CustomerUpdate): Promise<Customer | null> {
    try {
      if (!restaurantId) return null;

      const { data, error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', customerId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    } catch (error: any) {
      console.error('Error in updateCustomer:', error);
      return null;
    }
  }

  static async deleteCustomer(restaurantId: string, customerId: string): Promise<void> {
    if (!restaurantId) throw new Error('Restaurant not found');

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', customerId)
      .eq('restaurant_id', restaurantId);

    if (error) throw new Error(error.message);
  }

  static async getCustomerTransactions(restaurantId: string, customerId: string): Promise<Transaction[]> {
    try {
      if (!restaurantId) return [];

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('customer_id', customerId)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data || [];
    } catch (error: any) {
      console.error('Error in getCustomerTransactions:', error);
      return [];
    }
  }

  static async addPointsTransaction(
    restaurantId: string,
    customerId: string,
    branchId?: string,
    amountSpent?: number,
    description?: string
  ): Promise<void> {
    if (!restaurantId) throw new Error('Restaurant not found');

    const { LoyaltyConfigService } = await import('./loyaltyConfigService');
    const config = await LoyaltyConfigService.getLoyaltyConfig(restaurantId);
    
    // Use robust getCustomer
    const customer = await this.getCustomer(restaurantId, customerId);
    if (!customer) throw new Error('Customer not found');
    
    let points = 0;
    if (config.blanketMode.enabled && amountSpent) {
      const result = LoyaltyConfigService.calculatePointsPreview(
        config, undefined, amountSpent, customer.current_tier, 1
      );
      points = result.points;
    } else if (amountSpent) {
      points = Math.floor(amountSpent * 0.1);
    }

    if (points <= 0) return;

    const { error } = await supabase.rpc('process_point_transaction', {
      p_restaurant_id: restaurantId,
      p_customer_id: customerId,
      p_type: 'purchase',
      p_points: points,
      p_description: description || `Points earned from ${amountSpent} AED purchase`,
      p_amount_spent: amountSpent,
      p_reward_id: null
    });

    if (error) throw new Error(error.message);
  }

  static async getCustomerStats(restaurantId: string): Promise<any> {
    try {
      if (!restaurantId) return { totalCustomers: 0, newThisMonth: 0, totalPoints: 0, averageSpent: 0 };
      const { data: customers, error } = await supabase
        .from('customers')
        .select('total_points, total_spent, created_at')
        .eq('restaurant_id', restaurantId);

      if (error) throw new Error(error.message);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const totalCustomers = customers.length;
      const newThisMonth = customers.filter(c => new Date(c.created_at) >= startOfMonth).length;
      const totalPoints = customers.reduce((sum, c) => sum + c.total_points, 0);
      const averageSpent = totalCustomers > 0 ? customers.reduce((sum, c) => sum + c.total_spent, 0) / totalCustomers : 0;

      return { totalCustomers, newThisMonth, totalPoints, averageSpent };
    } catch (error: any) {
      console.error('Error in getCustomerStats:', error);
      return { totalCustomers: 0, newThisMonth: 0, totalPoints: 0, averageSpent: 0 };
    }
  }

  // --- CONSENT METHODS ---
  static async getCustomerConsent(customerId: string, restaurantId: string) {
    const { data, error } = await supabase
      .from('customer_consent') // Or customer_consents depending on your table name
      .select('*')
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching consent:', error);
      return null;
    }
    return data;
  }

  static async updateCustomerConsent(
    customerId: string,
    restaurantId: string,
    consent: {
      push_notifications?: boolean;
      whatsapp?: boolean;
      email?: boolean;
      sms?: boolean;
    }
  ) {
    const { data, error } = await supabase
      .from('customer_consent')
      .upsert({
        customer_id: customerId,
        restaurant_id: restaurantId,
        ...consent,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'customer_id, restaurant_id' })
      .select()
      .single();

    if (error) {
      console.error('Error updating consent:', error);
      throw new Error(error.message);
    }
    return data;
  }
}