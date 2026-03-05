import { useState } from 'react'
import { useStore } from '../data/store'
import { buildVatReport } from '../lib/vatReport'
import { VatReportTable } from '../components/domain/VatReportTable'

function quarterBounds(year: number, q: number): { from: string; to: string } {
  const fromMonth = q * 3 + 1
  const toMonth = q * 3 + 3
  const from = `${year}-${String(fromMonth).padStart(2, '0')}-01`
  const lastDay = new Date(year, toMonth, 0).getDate()
  const to = `${year}-${String(toMonth).padStart(2, '0')}-${lastDay}`
  return { from, to }
}

export function VatReport() {
  const { state } = useStore()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3))

  const { from, to } = quarterBounds(year, quarter)
  const report = buildVatReport(from, to, state.transactions)

  const years = [now.getFullYear() - 1, now.getFullYear()]

  return (
    <div className="px-8 py-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-100">Momsrapport</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Periodsvis sammanställning för momsdeklaration
        </p>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-400 uppercase tracking-wide">År</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Kvartal</label>
          <select
            value={quarter}
            onChange={(e) => setQuarter(Number(e.target.value))}
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value={0}>Q1 (jan–mar)</option>
            <option value={1}>Q2 (apr–jun)</option>
            <option value={2}>Q3 (jul–sep)</option>
            <option value={3}>Q4 (okt–dec)</option>
          </select>
        </div>
      </div>

      <div className="text-xs text-neutral-500 mb-4">
        Period: {from} — {to}
      </div>

      <VatReportTable report={report} />

      <div className="mt-4 p-4 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-500">
        <strong className="text-neutral-400">Obs:</strong> Rapporten inkluderar alla bokförda och betalda
        transaktioner för vald period. Förvärvsmoms (konto 4545) ingår i utgående moms.
      </div>
    </div>
  )
}
