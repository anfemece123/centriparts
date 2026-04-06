import { Outlet } from 'react-router-dom'
import PublicHeader from './PublicHeader'
import PublicFooter from './PublicFooter'
import WhatsAppButton from '@/shared/components/ui/WhatsAppButton'
import CartDrawer from '@/modules/cart/components/CartDrawer'

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <PublicHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
      <WhatsAppButton />
      <CartDrawer />
    </div>
  )
}
