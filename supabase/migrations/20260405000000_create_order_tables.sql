-- ============================================================
-- Order system: orders, order_items, order_status_history
-- ============================================================


-- ============================================================
-- ORDER NUMBER SEQUENCE + GENERATOR
-- ============================================================

-- Global monotonically increasing sequence.
-- The YYYYMM prefix in the output is cosmetic (date of creation).
-- The sequence never resets, so order_number is always unique.
-- Example: CPT-202604-00001
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT
    'CPT-'
    || TO_CHAR(NOW(), 'YYYYMM')
    || '-'
    || LPAD(nextval('order_number_seq')::text, 5, '0')
$$;


-- ============================================================
-- ORDERS
-- ============================================================

CREATE TABLE orders (
  id                  uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number        text           NOT NULL UNIQUE DEFAULT generate_order_number(),

  -- Customer (guest checkout — no account required)
  customer_name       text           NOT NULL,
  customer_email      text           NOT NULL,
  customer_phone      text,

  -- Shipping address stored as a snapshot.
  -- Denormalized intentionally: an order must permanently record the
  -- exact address at the time of purchase, regardless of future changes.
  shipping_address    text           NOT NULL,
  shipping_city       text           NOT NULL,
  shipping_department text           NOT NULL,
  shipping_country    text           NOT NULL DEFAULT 'Colombia',

  -- Financials
  subtotal            numeric(12,2)  NOT NULL CHECK (subtotal     >= 0),
  shipping_cost       numeric(12,2)  NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  total               numeric(12,2)  NOT NULL CHECK (total        >= 0),

  -- Order lifecycle status
  status              text           NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',    -- placed by customer, awaiting admin review
      'confirmed',  -- admin confirmed (payment received or agreed)
      'preparing',  -- being assembled or packed
      'shipped',    -- dispatched to customer
      'delivered',  -- customer confirmed receipt
      'cancelled'   -- cancelled (only allowed from pending/confirmed/preparing)
    )),

  -- Payment status (tracked independently from order status)
  payment_status      text           NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN (
      'pending',    -- awaiting payment
      'confirmed',  -- admin verified payment (transfer, Nequi screenshot, etc.)
      'failed',     -- payment not received
      'refunded'    -- payment returned to customer
    )),

  payment_method      text
    CHECK (payment_method IN (
      'transfer',   -- bank transfer (Bancolombia, Davivienda, etc.)
      'nequi',
      'daviplata',
      'cash',       -- contra entrega / cash on delivery
      'other'
    )),

  -- Notes
  customer_notes      text,  -- entered by customer at checkout, visible to admin
  admin_notes         text,  -- internal only, never shown to customer

  created_at          timestamptz    NOT NULL DEFAULT now(),
  updated_at          timestamptz    NOT NULL DEFAULT now()
);

-- Reuse the set_updated_at() function defined in the catalog migration.
CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_orders_status         ON orders (status);
CREATE INDEX idx_orders_payment_status ON orders (payment_status);
CREATE INDEX idx_orders_customer_email ON orders (customer_email);
CREATE INDEX idx_orders_created_at     ON orders (created_at DESC);
-- order_number has a UNIQUE constraint which creates its own index automatically.


-- ============================================================
-- ORDER ITEMS
-- ============================================================

CREATE TABLE order_items (
  id                uuid           PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Cascade: deleting an order removes all its items.
  order_id          uuid           NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- SET NULL: if a product is later deleted from the catalog, the
  -- order line still exists. The snapshot columns below preserve the data.
  product_id        uuid           REFERENCES products(id) ON DELETE SET NULL,

  -- Immutable product snapshot at the time of purchase.
  -- These columns record what was sold and at what price, permanently.
  product_name      text           NOT NULL,
  product_ci        text,
  product_reference text,

  quantity          integer        NOT NULL CHECK (quantity   > 0),
  unit_price        numeric(12,2)  NOT NULL CHECK (unit_price >= 0),
  subtotal          numeric(12,2)  NOT NULL CHECK (subtotal   >= 0),
  -- subtotal = quantity * unit_price, enforced by the application layer.

  created_at        timestamptz    NOT NULL DEFAULT now()
);

-- PostgreSQL does NOT auto-create indexes on FK referencing columns.
CREATE INDEX idx_order_items_order_id   ON order_items (order_id);
CREATE INDEX idx_order_items_product_id ON order_items (product_id);


