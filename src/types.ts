export type Role = 'admin' | 'employee'

export type Cook = 'rita' | 'evgeniya' | 'dmitriy'

export type ShiftRole = 'main' | 'extra'

export type DayStatus = 'work' | 'dayoff' | 'vacation' | 'sick'

export interface Employee {
  id: Cook
  name: string
  short: string
  role: Role
}

export interface Shift {
  id: string
  employeeId: Cook
  date: string // 'YYYY-MM-DD'
  hours: number
  role: ShiftRole
  workedAlone: boolean
  comment?: string
}

export interface CashEntry {
  date: string // 'YYYY-MM-DD'
  amount: number
  author: string
  updatedAt: string
}

export interface MonthPlan {
  month: string // 'YYYY-MM'
  amount: number
}

export interface PremiumTier {
  from: number
  premium: number
}

export interface Settings {
  baseRate: number
  soloMultiplier: number
  longShiftThreshold: number
  premiumTiers: PremiumTier[]
}

export interface SupportMessage {
  id: string
  text: string
  author: string
  createdAt: string
}

export interface AppData {
  shifts: Shift[]
  dayStatus: Record<string, DayStatus>
  cash: Record<string, CashEntry>
  plans: Record<string, MonthPlan>
  settings: Settings
  supportMessages: SupportMessage[]
}
