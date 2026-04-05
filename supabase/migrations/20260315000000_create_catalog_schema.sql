-- ============================================================
-- Centriparts catalog schema
-- ============================================================

-- ============================================================
-- LOOKUP TABLES
-- ============================================================

CREATE TABLE categories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL UNIQUE,
  slug        text        NOT NULL UNIQUE,
  description text,
  parent_id   uuid        REFERENCES categories(id) ON DELETE SET NULL,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_types (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL UNIQUE,
  slug       text        NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_brands (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL UNIQUE,
  slug       text        NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vehicle_brands (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL UNIQUE,
  slug       text        NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vehicle_models (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_brand_id uuid        NOT NULL REFERENCES vehicle_brands(id) ON DELETE RESTRICT,
  name             text        NOT NULL,
  slug             text        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_brand_id, name)
);

-- ============================================================
-- PRODUCTS
-- ============================================================

CREATE TABLE products (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ci                text        NOT NULL UNIQUE,
  base_name         text        NOT NULL,
  display_name      text,
  slug              text        NOT NULL UNIQUE,
  reference         text,
  description       text,
  sale_price        numeric(12,2) NOT NULL DEFAULT 0,
  cost_price        numeric(12,2) NOT NULL DEFAULT 0,
  stock             integer     NOT NULL DEFAULT 0,
  type_id           uuid        REFERENCES product_types(id) ON DELETE SET NULL,
  brand_id          uuid        REFERENCES product_brands(id) ON DELETE SET NULL,
  raw_compatibility text,
  status            text        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'ready', 'published', 'archived')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Many-to-many: products ↔ categories
-- One primary category enforced via partial unique index below
CREATE TABLE product_categories (
  product_id  uuid    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id uuid    NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  is_primary  boolean NOT NULL DEFAULT false,
  PRIMARY KEY (product_id, category_id)
);

-- Enforces at most one primary category per product
CREATE UNIQUE INDEX product_categories_one_primary_per_product
  ON product_categories (product_id)
  WHERE is_primary = true;

-- ============================================================
-- COMPATIBILITY
-- ============================================================

CREATE TABLE product_compatibility (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  vehicle_brand_id    uuid        REFERENCES vehicle_brands(id) ON DELETE SET NULL,
  vehicle_model_id    uuid        REFERENCES vehicle_models(id) ON DELETE SET NULL,
  year_from           smallint    CHECK (year_from IS NULL OR year_from >= 1900),
  year_to             smallint    CHECK (year_to   IS NULL OR year_to   >= 1900),
  notes               text,
  raw_source_fragment text,
  CONSTRAINT year_order CHECK (year_from IS NULL OR year_to IS NULL OR year_to >= year_from),
  parse_status        text        NOT NULL DEFAULT 'auto'
                      CHECK (parse_status IN ('auto', 'partial', 'manual')),
  is_verified         boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- PRODUCT IMAGES (manual upload only)
-- ============================================================

CREATE TABLE product_images (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  storage_path  text        NOT NULL,
  alt_text      text,
  display_order smallint    NOT NULL DEFAULT 0,
  is_primary    boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Enforces at most one primary image per product
CREATE UNIQUE INDEX product_images_one_primary_per_product
  ON product_images (product_id)
  WHERE is_primary = true;

-- ============================================================
-- IMPORT STAGING LAYER
-- ============================================================

CREATE TABLE import_batches (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  filename       text        NOT NULL,
  status         text        NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_rows     integer     NOT NULL DEFAULT 0,
  imported_count integer     NOT NULL DEFAULT 0,
  updated_count  integer     NOT NULL DEFAULT 0,
  skipped_count  integer     NOT NULL DEFAULT 0,
  failed_count   integer     NOT NULL DEFAULT 0,
  imported_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at     timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE import_rows (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      uuid        NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  row_number    integer     NOT NULL,
  ci            text,
  raw_data      jsonb       NOT NULL,
  status        text        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'imported', 'updated', 'skipped', 'failed')),
  product_id    uuid        REFERENCES products(id) ON DELETE SET NULL,
  error_message text,
  processed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Products (ci and slug omitted — covered by their UNIQUE constraints)
CREATE INDEX idx_products_status   ON products(status);
CREATE INDEX idx_products_type_id  ON products(type_id);
CREATE INDEX idx_products_brand_id ON products(brand_id);

-- Full-text search on product names and reference
CREATE INDEX idx_products_fts ON products
  USING gin(to_tsvector('spanish', coalesce(base_name,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(reference,'')));

-- Product categories
CREATE INDEX idx_product_categories_category_id ON product_categories(category_id);

-- Compatibility
CREATE INDEX idx_compatibility_product_id      ON product_compatibility(product_id);
CREATE INDEX idx_compatibility_vehicle_model   ON product_compatibility(vehicle_model_id);
CREATE INDEX idx_compatibility_vehicle_brand   ON product_compatibility(vehicle_brand_id);
CREATE INDEX idx_compatibility_is_verified     ON product_compatibility(is_verified);

-- Vehicle models
CREATE INDEX idx_vehicle_models_brand_id ON vehicle_models(vehicle_brand_id);

-- Import
CREATE INDEX idx_import_rows_batch_id   ON import_rows(batch_id);
CREATE INDEX idx_import_rows_ci         ON import_rows(ci);
CREATE INDEX idx_import_rows_product_id ON import_rows(product_id);
CREATE INDEX idx_import_rows_status     ON import_rows(status);

-- ============================================================
-- updated_at TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
