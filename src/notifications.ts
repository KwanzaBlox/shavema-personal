import { roundMoney } from './calc'
import { getEmployee } from './data'
import {
  daysInMonth,
  formatDateShort,
  toDateString,
  todayDateString,
} from './dates'
import type { AppData, Shift } from './types'

export interface AppNotification {
  type: string
  message: string
}

// Формирует уведомления внутри приложения на основе текущих данных.
export function computeNotifications(data: AppData): AppNotification[] {
  const list: AppNotification[] = []
  const today = todayDateString()
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7)) - 1
  const day = Number(today.slice(8, 10))
  const monthPrefix = today.slice(0, 7)
  const totalDays = daysInMonth(year, month)

  const shiftsByDate = new Map<string, Shift[]>()
  for (const shift of data.shifts) {
    const arr = shiftsByDate.get(shift.date) ?? []
    arr.push(shift)
    shiftsByDate.set(shift.date, arr)
  }

  // 1. Не внесена касса за прошедшие дни, в которые были смены.
  for (let d = 1; d <= day; d++) {
    const date = toDateString(year, month, d)
    const hasShifts = (shiftsByDate.get(date)?.length ?? 0) > 0
    if (hasShifts && !data.cash[date]) {
      list.push({
        type: 'Касса',
        message: `Не внесена касса за ${formatDateShort(date)}.`,
      })
    }
  }

  // 2. Выполнение плана и отставание от плана.
  const plan = data.plans[monthPrefix]?.amount ?? 0
  if (plan > 0) {
    let total = 0
    for (const d of Object.keys(data.cash)) {
      if (d.startsWith(monthPrefix)) total += data.cash[d].amount
    }
    const percent = roundMoney((total / plan) * 100)

    if (percent >= 100) {
      list.push({ type: 'План', message: 'План месяца выполнен на 100%.' })
    } else if (percent >= 90) {
      list.push({ type: 'План', message: 'Выполнено 90% месячного плана.' })
    } else if (percent >= 75) {
      list.push({ type: 'План', message: 'Выполнено 75% месячного плана.' })
    } else if (percent >= 50) {
      list.push({ type: 'План', message: 'Выполнено 50% месячного плана.' })
    }

    const expected = roundMoney((day / totalDays) * 100)
    if (percent < expected) {
      list.push({
        type: 'План',
        message: `Команда отстаёт от плана: ${percent}% при ожидаемых ${expected}%.`,
      })
    }
  }

  // 3. Напоминание о смене на завтра.
  const now = new Date()
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const tomorrowStr = toDateString(
    tomorrow.getFullYear(),
    tomorrow.getMonth(),
    tomorrow.getDate(),
  )
  const tomorrowShifts = shiftsByDate.get(tomorrowStr) ?? []
  if (tomorrowShifts.length > 0) {
    const names = tomorrowShifts
      .map((shift) => getEmployee(shift.employeeId)?.name ?? '')
      .filter(Boolean)
      .join(', ')
    list.push({
      type: 'Смена',
      message: `Завтра смена: ${names}.`,
    })
  }

  return list
}
