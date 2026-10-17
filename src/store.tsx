import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './auth'
import { DEFAULT_SETTINGS } from './data'
import {
  fetchAllData,
  fetchProfileMaps,
  uploadLocalData,
  type ProfileMaps,
} from './lib/supabase-data'
import { supabase } from './lib/supabase'
import type {
  AppData,
  CashEntry,
  Cook,
  DayStatus,
  Settings,
  Shift,
  SupportMessage,
} from './types'

const STORAGE_KEY = 'shaverma-personal-data-v1'

export function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const EMPTY_DATA: AppData = {
  shifts: [],
  dayStatus: {},
  cash: {},
  plans: {},
  settings: { ...DEFAULT_SETTINGS, premiumTiers: [...DEFAULT_SETTINGS.premiumTiers] },
  supportMessages: [],
}

function loadLocal(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_DATA
    const parsed = JSON.parse(raw) as Partial<AppData>
    return {
      ...EMPTY_DATA,
      ...parsed,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    }
  } catch {
    return EMPTY_DATA
  }
}

interface StoreValue {
  data: AppData
  ready: boolean
  addShift: (shift: Shift) => void
  updateShift: (shift: Shift) => void
  removeShift: (id: string) => void
  setDayStatus: (date: string, status: DayStatus | null) => void
  setCash: (date: string, entry: CashEntry) => void
  setPlan: (month: string, amount: number) => void
  updateSettings: (settings: Settings) => void
  addSupportMessage: (message: SupportMessage) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [data, setData] = useState<AppData>(loadLocal)
  const [profiles, setProfiles] = useState<ProfileMaps>({
    slugToUuid: {},
    uuidToName: {},
  })
  const [ready, setReady] = useState(false)

  const slug = profile?.slug ?? null

  // Загрузка данных из Supabase при входе.
  useEffect(() => {
    if (!supabase || !slug) {
      setReady(true)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const maps = await fetchProfileMaps()
        let serverData = await fetchAllData(maps)

        // Если база ещё пустая, а в браузере есть локальные данные —
        // переносим их в облако, чтобы ничего не потерялось.
        const local = loadLocal()
        const serverEmpty =
          serverData.shifts.length === 0 &&
          Object.keys(serverData.cash).length === 0 &&
          Object.keys(serverData.plans).length === 0 &&
          Object.keys(serverData.dayStatus).length === 0
        const localHasData =
          local.shifts.length > 0 ||
          Object.keys(local.cash).length > 0 ||
          Object.keys(local.plans).length > 0 ||
          Object.keys(local.dayStatus).length > 0
        if (serverEmpty && localHasData) {
          await uploadLocalData(local, maps, profile?.id ?? null)
          serverData = local
        }

        if (!cancelled) {
          setProfiles(maps)
          setData(serverData)
        }
      } catch (error) {
        console.error('Не удалось загрузить данные из Supabase:', error)
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  // Realtime: мгновенно подхватываем изменения из базы других устройств.
  useEffect(() => {
    if (!supabase || !slug) return

    const uuidToSlug: Record<string, string> = {}
    for (const [s, id] of Object.entries(profiles.slugToUuid)) {
      uuidToSlug[id] = s
    }

    const channel = supabase
      .channel('data-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = payload.old?.id
            setData((prev) => ({
              ...prev,
              shifts: prev.shifts.filter((item) => item.id !== oldId),
            }))
            return
          }
          const row = payload.new
          if (!row) return
          const shift: Shift = {
            id: row.id,
            employeeId: (uuidToSlug[row.employee_id] ?? '') as Cook,
            date: row.shift_date,
            hours: Number(row.hours),
            role: row.role,
            workedAlone: row.worked_alone,
            comment: row.comment ?? undefined,
          }
          setData((prev) => {
            const exists = prev.shifts.some((item) => item.id === shift.id)
            return {
              ...prev,
              shifts: exists
                ? prev.shifts.map((item) => (item.id === shift.id ? shift : item))
                : [...prev.shifts, shift],
            }
          })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_cash' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const date = payload.old?.cash_date
            setData((prev) => {
              const cash = { ...prev.cash }
              if (date) delete cash[date]
              return { ...prev, cash }
            })
            return
          }
          const row = payload.new
          if (!row) return
          setData((prev) => ({
            ...prev,
            cash: {
              ...prev.cash,
              [row.cash_date]: {
                date: row.cash_date,
                amount: Number(row.amount),
                author: row.author_id
                  ? (profiles.uuidToName[row.author_id] ?? '')
                  : '',
                updatedAt: row.updated_at,
              },
            },
          }))
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'monthly_plans' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const month = payload.old?.plan_month
            setData((prev) => {
              const plans = { ...prev.plans }
              if (month) delete plans[month]
              return { ...prev, plans }
            })
            return
          }
          const row = payload.new
          if (!row) return
          setData((prev) => ({
            ...prev,
            plans: {
              ...prev.plans,
              [row.plan_month]: { month: row.plan_month, amount: Number(row.amount) },
            },
          }))
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings' },
        (payload) => {
          const row = payload.new as any
          if (!row) return
          setData((prev) => ({
            ...prev,
            settings: {
              baseRate: Number(row.base_rate),
              soloMultiplier: Number(row.solo_multiplier),
              longShiftThreshold: Number(row.long_shift_threshold),
              premiumTiers: Array.isArray(row.premium_tiers)
                ? row.premium_tiers
                : prev.settings.premiumTiers,
            },
          }))
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'day_status' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const date = payload.old?.status_date
            setData((prev) => {
              const next = { ...prev.dayStatus }
              if (date) delete next[date]
              return { ...prev, dayStatus: next }
            })
            return
          }
          const row = payload.new
          if (!row) return
          setData((prev) => ({
            ...prev,
            dayStatus: { ...prev.dayStatus, [row.status_date]: row.status },
          }))
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_messages' },
        (payload) => {
          if (payload.eventType === 'DELETE') return
          const row = payload.new
          if (!row) return
          setData((prev) => {
            if (prev.supportMessages.some((item) => item.id === row.id)) return prev
            return {
              ...prev,
              supportMessages: [
                {
                  id: row.id,
                  text: row.message,
                  author: profiles.uuidToName[row.user_id] ?? '',
                  createdAt: row.created_at,
                },
                ...prev.supportMessages,
              ],
            }
          })
        },
      )

    channel.subscribe()
    return () => {
      supabase?.removeChannel(channel)
    }
  }, [slug, profiles])

