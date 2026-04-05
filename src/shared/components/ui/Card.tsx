import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean
}

export default function Card({ padding = true, className = '', children, ...props }: CardProps) {
  return (
    <div
      className={[
        'rounded-lg border border-zinc-200 bg-white shadow-sm',
        padding ? 'p-5' : '',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </div>
  )
}
