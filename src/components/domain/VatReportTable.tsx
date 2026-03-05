import type { VatReport } from '../../lib/vatReport'
import { formatSEK } from '../../lib/formatters'

interface VatReportTableProps {
  report: VatReport
}

export function VatReportTable({ report }: VatReportTableProps) {
  const rows = [
    {
      box: '05',
      label: 'Utgående moms, 25%',
      value: report.utgåendeMoms,
      note: 'Konto 2610 + 4545',
    },
    {
      box: '48',
      label: 'Ingående moms att dra av',
      value: report.ingåendeMoms,
      note: 'Konto 2640',
    },
    {
      box: '49',
      label: 'Moms att betala (+) / återfå (−)',
      value: report.nettoMoms,
      note: '',
      highlight: true,
    },
  ]

  return (
    <div className="rounded-lg border border-neutral-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-neutral-800/50 text-neutral-400 text-xs uppercase tracking-wide">
            <th className="text-left px-4 py-3 w-16">Ruta</th>
            <th className="text-left px-4 py-3">Beskrivning</th>
            <th className="text-left px-4 py-3 text-neutral-600">Konton</th>
            <th className="text-right px-4 py-3">Belopp</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {rows.map((row) => (
            <tr
              key={row.box}
              className={row.highlight ? 'bg-neutral-800/40' : 'hover:bg-neutral-800/20'}
            >
              <td className="px-4 py-4 font-mono text-neutral-400 font-bold">{row.box}</td>
              <td className={`px-4 py-4 ${row.highlight ? 'text-neutral-100 font-semibold' : 'text-neutral-300'}`}>
                {row.label}
              </td>
              <td className="px-4 py-4 text-neutral-600 text-xs">{row.note}</td>
              <td
                className={`px-4 py-4 text-right font-mono font-medium ${
                  row.highlight
                    ? row.value >= 0
                      ? 'text-red-400'
                      : 'text-emerald-400'
                    : 'text-neutral-200'
                }`}
              >
                {formatSEK(Math.abs(row.value))}
                {row.highlight && (
                  <span className="ml-1 text-xs text-neutral-500">
                    {row.value >= 0 ? '(betala)' : '(återfå)'}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
