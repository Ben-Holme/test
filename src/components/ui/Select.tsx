import React from 'react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string | number; label: string }[]
}

export function Select({ label, options, className = '', ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
          {label}
        </label>
      )}
      <select
        className={`bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 text-sm
          text-neutral-100 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500
          disabled:opacity-50 ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
