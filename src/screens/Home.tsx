import { useMemo } from 'react'
import type { SectionId } from '../navigation'
import { useAuth } from '../auth'
import {
  dailyCashPremium,
  formatMoney,
  roundMoney,
  shiftHoursPay,
  shiftPremium,
} from '../calc'
import { SHIFT_ROLE_LABELS } from '../data'
import { formatDateLong, todayDateString } from '../dates'
import { useStore } from '../store'
import type { Shift } from '../types'

interface HomeProps {
  onNavigate: (id: SectionId) => void
}

function Home({ onNavigate }: HomeProps) {
  const { data } = useStore()
  const { profile } = useAuth()
  const employeeId = profile?.slug ?? ''
  const today = todayDateString()
  const monthPrefix = today.slice(0, 7)

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>()
    for (const shift of data.shifts) {
      const list = map.get(shift.date) ?? []
      list.push(shift)
      map.set(shift.date, list)
    }
    return map
  }, [data.shifts])

  const myTotals = useMemo(() => {
    let hours = 0
    let hoursPay = 0
    let premium = 0
    for (const shift of data.shifts) {
      if (!shift.date.startsWith(monthPrefix)) continue
      if (shift.employeeId !== employeeId) continue
      const dayShifts = shiftsByDate.get(shift.date) ?? [shift]
      const cashAmount = data.cash[shift.date]?.amount ?? 0
      const dayPremium = dailyCashPremium(cashAmount, data.settings)
      hours += shift.hours
      hoursPay += shiftHoursPay(shift, data.settings)
      premium += shiftPremium(shift, dayPremium, dayShifts, data.settings)
    }
    return {
      hours: roundMoney(hours),
      total: roundMoney(hoursPay + premium),
    }
  }, [
    data.shifts,
    data.cash,
    data.settings,
    shiftsByDate,
    monthPrefix,
    employeeId,
  ])

  const monthTotal = useMemo(() => {
    let sum = 0
    for (const date of Object.keys(data.cash)) {
      if (date.startsWith(monthPrefix)) sum += data.cash[date].amount
    }
    return roundMoney(sum)
  }, [data.cash, monthPrefix])

  const plan = data.plans[monthPrefix]?.amount ?? 0
  const planPercent = plan > 0 ? roundMoney((monthTotal / plan) * 100) : 0

  const nextShift = useMemo(() => {
    const future = data.shifts
      .filter((shift) => shift.employeeId === employeeId && shift.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
    return future[0]
  }, [data.shifts, today, employeeId])

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">ПАНЕЛЬ УПРАВЛЕНИЯ</p>
          <h1>Добро пожаловать!</h1>
          <p className="subtitle">Всё самое важное — в одном месте.</p>
        </div>
        <div className="status"><span /> Система активна</div>
      </header>

      <section className="stats">
        <article className="stat-card">
          <span className="stat-label">Моя зарплата</span>
          <div className="stat-value">
            {formatMoney(myTotals.total)} <small>₽</small>
          </div>
          <p>За текущий месяц</p>
        </article>

        <article className="stat-card">
          <span className="stat-label">Отработано часов</span>
          <div className="stat-value">
            {myTotals.hours} <small>ч</small>
          </div>
          <p>За текущий месяц</p>
        </article>

        <article className="stat-card">
          <span className="stat-label">Общая касса</span>
          <div className="stat-value">
            {formatMoney(monthTotal)} <small>₽</small>
          </div>
          <p>За текущий месяц</p>
        </article>

        <article className="stat-card accent-card">
          <span className="stat-label">Выполнение плана</span>
          <div className="stat-value">
            {planPercent}
            <small>%</small>
          </div>
          <div className="progress">
            <span style={{ width: `${Math.min(planPercent, 100)}%` }} />
          </div>
          <p>{plan > 0 ? 'Накопленная касса / план' : 'План ещё не задан'}</p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Ближайшая смена</h2>
            <p>Твой следующий выход на работу</p>
          </div>
          <span className="gold-dot" />
        </div>

        {nextShift ? (
          <div className="next-shift">
            <div>
              <strong>{formatDateLong(nextShift.date)}</strong>
              <span>
                {SHIFT_ROLE_LABELS[nextShift.role]}
                {nextShift.role === 'main' && nextShift.workedAlone
                  ? ' • работал один'
                  : ''}
              </span>
            </div>
            <div className="next-shift-hours">
              <strong>{nextShift.hours} ч</strong>
              <span>часов</span>
            </div>
          </div>
        ) : (
          <p className="empty-note">Ближайших смен пока нет.</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Быстрые действия</h2>
            <p>Основные инструменты для работы</p>
          </div>
          <span className="gold-dot" />
        </div>

        <div className="actions">
          <button
            className="action-card"
            onClick={() => onNavigate('calendar')}
          >
            <span className="action-icon">＋</span>
            <strong>Добавить смену</strong>
            <span>Записать часы работы</span>
          </button>

          <button className="action-card" onClick={() => onNavigate('cash')}>
            <span className="action-icon">₽</span>
            <strong>Внести кассу</strong>
            <span>Добавить дневную выручку</span>
          </button>

          <button className="action-card" onClick={() => onNavigate('calendar')}>
            <span className="action-icon">▤</span>
            <strong>Открыть график</strong>
            <span>Посмотреть смены</span>
          </button>
        </div>
      </section>
    </>
  )
}

export default Home
