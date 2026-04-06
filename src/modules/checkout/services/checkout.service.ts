import { supabase } from '@/lib/supabase'
import type { CreateOrderPayload } from '@/modules/orders/types/orders'
import { sendOrderCreatedEmails } from '@/modules/orders/services/email.service'

/**
 * Creates an order and its line items in a single logical transaction.
 *
 * Flow:
 *   1. Insert the `orders` row — the DB generates order_number via the
 *      generate_order_number() function and seeds order_status_history
 *      via the orders_record_initial_status trigger.
 *   2. Insert all `order_items` rows using the returned order id.
 *
 * Returns the human-readable order_number on success.
 * Throws on any Supabase error so the caller can surface it to the user.
 */
export async function createOrder(
  payload: CreateOrderPayload,
): Promise<{ orderNumber: string }> {
  const { items, ...orderFields } = payload

  // ── Step 1: insert the order header ──────────────────────────────────
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert(orderFields)
    .select('id, order_number')
    .single()

  if (orderError || !order) {
    throw orderError ?? new Error('No se pudo crear el pedido.')
  }

  // ── Step 2: insert all order item rows ───────────────────────────────
  const itemRows = items.map((item) => ({
    order_id:          order.id,
    product_id:        item.product_id,
    product_name:      item.product_name,
    product_ci:        item.product_ci,
    product_reference: item.product_reference,
    quantity:          item.quantity,
    unit_price:        item.unit_price,
    subtotal:          item.subtotal,
  }))

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(itemRows)

  if (itemsError) {
    throw itemsError
  }

  // Send notifications — fire-and-forget, never block the order creation flow
  sendOrderCreatedEmails(order.id, order.order_number, payload)

  return { orderNumber: order.order_number }
}
