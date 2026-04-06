import { supabase } from '@/lib/supabase'
import type {
  OrderListItem,
  OrderWithItems,
  OrderStatus,
  PaymentStatus,
} from '@/modules/orders/types/orders'
import { sendOrderStatusEmail } from '@/modules/orders/services/email.service'

// ─────────────────────────────────────────────────────────────────────────────
// List
// ─────────────────────────────────────────────────────────────────────────────

export interface ListOrdersParams {
  search?:        string
  status?:        OrderStatus | ''
  paymentStatus?: PaymentStatus | ''
  page?:          number
  pageSize?:      number
}

export async function listOrders(params: ListOrdersParams = {}): Promise<{
  data:  OrderListItem[]
  count: number
}> {
  const { search, status, paymentStatus, page = 1, pageSize = 25 } = params
  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  let query = supabase
    .from('orders')
    .select(
      'id, order_number, customer_name, customer_email, customer_phone, total, status, payment_status, payment_method, created_at',
      { count: 'exact' },
    )
    .range(from, to)
    .order('created_at', { ascending: false })

  if (status)        query = query.eq('status', status)
  if (paymentStatus) query = query.eq('payment_status', paymentStatus)
  if (search) {
    query = query.or(
      `order_number.ilike.%${search}%,customer_email.ilike.%${search}%`,
    )
  }

  const { data, error, count } = await query
  if (error) throw error
  return { data: (data ?? []) as OrderListItem[], count: count ?? 0 }
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail
// ─────────────────────────────────────────────────────────────────────────────

export async function getOrder(id: string): Promise<OrderWithItems | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      items:order_items ( * ),
      history:order_status_history ( * )
    `)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as unknown as OrderWithItems
}

// ─────────────────────────────────────────────────────────────────────────────
// Status updates — each writes to orders AND appends a history record
// ─────────────────────────────────────────────────────────────────────────────

export interface CustomerInfo {
  email:       string
  name:        string
  orderNumber: string
}

export async function updateOrderStatus(
  id:             string,
  previousStatus: OrderStatus,
  newStatus:      OrderStatus,
  comment?:       string,
  customer?:      CustomerInfo,
): Promise<void> {
  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: newStatus })
    .eq('id', id)
  if (updateError) throw updateError

  const { error: historyError } = await supabase
    .from('order_status_history')
    .insert({
      order_id:       id,
      field:          'status',
      previous_value: previousStatus,
      new_value:      newStatus,
      comment:        comment?.trim() || null,
    })
  if (historyError) throw historyError

  // Send customer notification — fire-and-forget
  if (customer) {
    sendOrderStatusEmail(customer.orderNumber, customer.name, customer.email, newStatus)
  }
}

export async function updatePaymentStatus(
  id:             string,
  previousStatus: PaymentStatus,
  newStatus:      PaymentStatus,
  comment?:       string,
): Promise<void> {
  const { error: updateError } = await supabase
    .from('orders')
    .update({ payment_status: newStatus })
    .eq('id', id)
  if (updateError) throw updateError

  const { error: historyError } = await supabase
    .from('order_status_history')
    .insert({
      order_id:       id,
      field:          'payment_status',
      previous_value: previousStatus,
      new_value:      newStatus,
      comment:        comment?.trim() || null,
    })
  if (historyError) throw historyError
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin notes (free-form text, not logged in history)
// ─────────────────────────────────────────────────────────────────────────────

export async function addAdminNote(id: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ admin_notes: notes.trim() || null })
    .eq('id', id)
  if (error) throw error
}
