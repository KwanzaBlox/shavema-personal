import { useMemo, useState } from 'react'
import {
  dailyCashPremium,
  formatMoney,
  roundMoney,
  shiftHoursPay,
  shiftPremium,
} from '../calc'
import { EMPLOYEES } from '../data'
import { monthLabel } from '../dates'
import { useStore } from '../store'
import type { Shift } from '../types'

function Reports() {
  const { data } = useStore()
  const now = new Date()
  const [view, setView] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  })
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const monthPrefix = `${view.year}-${String(view.month + 1).padStart(2, '0')}`

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>()
    for (const shift of data.shifts) {
      const list = map.get(shift.date) ?? []
      list.push(shift)
      map.set(shift.date, list)
    }
    return map
  }, [data.shifts])

  const employeeTotals = useMemo(() => {
    return EMPLOYEES.map((employee) => {
      let hours = 0
      let hoursPay = 0
      let premium = 0
      let total = 0
      for (const shift of data.shifts) {
        if (!shift.date.startsWith(monthPrefix)) continue
        if (shift.employeeId !== employee.id) continue
        const dayShifts = shiftsByDate.get(shift.date) ?? [shift]
        const cashAmount = data.cash[shift.date]?.amount ?? 0
        const dayPremium = dailyCashPremium(cashAmount, data.settings)
        const hp = shiftHoursPay(shift, data.settings)
        const p = shiftPremium(shift, dayPremium, dayShifts, data.settings)
        hours += shift.hours
        hoursPay += hp
        premium += p
        total += hp + p
      }
      return {
        employee,
        hours: roundMoney(hours),
        hoursPay: roundMoney(hoursPay),
        premium: roundMoney(premium),
        total: roundMoney(total),
      }
    })
  }, [data.shifts, data.cash, data.settings, shiftsByDate, monthPrefix])

  const monthTotal = useMemo(() => {
    let sum = 0
    for (const date of Object.keys(data.cash)) {
      if (date.startsWith(monthPrefix)) sum += data.cash[date].amount
    }
    return roundMoney(sum)
  }, [data.cash, monthPrefix])

  const plan = data.plans[monthPrefix]?.amount ?? 0
  const planPercent = plan > 0 ? roundMoney((monthTotal / plan) * 100) : 0

  function changeMonth(delta: number) {
    setView((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  async function handleExport() {
    setExporting(true)
    setError(null)
    try {
      const { exportMonthExcel } = await import('../excel')
      await exportMonthExcel(data, view.year, view.month)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать файл')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">ОТЧЁТЫ</p>
          <h1>Месячная статистика</h1>
          <p className="subtitle">Итоги месяца и экспорт в Excel.</p>
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
        <button
          className="primary-btn"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? 'Готовим файл…' : '⬇ Экспорт в Excel'}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      <section className="stats">
        <article className="stat-card">
          <span className="stat-label">Общая касса</span>
          <div className="stat-value">
            {formatMoney(monthTotal)} <small>₽</small>
          </div>
          <p>За месяц</p>
        </article>

        <article className="stat-card">
          <span className="stat-label">Месячный план</span>
          <div className="stat-value">
            {formatMoney(plan)} <small>₽</small>
          </div>
          <p>{plan > 0 ? 'Задан в разделе «Касса»' : 'План не задан'}</p>
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
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Зарплата по сотрудникам</h2>
            <p>Часы, оплата за часы, премия и итог за месяц</p>
          </div>
          <span className="gold-dot" />
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Часы</th>
                <th>Почасовая оплата</th>
                <th>Премия</th>
                <th>Итог</th>
              </tr>
            </thead>
            <tbody>
              {employeeTotals.map((row) => (
                <tr key={row.employee.id}>
                  <td>{row.employee.name}</td>
                  <td>{row.hours}</td>
                  <td>{formatMoney(row.hoursPay)} ₽</td>
                  <td>{formatMoney(row.premium)} ₽</td>
                  <td className="cell-total">{formatMoney(row.total)} ₽</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

export default Reports