-- ============================================================
-- ORDER STATUS HISTORY
-- ============================================================

-- Append-only audit trail of every status change on an order.
-- Covers changes to both `status` and `payment_status`.
-- Drives the customer-facing order timeline and the admin activity log.
-- Rows are never updated or deleted.
CREATE TABLE order_status_history (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  order_id        uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  field           text        NOT NULL
    CHECK (field IN ('status', 'payment_status')),

  previous_value  text,       -- NULL for the initial creation entry
  new_value       text        NOT NULL,
  comment         text,       -- optional admin note recorded at transition time

  created_at      timestamptz NOT NULL DEFAULT now()
  -- No updated_at: this table is intentionally append-only.
);

CREATE INDEX idx_order_status_history_order_id ON order_status_history (order_id, created_at);


-- ============================================================
-- INITIAL STATUS HISTORY TRIGGER
-- ============================================================

-- Automatically inserts the first history row when an order is created.
-- This seeds the status timeline from order creation without requiring
-- a second database call from the application during checkout.
CREATE OR REPLACE FUNCTION record_initial_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO order_status_history (order_id, field, previous_value, new_value, comment)
  VALUES (NEW.id, 'status', NULL, NEW.status, 'Pedido recibido');
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_record_initial_status
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION record_initial_order_status();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- ── orders ────────────────────────────────────────────────────────────

-- Anonymous users (public checkout) may create orders.
CREATE POLICY "orders: anon insert"
  ON orders
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Authenticated users (admin) have full access to all orders.
CREATE POLICY "orders: admin full access"
  ON orders
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── order_items ───────────────────────────────────────────────────────

-- Anon may insert items as part of the checkout transaction.
CREATE POLICY "order_items: anon insert"
  ON order_items
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Admin full access.
CREATE POLICY "order_items: admin full access"
  ON order_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── order_status_history ──────────────────────────────────────────────

-- Only admin may write and read status history directly.
-- Anonymous users access this data exclusively through the
-- get_order_for_tracking() function below.
CREATE POLICY "order_status_history: admin full access"
  ON order_status_history
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


-- ============================================================
-- PUBLIC ORDER TRACKING FUNCTION
-- ============================================================

-- Called from the public /seguimiento page via supabase.rpc().
-- SECURITY DEFINER runs with owner privileges, bypassing RLS safely.
-- Returns data only when BOTH order_number AND customer_email match —
-- neither alone is sufficient. Returns NULL silently on mismatch to
-- avoid leaking whether a given order_number exists.
-- Intentionally omits customer_email, customer_phone, and full address.
CREATE OR REPLACE FUNCTION get_order_for_tracking(
  p_order_number text,
  p_email        text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_result json;
BEGIN
  SELECT * INTO v_order
  FROM orders
  WHERE order_number = p_order_number
    AND LOWER(customer_email) = LOWER(p_email);

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'id',                  v_order.id,
    'order_number',        v_order.order_number,
    'customer_name',       v_order.customer_name,
    'status',              v_order.status,
    'payment_status',      v_order.payment_status,
    'payment_method',      v_order.payment_method,
    'subtotal',            v_order.subtotal,
    'shipping_cost',       v_order.shipping_cost,
    'total',               v_order.total,
    'shipping_city',       v_order.shipping_city,
    'shipping_department', v_order.shipping_department,
    'customer_notes',      v_order.customer_notes,
    'created_at',          v_order.created_at,
    'items', (
      SELECT COALESCE(json_agg(json_build_object(
        'product_name',      oi.product_name,
        'product_reference', oi.product_reference,
        'product_ci',        oi.product_ci,
        'quantity',          oi.quantity,
        'unit_price',        oi.unit_price,
        'subtotal',          oi.subtotal
      )), '[]'::json)
      FROM order_items oi
      WHERE oi.order_id = v_order.id
    ),
    'history', (
      SELECT COALESCE(json_agg(json_build_object(
        'field',          h.field,
        'previous_value', h.previous_value,
        'new_value',      h.new_value,
        'comment',        h.comment,
        'created_at',     h.created_at
      ) ORDER BY h.created_at ASC), '[]'::json)
      FROM order_status_history h
      WHERE h.order_id = v_order.id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
