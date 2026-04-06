// ─────────────────────────────────────────────────────────────────────────────
// Status and method unions
// Values must match the CHECK constraints in the database exactly.
// ─────────────────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'    // placed by customer, awaiting admin review
  | 'confirmed'  // admin confirmed — payment received or agreed
  | 'preparing'  // being assembled or packed
  | 'shipped'    // dispatched to customer
  | 'delivered'  // customer confirmed receipt
  | 'cancelled'  // cancelled (only from pending / confirmed / preparing)

export type PaymentStatus =
  | 'pending'    // awaiting payment
  | 'confirmed'  // admin verified payment
  | 'failed'     // payment not received
  | 'refunded'   // payment returned to customer

export type PaymentMethod =
  | 'transfer'   // bank transfer
  | 'nequi'
  | 'daviplata'
  | 'cash'       // contra entrega / COD
  | 'other'

// ─────────────────────────────────────────────────────────────────────────────
// Base table shapes — mirror the database columns exactly
// ─────────────────────────────────────────────────────────────────────────────

export interface Order {
  id: string
  order_number: string

  // Customer
  customer_name: string
  customer_email: string
  customer_phone: string | null

  // Shipping address (denormalized snapshot)
  shipping_address: string
  shipping_city: string
  shipping_department: string
  shipping_country: string

  // Financials
  subtotal: number
  shipping_cost: number
  total: number

  // Status
  status: OrderStatus
  payment_status: PaymentStatus
  payment_method: PaymentMethod | null

  // Notes
  customer_notes: string | null
  admin_notes: string | null

  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null  // null if the product was deleted from the catalog

  // Immutable product snapshot recorded at time of purchase
  product_name: string
  product_ci: string | null
  product_reference: string | null

  quantity: number
  unit_price: number
  subtotal: number

  created_at: string
}

export interface OrderStatusHistory {
  id: string
  order_id: string
  field: 'status' | 'payment_status'
  previous_value: string | null  // null on the initial creation entry
  new_value: string
  comment: string | null
  created_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Composed shapes used in services and UI
// ─────────────────────────────────────────────────────────────────────────────

/** Full order as returned by the admin detail view. */
export interface OrderWithItems extends Order {
  items: OrderItem[]
  history: OrderStatusHistory[]
}

/** Shape for the admin order list — subset of Order, no items or history. */
export interface OrderListItem {
  id: string
  order_number: string
  customer_name: string
  customer_email: string
  customer_phone: string | null
  total: number
  status: OrderStatus
  payment_status: PaymentStatus
  payment_method: PaymentMethod | null
  created_at: string
}

/** Returned by the get_order_for_tracking() Postgres function.
 *  Intentionally omits customer_email, customer_phone, and full address
 *  to avoid exposing PII on the public tracking page. */
export interface PublicOrderView {
  id: string
  order_number: string
  customer_name: string
  status: OrderStatus
  payment_status: PaymentStatus
  payment_method: PaymentMethod | null
  subtotal: number
  shipping_cost: number
  total: number
  shipping_city: string
  shipping_department: string
  customer_notes: string | null
  created_at: string
  items: PublicOrderItem[]
  history: PublicOrderHistoryEntry[]
}

/** Order item as returned by the tracking function — no internal IDs. */
export interface PublicOrderItem {
  product_name: string
  product_reference: string | null
  product_ci: string | null
  quantity: number
  unit_price: number
  subtotal: number
}

/** Status history entry as returned by the tracking function. */
export interface PublicOrderHistoryEntry {
  field: 'status' | 'payment_status'
  previous_value: string | null
  new_value: string
  comment: string | null
  created_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkout payload — what the frontend sends to createOrder()
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateOrderItemPayload {
  product_id: string | null
  product_name: string
  product_ci: string | null
  product_reference: string | null
  quantity: number
  unit_price: number
  subtotal: number
}

export interface CreateOrderPayload {
  customer_name: string
  customer_email: string
  customer_phone: string | null
  shipping_address: string
  shipping_city: string
  shipping_department: string
  shipping_country: string
  subtotal: number
  shipping_cost: number
  total: number
  payment_method: PaymentMethod
  customer_notes: string | null
  items: CreateOrderItemPayload[]
}
