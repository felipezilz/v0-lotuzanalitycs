"use client"

import React from "react"

import { useEffect, useState, useCallback, useMemo } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  type ChartData,
} from "chart.js"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/utils"
import type { DailyData, Product } from "@/lib/data"
import { getDaysInMonth } from "@/lib/date-utils"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

type ProductDataTableProps = {
  product: Product
  monthKey: string
  onDataUpdate: (date: string, data: DailyData) => Promise<boolean>
  showChart: boolean
}

export function ProductDataTable({ product, monthKey, onDataUpdate, showChart }: ProductDataTableProps) {
  const { toast } = useToast()
  const [tableData, setTableData] = useState<Array<{ date: string; data: DailyData }>>([])
  const [chartData, setChartData] = useState<ChartData<"line">>({
    labels: [],
    datasets: [],
  })
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({})
  const [saveSuccess, setSaveSuccess] = useState<Record<string, boolean>>({})
  const [isGeneratingDays, setIsGeneratingDays] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const [activeMetricTab, setActiveMetricTab] = useState("performance")
  const [activeViewTab, setActiveViewTab] = useState("table")
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // Parse the month key to get year and month
  const [year, month] = useMemo(() => {
    const parts = monthKey.split("-").map(Number)
    return [parts[0] || new Date().getFullYear(), parts[1] || new Date().getMonth() + 1]
  }, [monthKey])

  // Função para gerar os dias do mês
  const generateDaysData = useCallback(() => {
    if (!year || !month) return []

    const days = getDaysInMonth(year, month - 1) // month is 0-indexed in Date
    const daysData: Array<{ date: string; data: DailyData }> = []

    // For each day in the month
    for (let day = 1; day <= days; day++) {
      const dateStr = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`

      // Check if we have existing data for this day
      const existingData = product.dados.find((d) => d.data === dateStr)

      if (existingData) {
        // Garantir que todos os campos existam, mesmo que sejam 0
        const completeData = {
          data: dateStr,
          investimento: existingData.investimento || 0,
          faturamento: existingData.faturamento || 0,
          lucro: existingData.lucro || 0,
          roi: existingData.roi || 0,
          visitas: existingData.visitas || 0,
          cpa: existingData.cpa || 0,
          // Garantir que os novos campos existam
          cliques: existingData.cliques || 0,
          impressoes: existingData.impressoes || 0,
          vendas: existingData.vendas || 0,
          ctr: existingData.ctr || 0,
          cpc: existingData.cpc || 0,
          cpm: existingData.cpm || 0,
          initiateCheckout: existingData.initiateCheckout || 0,
        }
        daysData.push({ date: dateStr, data: completeData })
      } else {
        // Create empty data for this day
        daysData.push({
          date: dateStr,
          data: {
            data: dateStr,
            investimento: 0,
            faturamento: 0,
            lucro: 0,
            roi: 0,
            visitas: 0,
            cpa: 0,
            cliques: 0,
            impressoes: 0,
            vendas: 0,
            ctr: 0,
            cpc: 0,
            cpm: 0,
            initiateCheckout: 0,
          },
        })
      }
    }

    return daysData
  }, [year, month, product.dados])

  // Generate days for the selected month
  useEffect(() => {
    setIsGeneratingDays(true)

    try {
      const daysData = generateDaysData()
      setTableData(daysData)
    } catch (error) {
      console.error("Erro ao gerar dias:", error)
    } finally {
      setIsGeneratingDays(false)
    }
  }, [generateDaysData])

  // Update chart data when table data changes
  useEffect(() => {
    if (tableData.length === 0) return

    const labels = tableData.map((item) => format(parseISO(item.date), "dd"))

    // Dados para o gráfico de performance
    const roiData = tableData.map((item) => item.data.roi)
    const cpaData = tableData.map((item) => item.data.cpa)

    // Dados para o gráfico de anúncios
    const ctrData = tableData.map((item) => item.data.ctr)
    const cpcData = tableData.map((item) => item.data.cpc)
    const cpmData = tableData.map((item) => item.data.cpm)

    // Dados para o gráfico de volume
    const cliquesData = tableData.map((item) => item.data.cliques)
    const impressoesData = tableData.map((item) => item.data.impressoes)
    const vendasData = tableData.map((item) => item.data.vendas)

    // Configurar datasets baseado na aba ativa
    let datasets = []

    if (activeMetricTab === "performance") {
      datasets = [
        {
          label: "ROI (%)",
          data: roiData,
          borderColor: "rgb(53, 162, 235)",
          backgroundColor: "rgba(53, 162, 235, 0.5)",
          tension: 0.3,
          yAxisID: "y",
        },
        {
          label: "CPA (R$)",
          data: cpaData,
          borderColor: "rgb(255, 99, 132)",
          backgroundColor: "rgba(255, 99, 132, 0.5)",
          tension: 0.3,
          yAxisID: "y1",
        },
      ]
    } else if (activeMetricTab === "ads") {
      datasets = [
        {
          label: "CTR (%)",
          data: ctrData,
          borderColor: "rgb(75, 192, 192)",
          backgroundColor: "rgba(75, 192, 192, 0.5)",
          tension: 0.3,
          yAxisID: "y",
        },
        {
          label: "CPC (R$)",
          data: cpcData,
          borderColor: "rgb(255, 159, 64)",
          backgroundColor: "rgba(255, 159, 64, 0.5)",
          tension: 0.3,
          yAxisID: "y1",
        },
        {
          label: "CPM (R$)",
          data: cpmData,
          borderColor: "rgb(153, 102, 255)",
          backgroundColor: "rgba(153, 102, 255, 0.5)",
          tension: 0.3,
          yAxisID: "y1",
        },
      ]
    } else if (activeMetricTab === "volume") {
      datasets = [
        {
          label: "Cliques",
          data: cliquesData,
          borderColor: "rgb(54, 162, 235)",
          backgroundColor: "rgba(54, 162, 235, 0.5)",
          tension: 0.3,
          yAxisID: "y",
        },
        {
          label: "Impressões",
          data: impressoesData,
          borderColor: "rgb(75, 192, 192)",
          backgroundColor: "rgba(75, 192, 192, 0.5)",
          tension: 0.3,
          yAxisID: "y",
        },
        {
          label: "Vendas",
          data: vendasData,
          borderColor: "rgb(255, 99, 132)",
          backgroundColor: "rgba(255, 99, 132, 0.5)",
          tension: 0.3,
          yAxisID: "y1",
        },
      ]
    }

    setChartData({
      labels,
      datasets,
    })
  }, [tableData, activeMetricTab])

  // Atualize a função calculateDerivedValues para incluir o campo initiateCheckout

  // Função para calcular valores derivados
  const calculateDerivedValues = useCallback((data: DailyData): DailyData => {
    const investimento = data.investimento || 0
    const faturamento = data.faturamento || 0
    const visitas = data.visitas || 0
    const cliques = data.cliques || 0
    const impressoes = data.impressoes || 0
    const vendas = data.vendas || 0
    const initiateCheckout = data.initiateCheckout || 0

    const lucro = faturamento - investimento
    const roi = investimento > 0 ? (lucro / investimento) * 100 : 0
    const cpa = visitas > 0 ? investimento / visitas : 0
    const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0
    const cpc = cliques > 0 ? investimento / cliques : 0
    const cpm = impressoes > 0 ? (investimento / impressoes) * 1000 : 0

    return {
      ...data,
      lucro,
      roi,
      cpa,
      ctr,
      cpc,
      cpm,
      initiateCheckout,
    }
  }, [])

  // Função para lidar com mudanças nos campos de entrada
  const handleCellChange = useCallback(
    (index: number, field: string, value: string) => {
      // Atualizar apenas o valor no estado local sem salvar
      const updatedData = [...tableData]
      const currentItem = { ...updatedData[index] }
      const currentData = { ...currentItem.data }

      // Converter para número, permitindo valores decimais
      const numValue =
        field === "visitas" ||
        field === "cliques" ||
        field === "impressoes" ||
        field === "vendas" ||
        field === "initiateCheckout"
          ? value === ""
            ? 0
            : Math.round(Number(value) || 0)
          : value === ""
            ? 0
            : Number.parseFloat(value) || 0

      // Update the specific field
      currentData[field as keyof DailyData] = numValue

      // Recalculate derived values
      const updatedDataWithCalculations = calculateDerivedValues(currentData)

      // Update the item in the array
      currentItem.data = updatedDataWithCalculations
      updatedData[index] = currentItem

      // Update state
      setTableData(updatedData)
    },
    [tableData, calculateDerivedValues],
  )

  // Função para salvar os dados quando o campo perder o foco ou o usuário pressionar Enter
  const saveData = useCallback(
    async (index: number) => {
      const item = tableData[index]
      const date = item.date
      const data = item.data

      // Marca como salvando
      setIsSaving((prev) => ({ ...prev, [date]: true }))
      setSaveSuccess((prev) => {
        const newState = { ...prev }
        delete newState[date]
        return newState
      })

      try {
        // Notificar o componente pai sobre a atualização
        const success = await onDataUpdate(date, data)

        if (success) {
          // Atualizar o estado para mostrar sucesso
          setSaveSuccess((prev) => ({ ...prev, [date]: true }))

          // Limpar o status de sucesso após 1 segundo
          setTimeout(() => {
            setSaveSuccess((prev) => {
              const newState = { ...prev }
              delete newState[date]
              return newState
            })
          }, 1000)
        } else {
          console.error("Falha ao salvar dados para", date)
          toast({
            title: "Erro ao salvar",
            description: "Não foi possível salvar os dados. Tente novamente.",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Erro ao atualizar dados:", error)
        toast({
          title: "Erro ao salvar",
          description: "Ocorreu um erro ao salvar os dados. Tente novamente.",
          variant: "destructive",
        })
      } finally {
        // Remove saving state for this date
        setIsSaving((prev) => {
          const newState = { ...prev }
          delete newState[date]
          return newState
        })
      }
    },
    [tableData, onDataUpdate, toast],
  )

  // Manipulador para quando o campo perder o foco
  const handleBlur = useCallback(
    (index: number) => {
      saveData(index)
    },
    [saveData],
  )

  // Manipulador para quando o usuário pressionar Enter
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
      if (e.key === "Enter") {
        e.preventDefault()
        saveData(index)
      }
    },
    [saveData],
  )

  // Função para alternar a expansão de uma linha
  const toggleRowExpansion = useCallback((date: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [date]: !prev[date],
    }))
  }, [])

  // Função para selecionar um dia para visualização detalhada
  const selectDay = useCallback(
    (date: string) => {
      // Se já estiver selecionado, limpa a seleção
      if (date === selectedDay) {
        setSelectedDay(null)
      } else {
        // Caso contrário, seleciona o novo dia
        setSelectedDay(date)
      }
    },
    [selectedDay],
  )

  // Renderiza o esqueleto durante o carregamento
  if (isGeneratingDays) {
    return (
      <div className="space-y-6">
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Dia</TableHead>
                <TableHead>Investimento</TableHead>
                <TableHead>Faturamento</TableHead>
                <TableHead className="hidden sm:table-cell">Lucro</TableHead>
                <TableHead className="hidden sm:table-cell">ROI</TableHead>
                <TableHead>Visitas</TableHead>
                <TableHead className="hidden sm:table-cell">CPA</TableHead>
                <TableHead className="w-[50px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 10 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Skeleton className="h-8 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  // Se não houver dados, exibe uma mensagem
  if (tableData.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-lg font-medium">Nenhum dado disponível para este mês</p>
          <p className="text-sm text-muted-foreground mt-2">
            Selecione outro mês ou verifique se o produto tem dados registrados.
          </p>
        </div>
      </div>
    )
  }

  // Encontrar o item selecionado
  const selectedItem = selectedDay ? tableData.find((item) => item.date === selectedDay) : null

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {selectedDay ? (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">
                  Detalhes do dia {format(parseISO(selectedDay), "dd/MM/yyyy", { locale: ptBR })}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setSelectedDay(null)
                  }}
                >
                  Voltar à tabela
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {selectedItem && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Investimento</p>
                    <Input
                      type="number"
                      value={selectedItem.data.investimento || ""}
                      onChange={(e) => {
                        const index = tableData.findIndex((item) => item.date === selectedDay)
                        if (index !== -1) {
                          handleCellChange(index, "investimento", e.target.value)
                        }
                      }}
                      onBlur={() => {
                        const index = tableData.findIndex((item) => item.date === selectedDay)
                        if (index !== -1) {
                          handleBlur(index)
                        }
                      }}
                      className="h-8"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Faturamento</p>
                    <Input
                      type="number"
                      value={selectedItem.data.faturamento || ""}
                      onChange={(e) => {
                        const index = tableData.findIndex((item) => item.date === selectedDay)
                        if (index !== -1) {
                          handleCellChange(index, "faturamento", e.target.value)
                        }
                      }}
                      onBlur={() => {
                        const index = tableData.findIndex((item) => item.date === selectedDay)
                        if (index !== -1) {
                          handleBlur(index)
                        }
                      }}
                      className="h-8"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Lucro</p>
                    <p
                      className={`text-sm font-medium ${selectedItem.data.lucro >= 0 ? "text-success" : "text-destructive"}`}
                    >
                      {formatCurrency(selectedItem.data.lucro)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">ROI</p>
                    <p
                      className={`text-sm font-medium ${selectedItem.data.roi >= 100 ? "text-success" : "text-muted-foreground"}`}
                    >
                      {selectedItem.data.roi.toFixed(2)}%
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Cliques</p>
                    <Input
                      type="number"
                      value={selectedItem.data.cliques || ""}
                      onChange={(e) => {
                        const index = tableData.findIndex((item) => item.date === selectedDay)
                        if (index !== -1) {
                          handleCellChange(index, "cliques", e.target.value)
                        }
                      }}
                      onBlur={() => {
                        const index = tableData.findIndex((item) => item.date === selectedDay)
                        if (index !== -1) {
                          handleBlur(index)
                        }
                      }}
                      className="h-8"
                      min="0"
                      step="1"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Impressões</p>
                    <Input
                      type="number"
                      value={selectedItem.data.impressoes || ""}
                      onChange={(e) => {
                        const index = tableData.findIndex((item) => item.date === selectedDay)
                        if (index !== -1) {
                          handleCellChange(index, "impressoes", e.target.value)
                        }
                      }}
                      onBlur={() => {
                        const index = tableData.findIndex((item) => item.date === selectedDay)
                        if (index !== -1) {
                          handleBlur(index)
                        }
                      }}
                      className="h-8"
                      min="0"
                      step="1"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">CTR</p>
                    <p className="text-sm font-medium">{selectedItem.data.ctr.toFixed(2)}%</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">CPC</p>
                    <p className="text-sm font-medium">{formatCurrency(selectedItem.data.cpc)}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Vendas</p>
                    <Input
                      type="number"
                      value={selectedItem.data.vendas || ""}
                      onChange={(e) => {
                        const index = tableData.findIndex((item) => item.date === selectedDay)
                        if (index !== -1) {
                          handleCellChange(index, "vendas", e.target.value)
                        }
                      }}
                      onBlur={() => {
                        const index = tableData.findIndex((item) => item.date === selectedDay)
                        if (index !== -1) {
                          handleBlur(index)
                        }
                      }}
                      className="h-8"
                      min="0"
                      step="1"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Visitas</p>
                    <Input
                      type="number"
                      value={selectedItem.data.visitas || ""}
                      onChange={(e) => {
                        const index = tableData.findIndex((item) => item.date === selectedDay)
                        if (index !== -1) {
                          handleCellChange(index, "visitas", e.target.value)
                        }
                      }}
                      onBlur={() => {
                        const index = tableData.findIndex((item) => item.date === selectedDay)
                        if (index !== -1) {
                          handleBlur(index)
                        }
                      }}
                      className="h-8"
                      min="0"
                      step="1"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Iniciate Checkout</p>
                    <Input
                      type="number"
                      value={selectedItem.data.initiateCheckout || ""}
                      onChange={(e) => {
                        const index = tableData.findIndex((item) => item.date === selectedDay)
                        if (index !== -1) {
                          handleCellChange(index, "initiateCheckout", e.target.value)
                        }
                      }}
                      onBlur={() => {
                        const index = tableData.findIndex((item) => item.date === selectedDay)
                        if (index !== -1) {
                          handleBlur(index)
                        }
                      }}
                      className="h-8"
                      min="0"
                      step="1"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">CPM</p>
                    <p className="text-sm font-medium">{formatCurrency(selectedItem.data.cpm)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Dia</TableHead>
                  <TableHead>Investimento</TableHead>
                  <TableHead>Faturamento</TableHead>
                  <TableHead className="hidden sm:table-cell">Lucro</TableHead>
                  <TableHead className="hidden sm:table-cell">ROI</TableHead>
                  <TableHead className="hidden sm:table-cell">Cliques</TableHead>
                  <TableHead className="hidden sm:table-cell">CTR</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.map((row, index) => (
                  <React.Fragment key={row.date}>
                    <TableRow
                      className={`cursor-pointer hover:bg-muted/50 ${isSaving[row.date] ? "bg-muted/50" : ""}`}
                      onClick={() => selectDay(row.date)}
                    >
                      <TableCell className="font-medium">
                        {format(parseISO(row.date), "dd/MM", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.data.investimento || ""}
                          onChange={(e) => handleCellChange(index, "investimento", e.target.value)}
                          onBlur={() => handleBlur(index)}
                          onKeyDown={(e) => handleKeyDown(e, index)}
                          className="h-8 w-full"
                          min="0"
                          step="0.01"
                          disabled={isSaving[row.date]}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.data.faturamento || ""}
                          onChange={(e) => handleCellChange(index, "faturamento", e.target.value)}
                          onBlur={() => handleBlur(index)}
                          onKeyDown={(e) => handleKeyDown(e, index)}
                          className="h-8 w-full"
                          min="0"
                          step="0.01"
                          disabled={isSaving[row.date]}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{formatCurrency(row.data.lucro)}</TableCell>
                      <TableCell className="hidden sm:table-cell">{row.data.roi.toFixed(2)}%</TableCell>
                      <TableCell className="hidden sm:table-cell">{(row.data.cliques || 0).toLocaleString()}</TableCell>
                      <TableCell className="hidden sm:table-cell">{(row.data.ctr || 0).toFixed(2)}%</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {isSaving[row.date] ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : saveSuccess[row.date] ? (
                            <CheckCircle className="h-4 w-4 text-success" />
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleRowExpansion(row.date)
                              }}
                            >
                              {expandedRows[row.date] ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedRows[row.date] && (
                      <TableRow onClick={(e) => e.stopPropagation()}>
                        <TableCell colSpan={8} className="p-0">
                          <div className="bg-muted/30 p-3">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Cliques</p>
                                <Input
                                  type="number"
                                  value={row.data.cliques || ""}
                                  onChange={(e) => handleCellChange(index, "cliques", e.target.value)}
                                  onBlur={() => handleBlur(index)}
                                  onKeyDown={(e) => handleKeyDown(e, index)}
                                  className="h-7 text-xs"
                                  min="0"
                                  step="1"
                                  disabled={isSaving[row.date]}
                                />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Impressões</p>
                                <Input
                                  type="number"
                                  value={row.data.impressoes || ""}
                                  onChange={(e) => handleCellChange(index, "impressoes", e.target.value)}
                                  onBlur={() => handleBlur(index)}
                                  onKeyDown={(e) => handleKeyDown(e, index)}
                                  className="h-7 text-xs"
                                  min="0"
                                  step="1"
                                  disabled={isSaving[row.date]}
                                />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Vendas</p>
                                <Input
                                  type="number"
                                  value={row.data.vendas || ""}
                                  onChange={(e) => handleCellChange(index, "vendas", e.target.value)}
                                  onBlur={() => handleBlur(index)}
                                  onKeyDown={(e) => handleKeyDown(e, index)}
                                  className="h-7 text-xs"
                                  min="0"
                                  step="1"
                                  disabled={isSaving[row.date]}
                                />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Visitas</p>
                                <Input
                                  type="number"
                                  value={row.data.visitas || ""}
                                  onChange={(e) => handleCellChange(index, "visitas", e.target.value)}
                                  onBlur={() => handleBlur(index)}
                                  onKeyDown={(e) => handleKeyDown(e, index)}
                                  className="h-7 text-xs"
                                  min="0"
                                  step="1"
                                  disabled={isSaving[row.date]}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mt-3">
                              <div>
                                <p className="text-xs text-muted-foreground">CPC</p>
                                <p className="text-xs font-medium">{formatCurrency(row.data.cpc || 0)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">CPM</p>
                                <p className="text-xs font-medium">{formatCurrency(row.data.cpm || 0)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">CPA</p>
                                <p className="text-xs font-medium">{formatCurrency(row.data.cpa || 0)}</p>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Versão mobile para exibir os valores calculados */}
        <div className="sm:hidden mt-4">
          <h3 className="text-sm font-medium mb-2">Resumo dos dias</h3>
          <div className="space-y-2">
            {tableData.map((row, index) => (
              <Card
                key={`mobile-${row.date}`}
                className={`${row.data.lucro > 0 ? "border-l-4 border-l-success" : row.data.lucro < 0 ? "border-l-4 border-l-destructive" : ""}`}
                onClick={() => selectDay(row.date)}
              >
                <CardContent className="p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{format(parseISO(row.date), "dd/MM", { locale: ptBR })}</span>
                      {(row.data.vendas || 0) > 0 && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          {row.data.vendas} {row.data.vendas === 1 ? "venda" : "vendas"}
                        </Badge>
                      )}
                    </div>
                    {isSaving[row.date] ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : saveSuccess[row.date] ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : null}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Invest.</p>
                      <p className="text-xs">{formatCurrency(row.data.investimento)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fatur.</p>
                      <p className="text-xs">{formatCurrency(row.data.faturamento)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Lucro</p>
                      <p className={`text-xs ${row.data.lucro >= 0 ? "text-success" : "text-destructive"}`}>
                        {formatCurrency(row.data.lucro)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm mt-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Cliques</p>
                      <p className="text-xs">{(row.data.cliques || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CTR</p>
                      <p className="text-xs">{(row.data.ctr || 0).toFixed(2)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">ROI</p>
                      <p className={`text-xs ${row.data.roi >= 100 ? "text-success" : "text-muted-foreground"}`}>
                        {row.data.roi.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
