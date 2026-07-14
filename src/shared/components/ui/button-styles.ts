export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'dark'
  | 'success'
  | 'whatsapp'

export type ButtonSize = 'sm' | 'md' | 'lg'

const variantClasses: Record<ButtonVariant, string> = {
  primary:   'bg-yellow-400 text-black hover:bg-yellow-500 border border-yellow-400 hover:border-yellow-500',
  secondary: 'bg-white text-zinc-900 hover:bg-zinc-50 border border-zinc-300',
  ghost:     'bg-transparent text-zinc-600 hover:bg-zinc-100 border border-transparent',
  danger:    'bg-red-600 text-white hover:bg-red-500 border border-red-600',
  dark:      'bg-zinc-950 text-white hover:bg-zinc-800 border border-zinc-950',
  success:   'bg-emerald-600 text-white hover:bg-emerald-500 border border-emerald-600',
  whatsapp:  'bg-[#25D366] text-white hover:bg-[#1ebe5d] border border-[#25D366]',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-6 text-sm',
}

interface ButtonClassNameOptions {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

export function getButtonClassName({
  variant = 'primary',
  size = 'md',
  className = '',
}: ButtonClassNameOptions = {}): string {
  return [
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 active:scale-[0.98]',
    variantClasses[variant],
    sizeClasses[size],
    className,
  ].join(' ')
}
