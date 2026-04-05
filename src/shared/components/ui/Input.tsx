import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export default function Input({ label, error, id, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-zinc-700">
          {label}
        </label>
      )}
      <input
        id={id}
        className={[
          'rounded-md border px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors',
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200'
            : 'border-zinc-300 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100',
          props.disabled ? 'cursor-not-allowed bg-zinc-100 opacity-60' : 'bg-white',
          className,
        ].join(' ')}
        {...props}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
