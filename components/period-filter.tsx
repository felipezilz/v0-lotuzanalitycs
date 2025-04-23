"use client"

import { useEffect, useState } from "react"
import { CalendarIcon, ChevronDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { DateRange } from "@/lib/date-utils"
import { getDateRangeForPeriod } from "@/lib/date-utils"

type PeriodFilterProps = {
  onDateRangeChange: (dateRange: DateRange | null) => void
}

export function PeriodFilter({ onDateRangeChange }: PeriodFilterProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("month")
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined
    to: Date | undefined
  }>({
    from: undefined,
    to: undefined,
  })

  // Update date range when period changes
  useEffect(() => {
    const dateRange = getDateRangeForPeriod(selectedPeriod, customDateRange)
    onDateRangeChange(dateRange)
  }, [selectedPeriod, customDateRange, onDateRangeChange])

  // Handle custom date range selection
  const handleCustomDateSelect = (range: { from?: Date; to?: Date }) => {
    if (range.from && range.to) {
      setCustomDateRange(range)
      setSelectedPeriod("custom")
    }
  }

  const periods = [
    { id: "today", label: "Hoje" },
    { id: "yesterday", label: "Ontem" },
    { id: "week", label: "Últimos 7 dias" },
    { id: "month", label: "Mês atual" },
    { id: "all", label: "Máximo" },
  ]

  // Função para obter o label do período selecionado
  const getSelectedPeriodLabel = () => {
    if (selectedPeriod === "custom") {
      return "Personalizado"
    }
    const period = periods.find((p) => p.id === selectedPeriod)
    return period ? period.label : "Selecionar período"
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1 whitespace-nowrap">
            <span className="hidden sm:inline">{getSelectedPeriodLabel()}</span>
            <span className="sm:hidden">Período</span>
            <ChevronDownIcon className="h-3.5 w-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[180px]">
          {periods.map((period) => (
            <DropdownMenuItem
              key={period.id}
              onClick={() => setSelectedPeriod(period.id)}
              className={selectedPeriod === period.id ? "bg-muted" : ""}
            >
              {period.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant={selectedPeriod === "custom" ? "default" : "outline"} size="sm" className="h-9 w-9 p-0">
            <CalendarIcon className="h-4 w-4" />
            <span className="sr-only">Calendário</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            defaultMonth={customDateRange.from}
            selected={customDateRange}
            onSelect={handleCustomDateSelect}
            numberOfMonths={window.innerWidth < 768 ? 1 : 2}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
