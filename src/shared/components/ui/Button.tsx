import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variantClasses: Record<Variant, string> = {
  primary:   'bg-yellow-400 text-black hover:bg-yellow-300 border border-yellow-400',
  secondary: 'bg-white text-zinc-900 hover:bg-zinc-50 border border-zinc-300',
  ghost:     'bg-transparent text-zinc-600 hover:bg-zinc-100 border border-transparent',
  danger:    'bg-red-600 text-white hover:bg-red-500 border border-red-600',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-1',
        variantClasses[variant],
        sizeClasses[size],
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
