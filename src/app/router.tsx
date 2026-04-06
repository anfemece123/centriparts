import { createBrowserRouter } from 'react-router-dom'
import { ROUTES } from '@/shared/constants'

// Layouts
import DashboardLayout from '@/shared/components/layout/DashboardLayout'
import PublicLayout    from '@/shared/components/layout/PublicLayout'

// Auth
import ProtectedRoute from '@/modules/auth/components/ProtectedRoute'
import LoginPage      from '@/modules/auth/pages/LoginPage'

// Public pages
import PublicHomePage    from '@/modules/public/pages/PublicHomePage'
import NosotrosPage      from '@/modules/public/pages/NosotrosPage'
import ContactoPage      from '@/modules/public/pages/ContactoPage'
import PublicCatalogPage      from '@/modules/catalog/pages/PublicCatalogPage'
import PublicProductPage      from '@/modules/catalog/pages/PublicProductPage'
import CheckoutPage           from '@/modules/checkout/pages/CheckoutPage'
import OrderConfirmationPage  from '@/modules/checkout/pages/OrderConfirmationPage'
import TrackingPage           from '@/modules/orders/pages/TrackingPage'

// Admin pages
import AdminHomePage     from '@/modules/home/pages/HomePage'
import ProductsPage      from '@/modules/catalog/pages/ProductsPage'
import ProductDetailPage from '@/modules/catalog/pages/ProductDetailPage'
import CategoriesPage    from '@/modules/catalog/pages/CategoriesPage'
import NameAnalysisPage  from '@/modules/catalog/pages/NameAnalysisPage'
import OrdersPage        from '@/modules/orders/pages/OrdersPage'
import OrderDetailPage   from '@/modules/orders/pages/OrderDetailPage'

export const router = createBrowserRouter([

  // ── 1. Public routes — no auth required ──────────────────────────────
  {
    element: <PublicLayout />,
    children: [
      { path: ROUTES.PUBLIC_HOME,    element: <PublicHomePage />    },
      { path: ROUTES.PUBLIC_ABOUT,   element: <NosotrosPage />      },
      { path: ROUTES.PUBLIC_CONTACT, element: <ContactoPage />      },
      { path: ROUTES.PUBLIC_CATALOG,      element: <PublicCatalogPage />     },
      { path: ROUTES.PUBLIC_PRODUCT,      element: <PublicProductPage />     },
      { path: ROUTES.PUBLIC_CHECKOUT,     element: <CheckoutPage />          },
      { path: ROUTES.PUBLIC_CONFIRMATION, element: <OrderConfirmationPage /> },
      { path: ROUTES.PUBLIC_TRACKING,     element: <TrackingPage />          },
    ],
  },

  // ── 2. Auth routes — redirect if already signed in ───────────────────
  {
    path: ROUTES.ADMIN_LOGIN,
    element: <LoginPage />,
  },

  // ── 3. Protected admin routes — auth required ─────────────────────────
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: ROUTES.ADMIN_HOME,           element: <AdminHomePage />     },
          { path: ROUTES.ADMIN_PRODUCTS,       element: <ProductsPage />      },
          { path: ROUTES.ADMIN_PRODUCT_DETAIL, element: <ProductDetailPage /> },
          { path: ROUTES.ADMIN_CATEGORIES,     element: <CategoriesPage />    },
          { path: ROUTES.ADMIN_NAME_ANALYSIS,  element: <NameAnalysisPage />  },
          { path: ROUTES.ADMIN_ORDERS,         element: <OrdersPage />        },
          { path: ROUTES.ADMIN_ORDER_DETAIL,   element: <OrderDetailPage />   },
        ],
      },
    ],
  },

])
