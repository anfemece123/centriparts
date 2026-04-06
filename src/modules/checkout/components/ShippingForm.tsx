import Input from '@/shared/components/ui/Input'

export interface ShippingFormFields {
  shipping_address: string
  shipping_city: string
  shipping_department: string
  shipping_country: string
}

interface Props {
  values: ShippingFormFields
  errors: Partial<Record<keyof ShippingFormFields, string>>
  onChange: (field: keyof ShippingFormFields, value: string) => void
  disabled: boolean
}

export default function ShippingForm({ values, errors, onChange, disabled }: Props) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Dirección de envío
      </h2>

      <Input
        id="shipping_address"
        label="Dirección"
        value={values.shipping_address}
        onChange={(e) => onChange('shipping_address', e.target.value)}
        error={errors.shipping_address}
        placeholder="Calle 123 # 45-67, Apto 8"
        autoComplete="street-address"
        disabled={disabled}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          id="shipping_city"
          label="Ciudad"
          value={values.shipping_city}
          onChange={(e) => onChange('shipping_city', e.target.value)}
          error={errors.shipping_city}
          placeholder="Ej: Bogotá"
          autoComplete="address-level2"
          disabled={disabled}
        />

        <Input
          id="shipping_department"
          label="Departamento"
          value={values.shipping_department}
          onChange={(e) => onChange('shipping_department', e.target.value)}
          error={errors.shipping_department}
          placeholder="Ej: Cundinamarca"
          autoComplete="address-level1"
          disabled={disabled}
        />
      </div>

      <Input
        id="shipping_country"
        label="País"
        value={values.shipping_country}
        onChange={(e) => onChange('shipping_country', e.target.value)}
        error={errors.shipping_country}
        disabled={disabled}
      />
    </section>
  )
}