  // Кэширование в localStorage (для офлайн-устойчивости).
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  const value = useMemo<StoreValue>(() => {
    const authorId = profile?.id ?? null

    function writeShift(shift: Shift, mode: 'insert' | 'update') {
      if (!supabase) return
      const employeeId = profiles.slugToUuid[shift.employeeId]
      if (!employeeId) return
      const row = {
        id: shift.id,
        employee_id: employeeId,
        shift_date: shift.date,
        hours: shift.hours,
        role: shift.role,
        worked_alone: shift.workedAlone,
        comment: shift.comment ?? null,
      }
      const request =
        mode === 'insert'
          ? supabase.from('shifts').insert(row)
          : supabase.from('shifts').update(row).eq('id', shift.id)
      request.then(({ error }) => {
        if (error) console.error('Ошибка сохранения смены:', error)
      })
    }

    return {
      data,
      ready,
      addShift: (shift) => {
        setData((prev) => ({ ...prev, shifts: [...prev.shifts, shift] }))
        writeShift(shift, 'insert')
      },
      updateShift: (shift) => {
        setData((prev) => ({
          ...prev,
          shifts: prev.shifts.map((item) => (item.id === shift.id ? shift : item)),
        }))
        writeShift(shift, 'update')
      },
      removeShift: (id) => {
        setData((prev) => ({
          ...prev,
          shifts: prev.shifts.filter((item) => item.id !== id),
        }))
        supabase
          ?.from('shifts')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (error) console.error('Ошибка удаления смены:', error)
          })
      },
      setDayStatus: (date, status) => {
        setData((prev) => {
          const next = { ...prev.dayStatus }
          if (status === null) delete next[date]
          else next[date] = status
          return { ...prev, dayStatus: next }
        })
        if (!supabase) return
        if (status === null) {
          supabase
            .from('day_status')
            .delete()
            .eq('status_date', date)
            .then(({ error }) => {
              if (error) console.error('Ошибка удаления статуса дня:', error)
            })
        } else {
          supabase
            .from('day_status')
            .upsert({ status_date: date, status }, { onConflict: 'status_date' })
            .then(({ error }) => {
              if (error) console.error('Ошибка сохранения статуса дня:', error)
            })
        }
      },
      setCash: (date, entry) => {
        setData((prev) => ({ ...prev, cash: { ...prev.cash, [date]: entry } }))
        supabase
          ?.from('daily_cash')
          .upsert(
            {
              cash_date: date,
              amount: entry.amount,
              author_id: authorId,
              updated_at: entry.updatedAt,
            },
            { onConflict: 'cash_date' },
          )
          .then(({ error }) => {
            if (error) console.error('Ошибка сохранения кассы:', error)
          })
      },
      setPlan: (month, amount) => {
        setData((prev) => ({
          ...prev,
          plans: { ...prev.plans, [month]: { month, amount } },
        }))
        supabase
          ?.from('monthly_plans')
          .upsert({ plan_month: month, amount }, { onConflict: 'plan_month' })
          .then(({ error }) => {
            if (error) console.error('Ошибка сохранения плана:', error)
          })
      },
      updateSettings: (settings) => {
        setData((prev) => ({ ...prev, settings }))
        supabase
          ?.from('app_settings')
          .upsert(
            {
              id: 1,
              base_rate: settings.baseRate,
              solo_multiplier: settings.soloMultiplier,
              long_shift_threshold: settings.longShiftThreshold,
              premium_tiers: settings.premiumTiers,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' },
          )
          .then(({ error }) => {
            if (error) console.error('Ошибка сохранения настроек:', error)
          })
      },
      addSupportMessage: (message) => {
        setData((prev) => ({
          ...prev,
          supportMessages: [message, ...prev.supportMessages],
        }))
        supabase
          ?.from('support_messages')
          .insert({
            id: message.id,
            user_id: authorId,
            message: message.text,
            created_at: message.createdAt,
          })
          .then(({ error }) => {
            if (error) console.error('Ошибка отправки сообщения:', error)
          })
      },
    }
  }, [data, ready, profiles, profile])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) {
    throw new Error('useStore должен использоваться внутри StoreProvider')
  }
  return ctx
}
