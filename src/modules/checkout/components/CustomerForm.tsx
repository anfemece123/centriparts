import Input from '@/shared/components/ui/Input'

export interface CustomerFormFields {
  customer_name: string
  customer_email: string
  customer_phone: string
}

interface Props {
  values: CustomerFormFields
  errors: Partial<Record<keyof CustomerFormFields, string>>
  onChange: (field: keyof CustomerFormFields, value: string) => void
  disabled: boolean
}

export default function CustomerForm({ values, errors, onChange, disabled }: Props) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Información del cliente
      </h2>

      <Input
        id="customer_name"
        label="Nombre completo"
        value={values.customer_name}
        onChange={(e) => onChange('customer_name', e.target.value)}
        error={errors.customer_name}
        placeholder="Ej: Juan García"
        autoComplete="name"
        disabled={disabled}
      />

      <Input
        id="customer_email"
        type="email"
        label="Correo electrónico"
        value={values.customer_email}
        onChange={(e) => onChange('customer_email', e.target.value)}
        error={errors.customer_email}
        placeholder="correo@ejemplo.com"
        autoComplete="email"
        disabled={disabled}
      />

      <Input
        id="customer_phone"
        type="tel"
        label="Teléfono (opcional)"
        value={values.customer_phone}
        onChange={(e) => onChange('customer_phone', e.target.value)}
        error={errors.customer_phone}
        placeholder="+57 300 000 0000"
        autoComplete="tel"
        disabled={disabled}
      />
    </section>
  )
}
