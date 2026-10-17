import ExcelJS from 'exceljs'
import {
  dailyCashPremium,
  shiftHoursPay,
  shiftPremium,
  shiftTotal,
} from './calc'
import { DAY_STATUS_LABELS, EMPLOYEES } from './data'
import { daysInMonth, monthLabel, pad2, toDateString } from './dates'
import type { AppData, DayStatus, Shift } from './types'

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

function styleHeaderCell(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F1F23' },
  }
}

function effectiveStatus(
  shifts: Shift[],
  dayStatus: Record<string, DayStatus>,
  date: string,
): string {
  if (shifts.length > 0) return DAY_STATUS_LABELS.work
  const status = dayStatus[date]
  return status ? DAY_STATUS_LABELS[status] : ''
}

export async function exportMonthExcel(
  data: AppData,
  year: number,
  month: number,
): Promise<void> {
  const monthPrefix = `${year}-${pad2(month + 1)}`
  const totalDays = daysInMonth(year, month)

  const shiftsByDate = new Map<string, Shift[]>()
  for (const shift of data.shifts) {
    const list = shiftsByDate.get(shift.date) ?? []
    list.push(shift)
    shiftsByDate.set(shift.date, list)
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Шаверма персонал'

  // ---------- Лист 1: График ----------
  const schedule = workbook.addWorksheet('График', {
    views: [{ state: 'frozen', ySplit: 2 }],
  })
  schedule.columns = [
    { width: 12 },
    { width: 8 },
    { width: 16 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
  ]

  schedule.mergeCells(1, 1, 1, 6)
  const title = schedule.getCell(1, 1)
  title.value = monthLabel(year, month)
  title.font = { bold: true, size: 14 }
  title.alignment = { horizontal: 'center' }

  const headers = ['Дата', 'День', 'Статус', ...EMPLOYEES.map((e) => e.name)]
  headers.forEach((header, index) => {
    const cell = schedule.getCell(2, index + 1)
    cell.value = header
    styleHeaderCell(cell)
    cell.alignment = { horizontal: 'center' }
  })

  for (let day = 1; day <= totalDays; day++) {
    const date = toDateString(year, month, day)
    const shifts = shiftsByDate.get(date) ?? []
    const row = schedule.addRow([])
    row.getCell(1).value = new Date(year, month, day)
    row.getCell(1).numFmt = 'dd.mm.yyyy'
    row.getCell(2).value = WEEKDAYS[new Date(year, month, day).getDay()]
    row.getCell(3).value = effectiveStatus(shifts, data.dayStatus, date)
    EMPLOYEES.forEach((employee, index) => {
      const hours = shifts
        .filter((shift) => shift.employeeId === employee.id)
        .reduce((sum, shift) => sum + shift.hours, 0)
      row.getCell(4 + index).value = hours > 0 ? hours : null
    })
  }

  const totalRow = schedule.addRow([])
  totalRow.getCell(1).value = 'Итого часов'
  totalRow.getCell(1).font = { bold: true }
  EMPLOYEES.forEach((employee, index) => {
    let sum = 0
    for (const shift of data.shifts) {
      if (
        shift.date.startsWith(monthPrefix) &&
        shift.employeeId === employee.id
      ) {
        sum += shift.hours
      }
    }
    const cell = totalRow.getCell(4 + index)
    cell.value = sum
    cell.font = { bold: true }
  })

  // ---------- Лист 2: Касса ----------
  const cashSheet = workbook.addWorksheet('Касса')
  cashSheet.columns = [
    { header: 'Дата', key: 'date', width: 12 },
    { header: 'Сумма кассы', key: 'amount', width: 16 },
    { header: 'Премия за кассу', key: 'premium', width: 16 },
  ]
  cashSheet.getRow(1).eachCell((cell) => styleHeaderCell(cell))

  let cashTotal = 0
  let premiumTotal = 0
  const cashDates = Object.keys(data.cash).sort()
  for (const date of cashDates) {
    if (!date.startsWith(monthPrefix)) continue
    const entry = data.cash[date]
    const premium = dailyCashPremium(entry.amount, data.settings)
    cashTotal += entry.amount
    premiumTotal += premium
    const row = cashSheet.addRow([])
    row.getCell(1).value = new Date(
      Number(date.slice(0, 4)),
      Number(date.slice(5, 7)) - 1,
      Number(date.slice(8, 10)),
    )
    row.getCell(1).numFmt = 'dd.mm.yyyy'
    row.getCell(2).value = entry.amount
    row.getCell(2).numFmt = '#,##0.00'
    row.getCell(3).value = premium
    row.getCell(3).numFmt = '#,##0.00'
  }

  const cashTotalRow = cashSheet.addRow(['Итого', cashTotal, premiumTotal])
  cashTotalRow.font = { bold: true }
  cashTotalRow.getCell(2).numFmt = '#,##0.00'
  cashTotalRow.getCell(3).numFmt = '#,##0.00'

  // ---------- Лист 3: Зарплата ----------
  const salarySheet = workbook.addWorksheet('Зарплата')
  salarySheet.columns = [
    { header: 'Дата', key: 'date', width: 12 },
    { header: 'Сотрудник', key: 'employee', width: 14 },
    { header: 'Часы', key: 'hours', width: 8 },
    { header: 'Почасовая оплата', key: 'hoursPay', width: 16 },
    { header: 'Премия', key: 'premium', width: 12 },
    { header: 'Итог за смену', key: 'total', width: 16 },
  ]
  salarySheet.getRow(1).eachCell((cell) => styleHeaderCell(cell))

  let hoursSum = 0
  let hoursPaySum = 0
  let salaryPremiumSum = 0
  let totalSum = 0

  const monthShifts = data.shifts
    .filter((shift) => shift.date.startsWith(monthPrefix))
    .sort((a, b) => a.date.localeCompare(b.date))

  for (const shift of monthShifts) {
    const dayShifts = shiftsByDate.get(shift.date) ?? [shift]
    const cashAmount = data.cash[shift.date]?.amount ?? 0
    const dayPremium = dailyCashPremium(cashAmount, data.settings)
    const hoursPay = shiftHoursPay(shift, data.settings)
    const premium = shiftPremium(shift, dayPremium, dayShifts, data.settings)
    const total = shiftTotal(shift, dayPremium, dayShifts, data.settings)

    hoursSum += shift.hours
    hoursPaySum += hoursPay
    salaryPremiumSum += premium
    totalSum += total

    const employee = EMPLOYEES.find((e) => e.id === shift.employeeId)
    const row = salarySheet.addRow([])
    row.getCell(1).value = new Date(
      Number(shift.date.slice(0, 4)),
      Number(shift.date.slice(5, 7)) - 1,
      Number(shift.date.slice(8, 10)),
    )
    row.getCell(1).numFmt = 'dd.mm.yyyy'
    row.getCell(2).value = employee?.name ?? ''
    row.getCell(3).value = shift.hours
    row.getCell(4).value = hoursPay
    row.getCell(4).numFmt = '#,##0.00'
    row.getCell(5).value = premium
    row.getCell(5).numFmt = '#,##0.00'
    row.getCell(6).value = total
    row.getCell(6).numFmt = '#,##0.00'
  }

  const salaryTotalRow = salarySheet.addRow([
    'Итого',
    '',
    hoursSum,
    hoursPaySum,
    salaryPremiumSum,
    totalSum,
  ])
  salaryTotalRow.font = { bold: true }
  salaryTotalRow.getCell(4).numFmt = '#,##0.00'
  salaryTotalRow.getCell(5).numFmt = '#,##0.00'
  salaryTotalRow.getCell(6).numFmt = '#,##0.00'

  // ---------- Сохранение файла ----------
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `shaverma-${year}-${pad2(month + 1)}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
