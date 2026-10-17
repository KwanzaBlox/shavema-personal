import { supabase } from './supabase'
import { DEFAULT_SETTINGS } from '../data'
import type {
  AppData,
  CashEntry,
  Cook,
  DayStatus,
  MonthPlan,
  Shift,
  SupportMessage,
} from '../types'

export interface ProfileMaps {
  slugToUuid: Record<string, string>
  uuidToName: Record<string, string>
}

// Загружает профили и строит карты: slug -> uuid и uuid -> имя.
export async function fetchProfileMaps(): Promise<ProfileMaps> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('profiles')
    .select('id, slug, full_name')
  if (error) throw error

  const slugToUuid: Record<string, string> = {}
  const uuidToName: Record<string, string> = {}
  for (const row of data ?? []) {
    if (row.slug) slugToUuid[row.slug] = row.id
    uuidToName[row.id] = row.full_name
  }
  return { slugToUuid, uuidToName }
}

// Загружает все данные приложения из Supabase.
export async function fetchAllData(maps: ProfileMaps): Promise<AppData> {
  if (!supabase) throw new Error('Supabase не настроен')

  const uuidToSlug: Record<string, string> = {}
  for (const [slug, id] of Object.entries(maps.slugToUuid)) {
    uuidToSlug[id] = slug
  }

  const [shifts, dayStatus, cash, plans, settings, support] = await Promise.all([
    supabase.from('shifts').select('*').order('shift_date', { ascending: true }),
    supabase.from('day_status').select('*'),
    supabase.from('daily_cash').select('*'),
    supabase.from('monthly_plans').select('*'),
    supabase.from('app_settings').select('*').eq('id', 1).maybeSingle(),
    supabase
      .from('support_messages')
      .select('*')
      .order('created_at', { ascending: false }),
  ])

  if (shifts.error) throw shifts.error
  if (dayStatus.error) throw dayStatus.error
  if (cash.error) throw cash.error
  if (plans.error) throw plans.error

  const result: AppData = {
    shifts: (shifts.data ?? []).map((row): Shift => ({
      id: row.id,
      employeeId: (uuidToSlug[row.employee_id] ?? '') as Cook,
      date: row.shift_date,
      hours: Number(row.hours),
      role: row.role,
      workedAlone: row.worked_alone,
      comment: row.comment ?? undefined,
    })),
    dayStatus: {},
    cash: {},
    plans: {},
    settings: { ...DEFAULT_SETTINGS, premiumTiers: [...DEFAULT_SETTINGS.premiumTiers] },
    supportMessages: [],
  }

  for (const row of dayStatus.data ?? []) {
    result.dayStatus[row.status_date] = row.status as DayStatus
  }

  for (const row of cash.data ?? []) {
    const entry: CashEntry = {
      date: row.cash_date,
      amount: Number(row.amount),
      author: row.author_id ? (maps.uuidToName[row.author_id] ?? '') : '',
      updatedAt: row.updated_at,
    }
    result.cash[row.cash_date] = entry
  }

  for (const row of plans.data ?? []) {
    const plan: MonthPlan = { month: row.plan_month, amount: Number(row.amount) }
    result.plans[row.plan_month] = plan
  }

  if (settings.data) {
    const tiers = settings.data.premium_tiers
    result.settings = {
      baseRate: Number(settings.data.base_rate),
      soloMultiplier: Number(settings.data.solo_multiplier),
      longShiftThreshold: Number(settings.data.long_shift_threshold),
      premiumTiers: Array.isArray(tiers) ? tiers : [],
    }
  }

  for (const row of support.data ?? []) {
    const message: SupportMessage = {
      id: row.id,
      text: row.message,
      author: maps.uuidToName[row.user_id] ?? '',
      createdAt: row.created_at,
    }
    result.supportMessages.push(message)
  }

  return result
}

// Переносит локальные данные (из localStorage) в Supabase.
// Используется один раз при первом входе, если база ещё пустая.
export async function uploadLocalData(
  local: AppData,
  maps: ProfileMaps,
  authorId: string | null,
): Promise<void> {
  if (!supabase) return

  if (local.shifts.length > 0) {
    const rows: Array<{
      id: string
      employee_id: string
      shift_date: string
      hours: number
      role: string
      worked_alone: boolean
      comment: string | null
    }> = []
    for (const shift of local.shifts) {
      const employeeId = maps.slugToUuid[shift.employeeId]
      if (!employeeId) continue
      rows.push({
        id: shift.id,
        employee_id: employeeId,
        shift_date: shift.date,
        hours: shift.hours,
        role: shift.role,
        worked_alone: shift.workedAlone,
        comment: shift.comment ?? null,
      })
    }
    if (rows.length > 0) {
      const { error } = await supabase.from('shifts').insert(rows)
      if (error) console.error('Ошибка переноса смен:', error)
    }
  }

  const cashRows = Object.values(local.cash).map((entry) => ({
    cash_date: entry.date,
    amount: entry.amount,
    author_id: authorId,
    updated_at: entry.updatedAt,
  }))
  if (cashRows.length > 0) {
    const { error } = await supabase
      .from('daily_cash')
      .upsert(cashRows, { onConflict: 'cash_date' })
    if (error) console.error('Ошибка переноса кассы:', error)
  }

  const planRows = Object.values(local.plans).map((plan) => ({
    plan_month: plan.month,
    amount: plan.amount,
  }))
  if (planRows.length > 0) {
    const { error } = await supabase
      .from('monthly_plans')
      .upsert(planRows, { onConflict: 'plan_month' })
    if (error) console.error('Ошибка переноса планов:', error)
  }

  const statusRows = Object.entries(local.dayStatus).map(([date, status]) => ({
    status_date: date,
    status,
  }))
  if (statusRows.length > 0) {
    const { error } = await supabase
      .from('day_status')
      .upsert(statusRows, { onConflict: 'status_date' })
    if (error) console.error('Ошибка переноса статусов:', error)
  }

  const { error } = await supabase.from('app_settings').upsert(
    {
      id: 1,
      base_rate: local.settings.baseRate,
      solo_multiplier: local.settings.soloMultiplier,
      long_shift_threshold: local.settings.longShiftThreshold,
      premium_tiers: local.settings.premiumTiers,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )
  if (error) console.error('Ошибка переноса настроек:', error)
}
