import type { PaymentMethod } from '@/modules/orders/types/orders'

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; description: string }[] = [
  {
    value: 'transfer',
    label: 'Transferencia bancaria',
    description: 'Bancolombia, Davivienda u otro banco.',
  },
  {
    value: 'nequi',
    label: 'Nequi',
    description: 'Pago inmediato desde la app Nequi.',
  },
  {
    value: 'daviplata',
    label: 'Daviplata',
    description: 'Pago desde tu cuenta Daviplata.',
  },
  {
    value: 'cash',
    label: 'Contra entrega',
    description: 'Pago en efectivo al recibir el pedido.',
  },
  {
    value: 'other',
    label: 'Otro',
    description: 'Coordinar método de pago con el equipo.',
  },
]

interface Props {
  value: PaymentMethod | ''
  error?: string
  onChange: (method: PaymentMethod) => void
  disabled: boolean
}

export default function PaymentMethodSelector({ value, error, onChange, disabled }: Props) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Método de pago
      </h2>

      <div className="flex flex-col gap-2">
        {PAYMENT_OPTIONS.map((option) => {
          const isSelected = value === option.value
          return (
            <label
              key={option.value}
              className={[
                'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors',
                disabled ? 'cursor-not-allowed opacity-60' : '',
                isSelected
                  ? 'border-yellow-400 bg-yellow-50'
                  : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50',
              ].join(' ')}
            >
              <input
                type="radio"
                name="payment_method"
                value={option.value}
                checked={isSelected}
                onChange={() => onChange(option.value)}
                disabled={disabled}
                className="mt-0.5 accent-yellow-400"
              />
              <div>
                <p className="text-sm font-medium text-zinc-900">{option.label}</p>
                <p className="text-xs text-zinc-500">{option.description}</p>
              </div>
            </label>
          )
        })}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </section>
  )
}
