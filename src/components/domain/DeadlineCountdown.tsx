import { useMemo } from 'react'
import { getImportantDates } from '../../lib/importantDates'
import { Card } from '../ui/Card'

function formatDeadline(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

export function DeadlineCountdown() {
  const dates = useMemo(() => getImportantDates(), [])
  const [next, ...rest] = dates

  return (
    <Card>
      <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-3">
        Nästa deadline
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className={`text-2xl font-bold font-mono ${
            next.daysLeft <= 7 ? 'text-red-400' : next.daysLeft <= 21 ? 'text-amber-400' : 'text-neutral-100'
          }`}
        >
          {next.daysLeft} {next.daysLeft === 1 ? 'dag' : 'dagar'}
        </span>
        <span className="text-sm text-neutral-500">kvar</span>
      </div>
      <div className="text-sm text-neutral-300 mt-2">{next.label}</div>
      <div className="text-xs text-neutral-500 mt-0.5">
        {formatDeadline(next.date)} · {next.detail}
      </div>

      {rest.length > 0 && (
        <div className="mt-4 pt-4 border-t border-neutral-800 space-y-2">
          {rest.map((d) => (
            <div key={d.key} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-neutral-400 truncate">{d.label}</span>
              <span className="text-neutral-500 font-mono shrink-0">
                {formatDeadline(d.date)} · {d.daysLeft}d
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
