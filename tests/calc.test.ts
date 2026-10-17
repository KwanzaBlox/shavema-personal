import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  dailyCashPremium,
  hourlyRate,
  premiumShare,
  shiftHoursPay,
  shiftPremium,
} from '../src/calc.ts'
import { DEFAULT_SETTINGS } from '../src/data.ts'
import type { Shift } from '../src/types.ts'

function makeShift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: 'test',
    employeeId: 'rita',
    date: '2026-01-10',
    hours: 8,
    role: 'main',
    workedAlone: false,
    ...overrides,
  }
}

test('часовая ставка: основной один — 255, обычный — 170', () => {
  assert.equal(
    hourlyRate(makeShift({ role: 'main', workedAlone: true }), DEFAULT_SETTINGS),
    255,
  )
  assert.equal(hourlyRate(makeShift({ role: 'main' }), DEFAULT_SETTINGS), 170)
  assert.equal(hourlyRate(makeShift({ role: 'extra' }), DEFAULT_SETTINGS), 170)
})

test('оплата часов: 8 часов один — 2040, обычные 8 часов — 1360', () => {
  assert.equal(
    shiftHoursPay(makeShift({ role: 'main', workedAlone: true, hours: 8 }), DEFAULT_SETTINGS),
    2040,
  )
  assert.equal(shiftHoursPay(makeShift({ hours: 8 }), DEFAULT_SETTINGS), 1360)
})

test('границы порогов премии по кассе', () => {
  assert.equal(dailyCashPremium(19999, DEFAULT_SETTINGS), 0)
  assert.equal(dailyCashPremium(20000, DEFAULT_SETTINGS), 300)
  assert.equal(dailyCashPremium(22999, DEFAULT_SETTINGS), 300)
  assert.equal(dailyCashPremium(23000, DEFAULT_SETTINGS), 500)
  assert.equal(dailyCashPremium(26000, DEFAULT_SETTINGS), 800)
  assert.equal(dailyCashPremium(29000, DEFAULT_SETTINGS), 1000)
  assert.equal(dailyCashPremium(32000, DEFAULT_SETTINGS), 1300)
  assert.equal(dailyCashPremium(35000, DEFAULT_SETTINGS), 1600)
  assert.equal(dailyCashPremium(37000, DEFAULT_SETTINGS), 1900)
  assert.equal(dailyCashPremium(40000, DEFAULT_SETTINGS), 2300)
  assert.equal(dailyCashPremium(45000, DEFAULT_SETTINGS), 2300)
})

test('доля премии: основной 100%, дополнительный 50% или 100% после порога 12 ч', () => {
  assert.equal(premiumShare(makeShift({ role: 'main' }), DEFAULT_SETTINGS), 1)
  assert.equal(premiumShare(makeShift({ role: 'extra', hours: 11.9 }), DEFAULT_SETTINGS), 0.5)
  assert.equal(premiumShare(makeShift({ role: 'extra', hours: 12 }), DEFAULT_SETTINGS), 1)
  assert.equal(premiumShare(makeShift({ role: 'extra', hours: 13 }), DEFAULT_SETTINGS), 1)
})

test('распределение дневной премии не умножает кассу на число сотрудников', () => {
  const main = makeShift({ id: 'm', role: 'main', hours: 8 })
  const extraShort = makeShift({
    id: 'e',
    employeeId: 'evgeniya',
    role: 'extra',
    hours: 8,
  })
  const extraLong = makeShift({
    id: 'e2',
    employeeId: 'evgeniya',
    role: 'extra',
    hours: 12,
  })

  // Один основной повар — вся премия ему.
  assert.equal(shiftPremium(main, 1000, [main], DEFAULT_SETTINGS), 1000)

  // Основной + дополнительный (короткая смена): 2/3 и 1/3.
  assert.equal(shiftPremium(main, 1000, [main, extraShort], DEFAULT_SETTINGS), 666.67)
  assert.equal(shiftPremium(extraShort, 1000, [main, extraShort], DEFAULT_SETTINGS), 333.33)

  // Основной + дополнительный (долгая смена): пополам.
  assert.equal(shiftPremium(main, 1000, [main, extraLong], DEFAULT_SETTINGS), 500)
  assert.equal(shiftPremium(extraLong, 1000, [main, extraLong], DEFAULT_SETTINGS), 500)
})
