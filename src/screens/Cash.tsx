import { useMemo, useState } from 'react'
import { formatMoney, roundMoney } from '../calc'
import {
  daysInMonth,
  formatDateShort,
  monthLabel,
  toDateString,
  todayDateString,
} from '../dates'
import { useStore } from '../store'
import { useAuth } from '../auth'

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

function Cash() {
  const { data, setCash, setPlan } = useStore()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const now = new Date()
  const [view, setView] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  })
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [amountInput, setAmountInput] = useState('')
  const [editingPlan, setEditingPlan] = useState(false)
  const [planInput, setPlanInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const monthPrefix = `${view.year}-${String(view.month + 1).padStart(2, '0')}`
  const totalDays = daysInMonth(view.year, view.month)
  const today = todayDateString()
  const isCurrentMonth = monthPrefix === today.slice(0, 7)

  const monthTotal = useMemo(() => {
    let sum = 0
    for (const date of Object.keys(data.cash)) {
      if (date.startsWith(monthPrefix)) sum += data.cash[date].amount
    }
    return roundMoney(sum)
  }, [data.cash, monthPrefix])

  const plan = data.plans[monthPrefix]?.amount ?? 0
  const planPercent = plan > 0 ? roundMoney((monthTotal / plan) * 100) : 0
  const remaining = plan > 0 ? roundMoney(plan - monthTotal) : 0

  const expectedPercent = isCurrentMonth
    ? roundMoney((now.getDate() / totalDays) * 100)
    : 0
  const lagging = isCurrentMonth && plan > 0 && planPercent < expectedPercent

  const days = []
  let maxAmount = 0
  for (let day = 1; day <= totalDays; day++) {
    const date = toDateString(view.year, view.month, day)
    const entry = data.cash[date]
    const amount = entry?.amount ?? 0
    if (amount > maxAmount) maxAmount = amount
    const weekday = WEEKDAYS[new Date(view.year, view.month, day).getDay()]
    days.push({ date, weekday, amount, entry })
  }

  function changeMonth(delta: number) {
    setView((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  function openEdit(date: string) {
    const entry = data.cash[date]
    setEditingDate(date)
    setAmountInput(entry ? String(entry.amount) : '')
    setError(null)
  }

  function saveAmount() {
    if (!editingDate) return
    const amount = Number(amountInput.replace(',', '.'))
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Укажите сумму кассы не меньше нуля.')
      return
    }
    setCash(editingDate, {
      date: editingDate,
      amount: roundMoney(amount),
      author: 'Дмитрий',
      updatedAt: new Date().toISOString(),
    })
    setEditingDate(null)
    setError(null)
  }

  function savePlan() {
    const amount = Number(planInput.replace(',', '.'))
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Укажите сумму плана не меньше нуля.')
      return
    }
    setPlan(monthPrefix, roundMoney(amount))
    setEditingPlan(false)
    setPlanInput('')
    setError(null)
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">КАССА И ПЛАН</p>
          <h1>Учёт кассы</h1>
          <p className="subtitle">Одна общая сумма на каждый календарный день.</p>
        </div>
      </header>

      <div className="filters">
        <div className="filter-month">
          <button className="ghost-btn" onClick={() => changeMonth(-1)}>
            ‹
          </button>
          <span className="filter-month-label">
            {monthLabel(view.year, view.month)}
          </span>
          <button className="ghost-btn" onClick={() => changeMonth(1)}>
            ›
          </button>
        </div>
      </div>

      <section className="stats">
        <article className="stat-card">
          <span className="stat-label">Общая касса</span>
          <div className="stat-value">
            {formatMoney(monthTotal)} <small>₽</small>
          </div>
          <p>За выбранный месяц</p>
        </article>

        <article className="stat-card">
          <span className="stat-label">Месячный план</span>
          <div className="stat-value">
            {formatMoney(plan)} <small>₽</small>
          </div>
          <p>{plan > 0 ? 'Можно менять по месяцам' : 'План ещё не задан'}</p>
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
          <p>{plan > 0 ? 'Накопленная касса / план' : 'Задайте план'}</p>
        </article>

        <article className="stat-card">
          <span className="stat-label">Осталось до плана</span>
          <div className="stat-value">
            {formatMoney(Math.max(remaining, 0))} <small>₽</small>
          </div>
          <p>
            {plan > 0 && remaining <= 0
              ? 'План выполнен'
              : plan > 0
                ? 'До конца месяца'
                : 'Задайте план'}
          </p>
        </article>
      </section>

      {lagging && (
        <div className="warning-banner">
          ⚠ Команда отстаёт от месячного плана: выполнено {planPercent}% при
          ожидаемых {expectedPercent}%.
        </div>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Месячный план</h2>
            <p>Сумма плана может меняться по месяцам</p>
          </div>
        </div>

        {editingPlan ? (
          <div className="plan-editor">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={planInput}
              onChange={(event) => setPlanInput(event.target.value)}
              placeholder="Например 780000"
            />
            <button className="primary-btn" onClick={savePlan}>
              Сохранить
            </button>
            <button className="ghost-btn" onClick={() => setEditingPlan(false)}>
              Отмена
            </button>
          </div>
        ) : (
          <div className="plan-row">
            <span>{plan > 0 ? `${formatMoney(plan)} ₽` : 'План не задан'}</span>
            {isAdmin && (
              <button
                className="ghost-btn"
                onClick={() => {
                  setPlanInput(plan > 0 ? String(plan) : '')
                  setEditingPlan(true)
                }}
              >
                {plan > 0 ? 'Изменить' : 'Задать план'}
              </button>
            )}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Динамика по дням</h2>
            <p>Сумма кассы за каждый день месяца</p>
          </div>
        </div>
        <div className="cash-chart">
          {days.map((day) => (
            <div
              key={day.date}
              className="cash-chart-col"
              title={`${formatDateShort(day.date)}: ${formatMoney(day.amount)} ₽`}
            >
              <div
                className="cash-chart-bar"
                style={{
                  height: `${maxAmount > 0 ? Math.round((day.amount / maxAmount) * 100) : 0}%`,
                }}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Дневная касса</h2>
            <p>Нажми «Внести», чтобы записать сумму дня</p>
          </div>
          <span className="gold-dot" />
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>День</th>
                <th>Сумма кассы</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.date}>
                  <td>{formatDateShort(day.date)}</td>
                  <td>{day.weekday}</td>
                  <td>
                    {day.entry ? `${formatMoney(day.amount)} ₽` : '—'}
                  </td>
                  <td>
                    {isAdmin && (
                      <button
                        className="ghost-btn"
                        onClick={() => openEdit(day.date)}
                      >
                        {day.entry ? 'Изменить' : 'Внести'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editingDate && (
        <div className="modal-backdrop" onClick={() => setEditingDate(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Касса за {formatDateShort(editingDate)}</h2>
                <p className="subtitle">
                  Одна сумма на всех сотрудников этого дня
                </p>
              </div>
              <button
                className="ghost-btn modal-close"
                onClick={() => setEditingDate(null)}
              >
                ✕
              </button>
            </div>

            <div className="field">
              <span className="field-label">Сумма кассы, ₽</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amountInput}
                onChange={(event) => setAmountInput(event.target.value)}
                placeholder="Например 25000"
              />
            </div>

            {data.cash[editingDate] && (
              <p className="meta-note">
                Автор: {data.cash[editingDate].author} • изменено:{' '}
                {new Date(data.cash[editingDate].updatedAt).toLocaleString(
                  'ru-RU',
                )}
              </p>
            )}

            {error && <p className="form-error">{error}</p>}

            <div className="form-actions">
              <button
                className="ghost-btn"
                onClick={() => setEditingDate(null)}
              >
                Отмена
              </button>
              <button className="primary-btn" onClick={saveAmount}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Cash
