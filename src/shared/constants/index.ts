export const ROUTES = {
  // ── Public ──────────────────────────────────────────────────────────
  PUBLIC_HOME:    '/',
  PUBLIC_CATALOG: '/catalog',
  PUBLIC_PRODUCT: '/p/:id',
  PUBLIC_ABOUT:         '/nosotros',
  PUBLIC_CONTACT:       '/contacto',
  PUBLIC_CHECKOUT:      '/checkout',
  PUBLIC_CONFIRMATION:  '/checkout/confirmacion',
  PUBLIC_TRACKING:      '/seguimiento',

  // ── Auth ────────────────────────────────────────────────────────────
  ADMIN_LOGIN: '/admin/login',

  // ── Admin (protected) ───────────────────────────────────────────────
  ADMIN_HOME:           '/admin',
  ADMIN_PRODUCTS:       '/admin/products',
  ADMIN_PRODUCT_DETAIL: '/admin/products/:id',
  ADMIN_CATEGORIES:     '/admin/categories',
  ADMIN_NAME_ANALYSIS:  '/admin/tools/name-analysis',
  ADMIN_VISUAL_SEARCH:  '/admin/tools/visual-search',
  ADMIN_ORDERS:         '/admin/orders',
  ADMIN_ORDER_DETAIL:   '/admin/orders/:id',
} as const

const GOOGLE_MAPS_QUERY = encodeURIComponent(
  'Centriparts JED SAS, Carrera 18 #14-25, Avenida Julián Bucheli, Pasto, Nariño, Colombia',
)

export const BUSINESS_LOCATION = {
  street: 'Carrera 18 #14-25',
  area: 'Avenida Julián Bucheli',
  city: 'Pasto, Nariño',
  country: 'Colombia',
  fullAddress: 'Carrera 18 #14-25, Avenida Julián Bucheli, Pasto, Nariño, Colombia',
  googleMapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${GOOGLE_MAPS_QUERY}`,
  googleMapsEmbedUrl: `https://www.google.com/maps?q=${GOOGLE_MAPS_QUERY}&output=embed`,
} as const
