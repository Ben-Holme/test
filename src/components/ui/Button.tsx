import React from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-sky-600 hover:bg-sky-500 text-white border-transparent',
  secondary:
    'bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border-neutral-700',
  ghost:
    'bg-transparent hover:bg-neutral-800 text-neutral-300 border-transparent',
  danger:
    'bg-red-800 hover:bg-red-700 text-white border-transparent',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-md border font-medium transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
