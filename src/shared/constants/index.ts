export const ROUTES = {
  // ── Public ──────────────────────────────────────────────────────────
  PUBLIC_HOME:    '/',
  PUBLIC_CATALOG: '/catalog',
  PUBLIC_PRODUCT: '/p/:id',
  PUBLIC_ABOUT:   '/nosotros',
  PUBLIC_CONTACT: '/contacto',

  // ── Auth ────────────────────────────────────────────────────────────
  ADMIN_LOGIN: '/admin/login',

  // ── Admin (protected) ───────────────────────────────────────────────
  ADMIN_HOME:           '/admin',
  ADMIN_PRODUCTS:       '/admin/products',
  ADMIN_PRODUCT_DETAIL: '/admin/products/:id',
  ADMIN_CATEGORIES:     '/admin/categories',
  ADMIN_NAME_ANALYSIS:  '/admin/tools/name-analysis',
} as const
