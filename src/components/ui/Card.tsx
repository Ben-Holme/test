import React from 'react'

interface CardProps {
  className?: string
  children: React.ReactNode
}

export function Card({ className = '', children }: CardProps) {
  return (
    <div className={`bg-neutral-900 border border-neutral-800 rounded-lg p-6 ${className}`}>
      {children}
    </div>
  )
}
