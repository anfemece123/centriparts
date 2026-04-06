import { supabase } from '@/lib/supabase'
import type { PublicOrderView } from '@/modules/orders/types/orders'

/**
 * Calls the SECURITY DEFINER get_order_for_tracking() PostgreSQL function.
 * Returns the public order view when BOTH order_number AND email match.
 * Returns null on any mismatch — no distinction between "wrong number" and
 * "wrong email" to prevent order enumeration.
 */
export async function getOrderForTracking(
  orderNumber: string,
  email: string,
): Promise<PublicOrderView | null> {
  const { data, error } = await supabase.rpc('get_order_for_tracking', {
    p_order_number: orderNumber.trim().toUpperCase(),
    p_email:        email.trim().toLowerCase(),
  })

  if (error) throw error
  return (data as PublicOrderView | null)
}
