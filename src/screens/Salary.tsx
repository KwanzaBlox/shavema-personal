import { useMemo, useState } from 'react'
import {
  dailyCashPremium,
  formatMoney,
  roundMoney,
  shiftHoursPay,
  shiftPremium,
  shiftTotal,
} from '../calc'
import { EMPLOYEES, getEmployee } from '../data'
import { formatDateShort, monthLabel } from '../dates'
import { useStore } from '../store'
import type { Cook, Shift } from '../types'

interface Row {
  shift: Shift
  cashAmount: number
  hoursPay: number
  premium: number
  total: number
}

function Salary() {
  const { data } = useStore()
  const now = new Date()
  const [view, setView] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  })
  const [employeeFilter, setEmployeeFilter] = useState<Cook | 'all'>('all')

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>()
    for (const shift of data.shifts) {
      const list = map.get(shift.date) ?? []
      list.push(shift)
      map.set(shift.date, list)
    }
    return map
  }, [data.shifts])

  const monthPrefix = `${view.year}-${String(view.month + 1).padStart(2, '0')}`

  const rows = useMemo(() => {
    const result: Row[] = []
    for (const shift of data.shifts) {
      if (!shift.date.startsWith(monthPrefix)) continue
      if (employeeFilter !== 'all' && shift.employeeId !== employeeFilter) {
        continue
      }
      const dayShifts = shiftsByDate.get(shift.date) ?? [shift]
      const cashAmount = data.cash[shift.date]?.amount ?? 0
      const dayPremium = dailyCashPremium(cashAmount, data.settings)
      result.push({
        shift,
        cashAmount,
        hoursPay: shiftHoursPay(shift, data.settings),
        premium: shiftPremium(shift, dayPremium, dayShifts, data.settings),
        total: shiftTotal(shift, dayPremium, dayShifts, data.settings),
      })
    }
    result.sort((a, b) => a.shift.date.localeCompare(b.shift.date))
    return result
  }, [
    data.shifts,
    data.cash,
    data.settings,
    shiftsByDate,
    monthPrefix,
    employeeFilter,
  ])

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => ({
        hours: roundMoney(acc.hours + row.shift.hours),
        hoursPay: roundMoney(acc.hoursPay + row.hoursPay),
        premium: roundMoney(acc.premium + row.premium),
        total: roundMoney(acc.total + row.total),
      }),
      { hours: 0, hoursPay: 0, premium: 0, total: 0 },
    )
  }, [rows])

  function changeMonth(delta: number) {
    setView((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">ЗАРПЛАТА</p>
          <h1>Расчёт зарплаты</h1>
          <p className="subtitle">Разбивка по дням: часы, ставка, премия и итог.</p>
        </div>
      </header>

      <section className="panel">
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

          <select
            className="filter-select"
            value={employeeFilter}
            onChange={(event) =>
              setEmployeeFilter(event.target.value as Cook | 'all')
            }
          >
            <option value="all">Все сотрудники</option>
            {EMPLOYEES.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </div>

        {rows.length === 0 ? (
          <p className="empty-note">За выбранный месяц смен нет.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Сотрудник</th>
                  <th>Часы</th>
                  <th>Сумма кассы</th>
                  <th>Почасовая оплата</th>
                  <th>Премия</th>
                  <th>Итог за смену</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const employee = getEmployee(row.shift.employeeId)
                  return (
                    <tr key={row.shift.id}>
                      <td>{formatDateShort(row.shift.date)}</td>
                      <td>{employee?.name}</td>
                      <td>{row.shift.hours}</td>
                      <td>{formatMoney(row.cashAmount)} ₽</td>
                      <td>{formatMoney(row.hoursPay)} ₽</td>
                      <td>{formatMoney(row.premium)} ₽</td>
                      <td className="cell-total">{formatMoney(row.total)} ₽</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Итого</td>
                  <td>{totals.hours}</td>
                  <td />
                  <td>{formatMoney(totals.hoursPay)} ₽</td>
                  <td>{formatMoney(totals.premium)} ₽</td>
                  <td className="cell-total">{formatMoney(totals.total)} ₽</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

export default Salary
