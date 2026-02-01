import { supabase } from '../lib/supabase';
import { HARDWARE_PRICING, DEFAULT_CURRENCY, CurrencyCode } from '../constants/currencyConfig';

export interface DeliveryAddress {
  addressLine1: string;
  addressLine2: string;
  city: string;
  emirate: string;
  contactNumber: string;
}

export interface StarterPackOrder {
  id: string;
  user_id: string;
  restaurant_id?: string;
  restaurant_name?: string;
  order_status: 'pending' | 'received' | 'preparing' | 'configuring' | 'out_for_delivery' | 'delivered';
  includes_tablet: boolean;
  tablet_cost: number;
  base_pack_cost: number;
  total_cost: number;
  payment_status: 'pending' | 'completed' | 'failed';
  stripe_payment_intent_id?: string;
  estimated_delivery?: string;
  delivered_at?: string;
  delivery_address_line1?: string;
  delivery_address_line2?: string;
  delivery_city?: string;
  delivery_emirate?: string;
  delivery_contact_number?: string;
  proof_of_delivery_url?: string;
  is_first_free_order?: boolean;
  status_timestamps?: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export class StarterPackService {
  
  // --- INTERNAL HELPER: Get Raw Cents (e.g. 69900) ---
  // Returns the exact integer from your config file
  private static getCents(item: 'starter_kit' | 'tablet_bundle', currency: string): number {
    const code = (currency || DEFAULT_CURRENCY) as CurrencyCode;
    // @ts-ignore - Config is strictly typed, this lookup is safe
    const priceMap = HARDWARE_PRICING[item].prices;
    return priceMap[code] || priceMap[DEFAULT_CURRENCY];
  }

  // --- UI HELPER: Get Display Units (e.g. 699.00) ---
  // Use this for displaying prices on screen and saving to DB (readability)
  static getDisplayPrice(item: 'starter_kit' | 'tablet_bundle', currency: string): number {
    return this.getCents(item, currency) / 100;
  }

  // --- ✅ PAYMENT HELPER: Get Total in CENTS (e.g. 75900) ---
  // This is used ONLY for sending to Stripe/Backend. Safe integer math.
  static calculateStripeAmount(isFirstOrder: boolean, hasActivePaidSubscription: boolean, includesTablet: boolean, currency: string): number {
    const basePackCents = (isFirstOrder && hasActivePaidSubscription)
      ? 0
      : this.getCents('starter_kit', currency);
      
    const tabletCents = includesTablet ? this.getCents('tablet_bundle', currency) : 0;
    
    return basePackCents + tabletCents;
  }

  // --- UI HELPER: Get Total in UNITS (e.g. 759.00) ---
  static calculateOrderAmount(isFirstOrder: boolean, hasActivePaidSubscription: boolean, includesTablet: boolean, currency: string): number {
    return this.calculateStripeAmount(isFirstOrder, hasActivePaidSubscription, includesTablet, currency) / 100;
  }

  static async createOrder(
    userId: string,
    includesTablet: boolean,
    deliveryAddress: DeliveryAddress,
    currency: string,
    restaurantId?: string
  ): Promise<StarterPackOrder> {
    try {
      const isFirstOrder = await this.isFirstOrder(userId);
      const hasActivePaidSubscription = await this.hasActivePaidSubscription(userId);

      // Save DISPLAY PRICE (Units) to Database for readability
      const basePackCost = (isFirstOrder && hasActivePaidSubscription)
        ? 0
        : this.getDisplayPrice('starter_kit', currency);
        
      const tabletCost = includesTablet ? this.getDisplayPrice('tablet_bundle', currency) : 0;
      const totalCost = basePackCost + tabletCost;

      let restaurantName = 'Unknown Restaurant';
      if (restaurantId) {
        const { data: restaurant } = await supabase.from('restaurants').select('name').eq('id', restaurantId).maybeSingle();
        if (restaurant) restaurantName = restaurant.name;
      } else {
        const { data: restaurant } = await supabase.from('restaurants').select('id, name').eq('owner_id', userId).maybeSingle();
        if (restaurant) {
          restaurantId = restaurant.id;
          restaurantName = restaurant.name;
        }
      }

      const estimatedDelivery = this.calculateEstimatedDeliveryDate(new Date());
      const needsPayment = totalCost > 0;

      const { data, error } = await supabase
        .from('starter_pack_orders')
        .insert({
          user_id: userId,
          restaurant_id: restaurantId || null,
          restaurant_name: restaurantName,
          includes_tablet: includesTablet,
          tablet_cost: tabletCost,
          base_pack_cost: basePackCost,
          total_cost: totalCost,
          order_status: 'received',
          payment_status: needsPayment ? 'pending' : 'completed',
          is_first_free_order: isFirstOrder && hasActivePaidSubscription && basePackCost === 0,
          estimated_delivery: estimatedDelivery.toISOString(),
          delivery_address_line1: deliveryAddress.addressLine1,
          delivery_address_line2: deliveryAddress.addressLine2,
          delivery_city: deliveryAddress.city,
          delivery_emirate: deliveryAddress.emirate,
          delivery_contact_number: deliveryAddress.contactNumber,
          status_timestamps: JSON.stringify({ received: new Date().toISOString() })
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error creating starter pack order:', error);
      throw error;
    }
  }

  static async updateOrderPaymentStatus(orderId: string, paymentIntentId: string, status: 'completed' | 'failed'): Promise<void> {
    const updateData: any = { payment_status: status, stripe_payment_intent_id: paymentIntentId };
    if (status === 'completed') updateData.order_status = 'received';
    await supabase.from('starter_pack_orders').update(updateData).eq('id', orderId);
  }

  static async getUserOrders(userId: string): Promise<StarterPackOrder[]> {
    const { data } = await supabase.from('starter_pack_orders').select('*').eq('user_id', userId).eq('payment_status', 'completed').order('created_at', { ascending: false });
    return data || [];
  }

  static async getOrderById(orderId: string): Promise<StarterPackOrder | null> {
    const { data } = await supabase.from('starter_pack_orders').select('*').eq('id', orderId).maybeSingle();
    return data;
  }

  static async updateOrderStatus(
    orderId: string,
    status: 'pending' | 'received' | 'preparing' | 'configuring' | 'out_for_delivery' | 'delivered'
  ): Promise<void> {
    const { data: order } = await supabase.from('starter_pack_orders').select('status_timestamps').eq('id', orderId).maybeSingle();
    let timestamps: Record<string, string> = {};
    if (order?.status_timestamps) {
      if (typeof order.status_timestamps === 'string') timestamps = JSON.parse(order.status_timestamps);
      else timestamps = order.status_timestamps;
    }
    timestamps[status] = new Date().toISOString();
    const updateData: any = { order_status: status, status_timestamps: timestamps };
    if (status === 'delivered') updateData.delivered_at = new Date().toISOString();
    await supabase.from('starter_pack_orders').update(updateData).eq('id', orderId);
  }

  static async getAllOrders(): Promise<StarterPackOrder[]> {
    const { data } = await supabase.rpc('get_all_starter_pack_orders_admin');
    return data || [];
  }

  // --- UI Accessors ---
  static getTabletCost(currency: string): number { return this.getDisplayPrice('tablet_bundle', currency); }
  static getBasePackCost(currency: string): number { return this.getDisplayPrice('starter_kit', currency); }
  
  static async calculateTotalCost(userId: string, includesTablet: boolean, currency: string): Promise<number> {
    return this.calculateOrderAmount(await this.isFirstOrder(userId), await this.hasActivePaidSubscription(userId), includesTablet, currency);
  }
  
  static calculateTotalCostSync(isFirstOrder: boolean, hasActivePaidSubscription: boolean, includesTablet: boolean, currency: string): number {
    return this.calculateOrderAmount(isFirstOrder, hasActivePaidSubscription, includesTablet, currency);
  }

  static getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pending',
      received: 'Order Received',
      preparing: 'Preparing',
      configuring: 'Configuring',
      out_for_delivery: 'Out for Delivery',
      delivered: 'Delivered'
    };
    return labels[status] || status;
  }

  static getStatusIndex(status: string): number {
    const statuses = ['pending', 'received', 'preparing', 'configuring', 'out_for_delivery', 'delivered'];
    return statuses.indexOf(status);
  }

  static async uploadProofOfDelivery(
    orderId: string,
    file: File
  ): Promise<string> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${orderId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('starter-pack-deliveries')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('starter-pack-deliveries')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('starter_pack_orders')
        .update({ proof_of_delivery_url: data.publicUrl })
        .eq('id', orderId);

      if (updateError) throw updateError;

      return data.publicUrl;
    } catch (error: any) {
      console.error('Error uploading proof of delivery:', error);
      throw error;
    }
  }

