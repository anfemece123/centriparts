type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

interface BadgeProps {
  label: string
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-zinc-100 text-zinc-600',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-800',
  danger:  'bg-red-100 text-red-700',
  info:    'bg-blue-100 text-blue-700',
}

export default function Badge({ label, variant = 'default' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
      ].join(' ')}
    >
      {label}
    </span>
  )
}
