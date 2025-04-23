import {
  format,
  getDaysInMonth as getDateFnsDaysInMonth,
  isWithinInterval,
  parseISO,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  subDays,
} from "date-fns"
import { ptBR } from "date-fns/locale"

export type DateRange = {
  from: Date
  to: Date
}

// Get date range for period
export function getDateRangeForPeriod(period: string, customRange?: { from?: Date; to?: Date }): DateRange | null {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  switch (period) {
    case "today":
      return {
        from: startOfDay(today),
        to: endOfDay(today),
      }
    case "yesterday":
      const yesterday = subDays(today, 1)
      return {
        from: startOfDay(yesterday),
        to: endOfDay(yesterday),
      }
    case "week":
      return {
        from: startOfDay(subDays(today, 6)),
        to: endOfDay(today),
      }
    case "month":
      return {
        from: startOfMonth(today),
        to: endOfMonth(today),
      }
    case "all":
      return null
    case "custom":
      if (customRange?.from && customRange?.to) {
        return {
          from: startOfDay(customRange.from),
          to: endOfDay(customRange.to),
        }
      }
      return null
    default:
      return null
  }
}

// Check if a date string is within a date range
export function isDateInRange(dateStr: string, range: DateRange | null): boolean {
  if (!range) return true // If no range is specified, include all dates

  const date = parseISO(dateStr)
  return isWithinInterval(date, { start: range.from, end: range.to })
}

// Get the number of days in a month
export function getDaysInMonth(year: number, month: number): number {
  return getDateFnsDaysInMonth(new Date(year, month))
}

// Get all months between two dates
export function getMonthsInRange(startDate: Date, endDate: Date): Array<{ value: string; label: string }> {
  const months = []
  const currentDate = new Date(startDate)

  // Set to the first day of the month
  currentDate.setDate(1)

  // Loop through all months between start and end dates
  while (currentDate <= endDate) {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1 // JavaScript months are 0-indexed

    months.push({
      value: `${year}-${month}`,
      label: format(currentDate, "MMMM 'de' yyyy", { locale: ptBR }),
    })

    // Move to the next month
    currentDate.setMonth(currentDate.getMonth() + 1)
  }

  // Add current month if not already included
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentMonthKey = `${currentYear}-${currentMonth}`

  if (!months.some((m) => m.value === currentMonthKey)) {
    months.push({
      value: currentMonthKey,
      label: format(now, "MMMM 'de' yyyy", { locale: ptBR }),
    })
  }

  // Sort in reverse chronological order (newest first)
  return months.sort((a, b) => {
    const [yearA, monthA] = a.value.split("-").map(Number)
    const [yearB, monthB] = b.value.split("-").map(Number)

    if (yearA !== yearB) return yearB - yearA
    return monthB - monthA
  })
}