  static calculateEstimatedDeliveryDate(orderDate: Date): Date {
    const order = new Date(orderDate);
    let deliveryDate = new Date(order);
    const orderHour = order.getHours();
    if (orderHour >= 17) {
      deliveryDate.setDate(deliveryDate.getDate() + 1);
      deliveryDate.setHours(10, 0, 0, 0);
    } else {
      deliveryDate.setHours(orderHour + 9, 0, 0, 0);
    }
    while (deliveryDate.getDay() === 0 || deliveryDate.getDay() === 6) {
      deliveryDate.setDate(deliveryDate.getDate() + 1);
      deliveryDate.setHours(10, 0, 0, 0);
    }
    return deliveryDate;
  }

  static calculateEstimatedDelivery(orderDate: string): Date {
    return this.calculateEstimatedDeliveryDate(new Date(orderDate));
  }

  static isDelayed(orderDate: string, currentStatus: string, estimatedDelivery: string): boolean {
    if (currentStatus === 'delivered' || currentStatus === 'out_for_delivery') return false;
    return new Date() > new Date(estimatedDelivery);
  }

  static getDelayMessage(estimatedDelivery: string): string {
    const delayHours = Math.floor((new Date().getTime() - new Date(estimatedDelivery).getTime()) / (1000 * 60 * 60));
    if (delayHours < 1) return 'Your order is slightly delayed. We apologize for the inconvenience.';
    if (delayHours < 3) return `Your order is delayed by approximately ${delayHours} hour${delayHours > 1 ? 's' : ''}. Our team is working to get it to you as soon as possible.`;
    return `We sincerely apologize for the delay. Your order is taking longer than expected. Please contact support for more information.`;
  }

  static async isFirstOrder(userId: string): Promise<boolean> {
    const { data } = await supabase.from('starter_pack_orders').select('id').eq('user_id', userId).eq('payment_status', 'completed').limit(1).maybeSingle();
    return !data;
  }

  static async hasActivePaidSubscription(userId: string): Promise<boolean> {
    const { data } = await supabase.from('subscriptions').select('plan_type, status').eq('user_id', userId).eq('status', 'active').maybeSingle();
    return data?.plan_type !== 'trial';
  }
}