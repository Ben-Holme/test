// Swedish compliance deadlines for Vantör Digital AB (räkenskapsår 1 jan–31 dec).
//
// Momsen redovisas för HELT BESKATTNINGSÅR (inte kvartalsvis) och lämnas i
// nära anslutning till inkomstdeklarationen — Skatteverket räknar fram det
// exakta datumet per bolag (synligt i Skatteverkets app under "Viktiga
// datum"/"Lämna moms- och inkomstdeklaration"), det går INTE att räkna fram
// med en generell formel. Uppdatera MOMS_OCH_INKOMSTDEKLARATION_DEADLINE
// nedan varje år med det datum Skatteverket anger. Lämna den som null om
// datumet inte är känt än — kortet visar då ingen nedräkning för moms
// istället för att gissa fel.
//
// Sources:
// - Årsredovisning till Bolagsverket: senast 7 månader efter räkenskapsårets
//   slut, dvs 31 juli för kalenderår. (bolagsverket.se)
// - Årsstämma: senast 6 månader efter räkenskapsårets slut, dvs 30 juni för
//   kalenderår.
//
// Note: only weekends are pushed to the next business day — Swedish public
// holidays (röda dagar) aren't accounted for, so a date can be off by a day
// or two around Easter/midsummer/Christmas.

// Format: 'YYYY-MM-DD', or null if not yet known for the upcoming deadline.
const MOMS_OCH_INKOMSTDEKLARATION_DEADLINE: string | null = null

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

function nextAnnualDeadline(today: Date, month: number, day: number): Date {
  const start = startOfDay(today)
  let deadline = adjustForWeekend(new Date(today.getFullYear(), month, day))
  if (deadline < start) {
    deadline = adjustForWeekend(new Date(today.getFullYear() + 1, month, day))
  }
  return deadline
}

export function getImportantDates(today: Date = new Date()): ImportantDate[] {
  const arsstamma = nextAnnualDeadline(today, 5, 30) // juni = index 5
  const arsredovisning = nextAnnualDeadline(today, 6, 31) // juli = index 6

  const items: ImportantDate[] = [
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

  if (MOMS_OCH_INKOMSTDEKLARATION_DEADLINE) {
    const [y, m, d] = MOMS_OCH_INKOMSTDEKLARATION_DEADLINE.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    items.push({
      key: 'moms',
      label: 'Moms- och inkomstdeklaration',
      detail: 'helårsmoms, lämnas i anslutning till inkomstdeklarationen',
      date,
      daysLeft: daysUntil(date, today),
    })
  }

  return items.sort((a, b) => a.daysLeft - b.daysLeft)
}
