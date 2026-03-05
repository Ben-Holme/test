import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
          {label}
        </label>
      )}
      <input
        className={`bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 text-sm
          text-neutral-100 placeholder-neutral-500
          focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500
          disabled:opacity-50 ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}
