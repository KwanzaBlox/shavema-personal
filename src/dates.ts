const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

const MONTH_NAMES_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

export function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function toDateString(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

// День недели первого числа месяца: 0 = понедельник … 6 = воскресенье.
export function firstWeekday(year: number, month: number): number {
  const jsDay = new Date(year, month, 1).getDay() // 0 = воскресенье
  return (jsDay + 6) % 7
}

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`
}

export function formatDateLong(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number)
  return `${day} ${MONTH_NAMES_GENITIVE[month - 1]} ${year}`
}

export function currentMonth(): { year: number; month: number } {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() }
}

export function todayDateString(): string {
  const now = new Date()
  return toDateString(now.getFullYear(), now.getMonth(), now.getDate())
}

export function formatDateShort(dateString: string): string {
  const [, month, day] = dateString.split('-')
  return `${day}.${month}`
}
