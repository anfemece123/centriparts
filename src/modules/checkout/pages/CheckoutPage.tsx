import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/store'
import { clearCart } from '@/modules/cart/store/cartSlice'
import { ROUTES } from '@/shared/constants'
import type { PaymentMethod } from '@/modules/orders/types/orders'
import { createOrder } from '../services/checkout.service'
import CustomerForm, { type CustomerFormFields } from '../components/CustomerForm'
import ShippingForm, { type ShippingFormFields } from '../components/ShippingForm'
import PaymentMethodSelector from '../components/PaymentMethodSelector'
import CheckoutSummary from '../components/CheckoutSummary'

// ─────────────────────────────────────────────────────────────────────────────
// Form state
// ─────────────────────────────────────────────────────────────────────────────

interface CheckoutFormState extends CustomerFormFields, ShippingFormFields {
  payment_method: PaymentMethod | ''
  customer_notes: string
}

type FormErrors = Partial<Record<keyof CheckoutFormState, string>>

const INITIAL_FORM: CheckoutFormState = {
  customer_name:       '',
  customer_email:      '',
  customer_phone:      '',
  shipping_address:    '',
  shipping_city:       '',
  shipping_department: '',
  shipping_country:    'Colombia',
  payment_method:      '',
  customer_notes:      '',
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(form: CheckoutFormState): FormErrors {
  const errors: FormErrors = {}

  if (!form.customer_name.trim())
    errors.customer_name = 'El nombre es obligatorio.'

  if (!form.customer_email.trim())
    errors.customer_email = 'El correo es obligatorio.'
  else if (!EMAIL_RE.test(form.customer_email.trim()))
    errors.customer_email = 'Ingrese un correo válido.'

  if (!form.shipping_address.trim())
    errors.shipping_address = 'La dirección es obligatoria.'

  if (!form.shipping_city.trim())
    errors.shipping_city = 'La ciudad es obligatoria.'

  if (!form.shipping_department.trim())
    errors.shipping_department = 'El departamento es obligatorio.'

  if (!form.shipping_country.trim())
    errors.shipping_country = 'El país es obligatorio.'

  if (!form.payment_method)
    errors.payment_method = 'Seleccione un método de pago.'

  return errors
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const dispatch  = useAppDispatch()
  const navigate  = useNavigate()
  const cartItems = useAppSelector((s) => s.cart.items)

  const [form, setForm]           = useState<CheckoutFormState>(INITIAL_FORM)
  const [errors, setErrors]       = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Redirect to catalog if cart is empty
  if (cartItems.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-zinc-500">Tu carrito está vacío.</p>
        <Link
          to={ROUTES.PUBLIC_CATALOG}
          className="rounded-lg bg-yellow-400 px-5 py-2.5 text-sm font-semibold text-black hover:bg-yellow-500"
        >
          Explorar catálogo
        </Link>
      </div>
    )
  }

  // Generic field updater shared across all sub-forms
  function handleChange(field: keyof CheckoutFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    // Clear the error for that field as the user types
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    const validationErrors = validate(form)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      // Scroll to the first error
      const firstErrorKey = Object.keys(validationErrors)[0]
      document.getElementById(firstErrorKey)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setSubmitting(true)

    const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

    const payload = {
      customer_name:       form.customer_name.trim(),
      customer_email:      form.customer_email.trim(),
      customer_phone:      form.customer_phone.trim() || null,
      shipping_address:    form.shipping_address.trim(),
      shipping_city:       form.shipping_city.trim(),
      shipping_department: form.shipping_department.trim(),
      shipping_country:    form.shipping_country.trim(),
      subtotal,
      shipping_cost:       0,
      total:               subtotal,
      payment_method:      form.payment_method as PaymentMethod,
      customer_notes:      form.customer_notes.trim() || null,
      items: cartItems.map((item) => ({
        product_id:        item.productId,
        product_name:      item.name,
        product_ci:        null,         // populated in future when addItem stores CI
        product_reference: item.reference,
        quantity:          item.quantity,
        unit_price:        item.price,
        subtotal:          item.price * item.quantity,
      })),
    }

    try {
      const { orderNumber } = await createOrder(payload)
      dispatch(clearCart())
      navigate(`${ROUTES.PUBLIC_CONFIRMATION}?order=${orderNumber}`, { replace: true })
    } catch {
      setSubmitError('Ocurrió un error al procesar tu pedido. Por favor intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">

      {/* Page header */}
      <div className="mb-8">
        <Link
          to={ROUTES.PUBLIC_CATALOG}
          className="text-xs text-zinc-400 hover:text-zinc-600"
        >
          ← Seguir comprando
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Finalizar pedido</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {totalItems} {totalItems === 1 ? 'producto' : 'productos'} en tu carrito
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">

          {/* ── Left: form sections ───────────────────────────────────── */}
          <div className="flex flex-col gap-8">

            <div className="rounded-2xl border border-zinc-100 bg-white p-6">
              <CustomerForm
                values={form}
                errors={errors}
                onChange={handleChange}
                disabled={submitting}
              />
            </div>

            <div className="rounded-2xl border border-zinc-100 bg-white p-6">
              <ShippingForm
                values={form}
                errors={errors}
                onChange={handleChange}
                disabled={submitting}
              />
            </div>

            <div className="rounded-2xl border border-zinc-100 bg-white p-6">
              <PaymentMethodSelector
                value={form.payment_method}
                error={errors.payment_method}
                onChange={(method) => handleChange('payment_method', method)}
                disabled={submitting}
              />
            </div>

            {/* Notes */}
            <div className="rounded-2xl border border-zinc-100 bg-white p-6">
              <section className="flex flex-col gap-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                  Notas del pedido
                </h2>
                <div className="flex flex-col gap-1">
                  <label htmlFor="customer_notes" className="text-sm font-medium text-zinc-700">
                    Comentarios adicionales (opcional)
                  </label>
                  <textarea
                    id="customer_notes"
                    rows={3}
                    value={form.customer_notes}
                    onChange={(e) => handleChange('customer_notes', e.target.value)}
                    disabled={submitting}
                    placeholder="Instrucciones de entrega, aclaraciones, etc."
                    className="resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </section>
            </div>

          </div>

          {/* ── Right: summary + submit ───────────────────────────────── */}
          <div className="flex flex-col gap-4">

            {/* Sticky on desktop */}
            <div className="flex flex-col gap-4 lg:sticky lg:top-24">

              <CheckoutSummary />

              {/* Submit error */}
              {submitError && (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-yellow-400 py-3.5 text-sm font-bold text-black transition-colors hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Procesando pedido…' : `Realizar pedido · ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(subtotal)}`}
              </button>

              <p className="text-center text-xs text-zinc-400">
                Al realizar el pedido, un asesor se pondrá en contacto para confirmar
                los detalles de pago y envío.
              </p>

            </div>
          </div>

        </div>
      </form>
    </div>
  )
}
