// Swedish compliance deadlines for a calendar-year AB (räkenskapsår 1 jan–31 dec).
//
// Sources:
// - Moms (kvartalsvis): 12:e i andra månaden efter kvartalet, utom april–juni
//   som har förlängd frist till 17 augusti. (skatteverket.se)
// - Årsredovisning till Bolagsverket: senast 7 månader efter räkenskapsårets
//   slut, dvs 31 juli för kalenderår. (bolagsverket.se)
// - Årsstämma: senast 6 månader efter räkenskapsårets slut, dvs 30 juni för
//   kalenderår.
//
// Note: only weekends are pushed to the next business day — Swedish public
// holidays (röda dagar) aren't accounted for, so a date can be off by a day
// or two around Easter/midsummer/Christmas. Always double-check against
// Skatteverket's "Viktiga datum" for the exact, pre-filled date.

export interface ImportantDate {
  key: string
  label: string
  detail: string
  date: Date
  daysLeft: number
}

function adjustForWeekend(date: Date): Date {
  const day = date.getDay() // 0 = söndag, 6 = lördag
  if (day === 6) {
    const d = new Date(date)
    d.setDate(d.getDate() + 2)
    return d
  }
  if (day === 0) {
    const d = new Date(date)
    d.setDate(d.getDate() + 1)
    return d
  }
  return date
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function daysUntil(date: Date, today: Date): number {
  const diff = startOfDay(date).getTime() - startOfDay(today).getTime()
  return Math.round(diff / (1000 * 60 * 60 * 24))
}

function vatDeadlinesForYear(year: number): { date: Date; detail: string }[] {
  return [
    { date: adjustForWeekend(new Date(year, 1, 12)), detail: `${year - 1} okt–dec` },
    { date: adjustForWeekend(new Date(year, 4, 12)), detail: `${year} jan–mar` },
    { date: adjustForWeekend(new Date(year, 7, 17)), detail: `${year} apr–jun` },
    { date: adjustForWeekend(new Date(year, 10, 12)), detail: `${year} jul–sep` },
  ]
}

function nextVatDeadline(today: Date): { date: Date; detail: string } {
  const candidates = [...vatDeadlinesForYear(today.getFullYear()), ...vatDeadlinesForYear(today.getFullYear() + 1)]
  const start = startOfDay(today)
  return candidates
    .filter((c) => c.date >= start)
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0]
}

function nextAnnualDeadline(today: Date, month: number, day: number): Date {
  const start = startOfDay(today)
  let deadline = adjustForWeekend(new Date(today.getFullYear(), month, day))
  if (deadline < start) {
    deadline = adjustForWeekend(new Date(today.getFullYear() + 1, month, day))
  }
  return deadline
}

export function getImportantDates(today: Date = new Date()): ImportantDate[] {
  const moms = nextVatDeadline(today)
  const arsstamma = nextAnnualDeadline(today, 5, 30) // juni = index 5
  const arsredovisning = nextAnnualDeadline(today, 6, 31) // juli = index 6

  const items: ImportantDate[] = [
    {
      key: 'moms',
      label: 'Momsdeklaration',
      detail: moms.detail,
      date: moms.date,
      daysLeft: daysUntil(moms.date, today),
    },
    {
      key: 'arsstamma',
      label: 'Årsstämma',
      detail: 'senast 6 mån efter räkenskapsårets slut',
      date: arsstamma,
      daysLeft: daysUntil(arsstamma, today),
    },
    {
      key: 'arsredovisning',
      label: 'Årsredovisning till Bolagsverket',
      detail: 'senast 7 mån efter räkenskapsårets slut',
      date: arsredovisning,
      daysLeft: daysUntil(arsredovisning, today),
    },
  ]

  return items.sort((a, b) => a.daysLeft - b.daysLeft)
}
