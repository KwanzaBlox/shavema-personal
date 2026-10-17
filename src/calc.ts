import type { Settings, Shift } from './types'

// Центральный модуль расчётов.
// Все денежные вычисления должны находиться только здесь,
// чтобы формулы не дублировались в разных компонентах.

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

// Часовая ставка для конкретной смены.
// Основной повар, работавший один, получает повышенную ставку (1.5x).
export function hourlyRate(shift: Shift, settings: Settings): number {
  if (shift.role === 'main' && shift.workedAlone) {
    return roundMoney(settings.baseRate * settings.soloMultiplier)
  }
  return settings.baseRate
}

// Оплата за часы конкретной смены (без премии за кассу).
export function shiftHoursPay(shift: Shift, settings: Settings): number {
  return roundMoney(hourlyRate(shift, settings) * shift.hours)
}

// Премия за дневную кассу: выбирается наибольший достигнутый порог.
export function dailyCashPremium(amount: number, settings: Settings): number {
  if (amount < 0) return 0
  let best = 0
  for (const tier of settings.premiumTiers) {
    if (amount >= tier.from && tier.premium > best) {
      best = tier.premium
    }
  }
  return best
}

// Доля премии сотрудника на смене:
// основной — 100%, дополнительный — 50%,
// а если дополнительный отработал длительный порог — 100%.
export function premiumShare(shift: Shift, settings: Settings): number {
  if (shift.role === 'main') return 1
  return shift.hours >= settings.longShiftThreshold ? 1 : 0.5
}

// Сумма весов всех смен за день — используется для пропорционального
// распределения дневной премии между поварами.
export function dayWeightSum(shifts: Shift[], settings: Settings): number {
  let sum = 0
  for (const shift of shifts) {
    sum += premiumShare(shift, settings)
  }
  return sum
}

// Доля премии конкретной смены от общей дневной премии за кассу.
// Дневная премия делится пропорционально весам ролей, поэтому касса
// не умножается на количество сотрудников.
export function shiftPremium(
  shift: Shift,
  dayPremium: number,
  dayShifts: Shift[],
  settings: Settings,
): number {
  const totalWeight = dayWeightSum(dayShifts, settings)
  if (totalWeight <= 0) return 0
  return roundMoney(dayPremium * (premiumShare(shift, settings) / totalWeight))
}

// Итог за смену: оплата часов + доля премии.
export function shiftTotal(
  shift: Shift,
  dayPremium: number,
  dayShifts: Shift[],
  settings: Settings,
): number {
  return roundMoney(
    shiftHoursPay(shift, settings) +
      shiftPremium(shift, dayPremium, dayShifts, settings),
  )
}

// Отображение денежной суммы в удобном виде.
export function formatMoney(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 2,
  }).format(value)
}
