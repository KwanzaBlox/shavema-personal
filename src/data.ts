import type { Cook, Employee, PremiumTier, Settings } from './types'

export const EMPLOYEES: Employee[] = [
  { id: 'rita', name: 'Рита', short: 'Р', role: 'employee' },
  { id: 'evgeniya', name: 'Евгения', short: 'Е', role: 'employee' },
  { id: 'dmitriy', name: 'Дмитрий', short: 'Д', role: 'admin' },
]

export const DEFAULT_PREMIUM_TIERS: PremiumTier[] = [
  { from: 20000, premium: 300 },
  { from: 23000, premium: 500 },
  { from: 26000, premium: 800 },
  { from: 29000, premium: 1000 },
  { from: 32000, premium: 1300 },
  { from: 35000, premium: 1600 },
  { from: 37000, premium: 1900 },
  { from: 40000, premium: 2300 },
]

export const DEFAULT_SETTINGS: Settings = {
  baseRate: 170,
  soloMultiplier: 1.5,
  longShiftThreshold: 12,
  premiumTiers: DEFAULT_PREMIUM_TIERS,
}

export function getEmployee(id: Cook): Employee | undefined {
  return EMPLOYEES.find((employee) => employee.id === id)
}

export const DAY_STATUS_LABELS: Record<string, string> = {
  work: 'Рабочая смена',
  dayoff: 'Выходной',
  vacation: 'Отпуск',
  sick: 'Больничный',
}

export const SHIFT_ROLE_LABELS: Record<string, string> = {
  main: 'Основной повар',
  extra: 'Дополнительный повар',
}
