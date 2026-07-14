import type { ButtonHTMLAttributes } from 'react'
import {
  getButtonClassName,
  type ButtonSize,
  type ButtonVariant,
} from './button-styles'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
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
        getButtonClassName({ variant, size, className }),
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
