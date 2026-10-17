import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  daysInMonth,
  firstWeekday,
  formatDateLong,
  formatDateShort,
  monthLabel,
  toDateString,
} from '../src/dates.ts'

test('daysInMonth: февраль високосного года — 29, обычный — 28', () => {
  assert.equal(daysInMonth(2024, 1), 29) // февраль 2024 (високосный)
  assert.equal(daysInMonth(2023, 1), 28) // февраль 2023
  assert.equal(daysInMonth(2024, 0), 31) // январь
  assert.equal(daysInMonth(2024, 3), 30) // апрель
})

test('firstWeekday: 1 января 2024 — понедельник (индекс 0)', () => {
  assert.equal(firstWeekday(2024, 0), 0)
})

test('toDateString и форматирование дат', () => {
  assert.equal(toDateString(2024, 0, 5), '2024-01-05')
  assert.equal(formatDateShort('2024-01-05'), '05.01')
  assert.equal(formatDateLong('2024-01-05'), '5 января 2024')
})

test('monthLabel возвращает русское название месяца', () => {
  assert.equal(monthLabel(2024, 0), 'Январь 2024')
  assert.equal(monthLabel(2024, 11), 'Декабрь 2024')
})
