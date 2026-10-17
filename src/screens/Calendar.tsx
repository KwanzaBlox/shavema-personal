import { useMemo, useState, type ReactNode } from 'react'
import { shiftHoursPay } from '../calc'
import {
  DAY_STATUS_LABELS,
  EMPLOYEES,
  SHIFT_ROLE_LABELS,
  getEmployee,
} from '../data'
import {
  daysInMonth,
  firstWeekday,
  formatDateLong,
  monthLabel,
  toDateString,
  todayDateString,
} from '../dates'
import { makeId, useStore } from '../store'
import { useAuth } from '../auth'
import type { Cook, DayStatus, Shift, ShiftRole } from '../types'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const STATUS_ORDER: DayStatus[] = ['work', 'dayoff', 'vacation', 'sick']

interface ShiftFormState {
  employeeId: Cook
  hours: string
  role: ShiftRole
  workedAlone: boolean
  comment: string
}

const EMPTY_FORM: ShiftFormState = {
  employeeId: 'rita',
  hours: '',
  role: 'main',
  workedAlone: false,
  comment: '',
}

function Calendar() {
  const { data, addShift, updateShift, removeShift, setDayStatus } = useStore()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const today = todayDateString()

  const now = new Date()
  const [view, setView] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ShiftFormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>()
    for (const shift of data.shifts) {
      const list = map.get(shift.date) ?? []
      list.push(shift)
      map.set(shift.date, list)
    }
    return map
  }, [data.shifts])

  function effectiveStatus(date: string): DayStatus | null {
    const hasShifts = (shiftsByDate.get(date)?.length ?? 0) > 0
    if (hasShifts) return 'work'
    return data.dayStatus[date] ?? null
  }

  function changeMonth(delta: number) {
    setView((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  function openDay(date: string) {
    setSelectedDate(date)
    setFormOpen(false)
    setEditingId(null)
    setFormError(null)
  }

  function startAdd() {
    setForm({
      ...EMPTY_FORM,
      employeeId: isAdmin
        ? EMPTY_FORM.employeeId
        : ((profile?.slug as Cook) ?? EMPTY_FORM.employeeId),
    })
    setEditingId(null)
    setFormOpen(true)
    setFormError(null)
  }

  function startEdit(shift: Shift) {
    setForm({
      employeeId: shift.employeeId,
      hours: String(shift.hours),
      role: shift.role,
      workedAlone: shift.workedAlone,
      comment: shift.comment ?? '',
    })
    setEditingId(shift.id)
    setFormOpen(true)
    setFormError(null)
  }

  function handleSave() {
    if (!selectedDate) return
    const hours = Number(form.hours.replace(',', '.'))
    if (!Number.isFinite(hours) || hours <= 0) {
      setFormError('Укажите количество часов больше нуля.')
      return
    }
    if (hours > 24) {
      setFormError('Часы за сутки не могут быть больше 24.')
      return
    }

    if (editingId) {
      const existing = data.shifts.find((shift) => shift.id === editingId)
      if (existing) {
        updateShift({
          ...existing,
          employeeId: form.employeeId,
          hours,
          role: form.role,
          workedAlone: form.role === 'main' ? form.workedAlone : false,
          comment: form.comment.trim() || undefined,
        })
      }
    } else {
      const shift: Shift = {
        id: makeId(),
        employeeId: form.employeeId,
        date: selectedDate,
        hours,
        role: form.role,
        workedAlone: form.role === 'main' ? form.workedAlone : false,
        comment: form.comment.trim() || undefined,
      }
      addShift(shift)
    }

    setFormOpen(false)
    setEditingId(null)
    setFormError(null)
  }

  function handleDelete(id: string) {
    const ok = window.confirm('Удалить эту смену? Действие нельзя отменить.')
    if (ok) removeShift(id)
  }

  const cells: ReactNode[] = []
  const totalDays = daysInMonth(view.year, view.month)
  const lead = firstWeekday(view.year, view.month)

  for (let i = 0; i < lead; i++) {
    cells.push(<div key={`lead-${i}`} className="day-cell day-cell--empty" />)
  }

  for (let day = 1; day <= totalDays; day++) {
    const date = toDateString(view.year, view.month, day)
    const shifts = shiftsByDate.get(date) ?? []
    const status = effectiveStatus(date)
    const isToday = date === today

    cells.push(
      <button
        key={date}
        type="button"
        className={`day-cell ${isToday ? 'day-cell--today' : ''}`}
        onClick={() => openDay(date)}
      >
        <span className="day-number">{day}</span>
        {status && (
          <span className={`day-badge day-badge--${status}`}>
            {DAY_STATUS_LABELS[status]}
          </span>
        )}
        <div className="day-shifts">
          {shifts.map((shift) => {
            const employee = getEmployee(shift.employeeId)
            const alone = shift.role === 'main' && shift.workedAlone
            return (
              <span key={shift.id} className="day-chip" title={shift.comment}>
                {employee?.short}
                {shift.hours}ч{alone ? '★' : ''}
              </span>
            )
          })}
        </div>
      </button>,
    )
  }

  const selectedShifts = selectedDate
    ? (shiftsByDate.get(selectedDate) ?? [])
    : []
  const selectedStatus = selectedDate ? effectiveStatus(selectedDate) : null

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">КАЛЕНДАРЬ</p>
          <h1>График смен</h1>
          <p className="subtitle">
            Нажми на день, чтобы посмотреть и изменить смены.
          </p>
        </div>
      </header>

      <section className="panel calendar-panel">
        <div className="calendar-toolbar">
          <button className="ghost-btn" onClick={() => changeMonth(-1)}>
            ‹
          </button>
          <button
            className="month-title"
            onClick={() => {
              const n = new Date()
              setView({ year: n.getFullYear(), month: n.getMonth() })
            }}
          >
            {monthLabel(view.year, view.month)}
          </button>
          <button className="ghost-btn" onClick={() => changeMonth(1)}>
            ›
          </button>
        </div>

        <div className="calendar-grid">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="weekday">
              {weekday}
            </div>
          ))}
          {cells}
        </div>
      </section>

      {selectedDate && (
        <div className="modal-backdrop" onClick={() => setSelectedDate(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{formatDateLong(selectedDate)}</h2>
                <p className="subtitle">
                  {selectedStatus
                    ? DAY_STATUS_LABELS[selectedStatus]
                    : 'Статус не задан'}
                </p>
              </div>
              <button
                className="ghost-btn modal-close"
                onClick={() => setSelectedDate(null)}
              >
                ✕
              </button>
            </div>

            <div className="field">
              <span className="field-label">Статус дня</span>
              <div className="status-picker">
                {STATUS_ORDER.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={`status-chip ${
                      selectedStatus === status ? 'status-chip--active' : ''
                    }`}
                    onClick={() => setDayStatus(selectedDate, status)}
                  >
                    {DAY_STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </div>

            <div className="shift-list-head">
              <h3>Смены</h3>
              <button className="primary-btn" onClick={startAdd}>
                ＋ Добавить смену
              </button>
            </div>

            {selectedShifts.length === 0 && !formOpen && (
              <p className="empty-note">В этот день смен пока нет.</p>
            )}

            {selectedShifts.map((shift) => {
              const employee = getEmployee(shift.employeeId)
              return (
                <div key={shift.id} className="shift-row">
                  <div className="shift-main">
                    <strong>{employee?.name}</strong>
                    <span className="shift-meta">
                      {SHIFT_ROLE_LABELS[shift.role]}
                      {shift.role === 'main' && shift.workedAlone
                        ? ' • работал один'
                        : ''}
                      {shift.comment ? ` • ${shift.comment}` : ''}
                    </span>
                  </div>
                  <div className="shift-nums">
                    <strong>{shift.hours} ч</strong>
                    <span>{shiftHoursPay(shift, data.settings)} ₽</span>
                  </div>
                  <div className="shift-actions">
                    <button
                      className="ghost-btn"
                      onClick={() => startEdit(shift)}
                    >
                      Изменить
                    </button>
                    <button
                      className="ghost-btn danger"
                      onClick={() => handleDelete(shift.id)}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              )
            })}

            {formOpen && (
              <div className="shift-form">
                <div className="field">
                  <span className="field-label">Сотрудник</span>
                  <select
                    value={form.employeeId}
                    disabled={!isAdmin}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        employeeId: event.target.value as Cook,
                      })
                    }
                  >
                    {EMPLOYEES.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <span className="field-label">Часы</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="0"
                    max="24"
                    value={form.hours}
                    onChange={(event) =>
                      setForm({ ...form, hours: event.target.value })
                    }
                    placeholder="Например 8"
                  />
                </div>

                <div className="field">
                  <span className="field-label">Роль на смене</span>
                  <select
                    value={form.role}
                    onChange={(event) =>
                      setForm({ ...form, role: event.target.value as ShiftRole })
                    }
                  >
                    <option value="main">Основной повар</option>
                    <option value="extra">Дополнительный повар</option>
                  </select>
                </div>

                {form.role === 'main' && (
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={form.workedAlone}
                      onChange={(event) =>
                        setForm({ ...form, workedAlone: event.target.checked })
                      }
                    />
                    Работал один (ставка ×1.5)
                  </label>
                )}

                <div className="field">
                  <span className="field-label">Комментарий</span>
                  <input
                    type="text"
                    value={form.comment}
                    onChange={(event) =>
                      setForm({ ...form, comment: event.target.value })
                    }
                    placeholder="Необязательно"
                  />
                </div>

                {formError && <p className="form-error">{formError}</p>}

                <div className="form-actions">
                  <button
                    className="ghost-btn"
                    onClick={() => setFormOpen(false)}
                  >
                    Отмена
                  </button>
                  <button className="primary-btn" onClick={handleSave}>
                    {editingId ? 'Сохранить' : 'Добавить'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default Calendar
