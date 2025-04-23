"use client"

import { useState, useEffect, useMemo } from "react"
import { Line } from "react-chartjs-2"
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
  type ChartOptions,
} from "chart.js"
import { format, parseISO, isWithinInterval, subDays } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InfoIcon, TrendingUpIcon, TrendingDownIcon, ArrowRightIcon } from "lucide-react"
import type { Product } from "@/lib/data"
import type { DateRange } from "@/lib/date-utils"
import { formatCurrency } from "@/lib/utils"

// Registrar componentes do Chart.js
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

// Paleta de cores profissional para os produtos
const PRODUCT_COLORS = [
  "rgba(59, 130, 246, 0.9)", // Azul
  "rgba(16, 185, 129, 0.9)", // Verde
  "rgba(249, 115, 22, 0.9)", // Laranja
  "rgba(236, 72, 153, 0.9)", // Rosa
  "rgba(139, 92, 246, 0.9)", // Roxo
  "rgba(234, 179, 8, 0.9)", // Amarelo
  "rgba(14, 165, 233, 0.9)", // Azul claro
  "rgba(168, 85, 247, 0.9)", // Roxo claro
]

// Opções de métricas
const METRIC_OPTIONS = [
  { value: "lucro", label: "Lucro" },
  { value: "faturamento", label: "Faturamento" },
  { value: "investimento", label: "Investimento" },
  { value: "roi", label: "ROI (%)" },
]

// Opções de períodos para visualização rápida
const PERIOD_OPTIONS = [
  { value: "7", label: "7 dias" },
  { value: "15", label: "15 dias" },
  { value: "30", label: "30 dias" },
  { value: "all", label: "Todos" },
]

type PerformanceComparisonChartProps = {
  products: Product[]
  dateRange: DateRange | null
}

export function PerformanceComparisonChart({ products, dateRange }: PerformanceComparisonChartProps) {
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [selectedMetric, setSelectedMetric] = useState<string>("lucro")
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all")
  const [chartData, setChartData] = useState<ChartData<"line">>({
    labels: [],
    datasets: [],
  })
  const [activeTab, setActiveTab] = useState<string>("chart")
  const [insights, setInsights] = useState<{
    topPerformer: { id: string; name: string; value: number } | null
    trend: "up" | "down" | "stable"
    percentChange: number
  }>({
    topPerformer: null,
    trend: "stable",
    percentChange: 0,
  })

  // Filtrar produtos por período selecionado
  const filteredData = useMemo(() => {
    if (!products || products.length === 0) return []

    // Aplicar filtro de período rápido se não houver dateRange definido
    let effectiveDateRange = dateRange
    if (!dateRange && selectedPeriod !== "all") {
      const days = Number.parseInt(selectedPeriod)
      const today = new Date()
      effectiveDateRange = {
        from: subDays(today, days),
        to: today,
      }
    }

    // Filtrar e mapear os dados dos produtos selecionados
    return products
      .filter((product) => selectedProducts.includes(product.id))
      .map((product) => {
        // Filtrar dados pelo período selecionado
        const filteredEntries = effectiveDateRange
          ? product.dados.filter((entry) => {
              const entryDate = parseISO(entry.data)
              return isWithinInterval(entryDate, { start: effectiveDateRange!.from, end: effectiveDateRange!.to })
            })
          : product.dados

        // Ordenar por data
        const sortedEntries = [...filteredEntries].sort((a, b) => {
          return new Date(a.data).getTime() - new Date(b.data).getTime()
        })

        return {
          id: product.id,
          nome: product.nome,
          dailyData: sortedEntries.map((entry) => ({
            date: entry.data,
            value:
              selectedMetric === "roi"
                ? entry[selectedMetric as keyof typeof entry] || 0
                : entry[selectedMetric as keyof typeof entry] || 0,
          })),
        }
      })
  }, [products, selectedProducts, dateRange, selectedMetric, selectedPeriod])

  // Calcular insights baseados nos dados
  useEffect(() => {
    if (filteredData.length === 0) {
      setInsights({
        topPerformer: null,
        trend: "stable",
        percentChange: 0,
      })
      return
    }

    // Encontrar o produto com melhor desempenho
    let bestProduct = { id: "", name: "", value: 0 }

    filteredData.forEach((product) => {
      const totalValue = product.dailyData.reduce((sum, item) => sum + item.value, 0)
      if (totalValue > bestProduct.value) {
        bestProduct = {
          id: product.id,
          name: product.nome,
          value: totalValue,
        }
      }
    })

    // Calcular tendência (comparando primeira e segunda metade do período)
    let trend: "up" | "down" | "stable" = "stable"
    let percentChange = 0

    if (filteredData.length > 0 && filteredData[0].dailyData.length > 1) {
      const data = filteredData[0].dailyData
      const midPoint = Math.floor(data.length / 2)

      const firstHalfSum = data.slice(0, midPoint).reduce((sum, item) => sum + item.value, 0)
      const secondHalfSum = data.slice(midPoint).reduce((sum, item) => sum + item.value, 0)

      if (firstHalfSum > 0) {
        percentChange = ((secondHalfSum - firstHalfSum) / firstHalfSum) * 100
        trend = percentChange > 1 ? "up" : percentChange < -1 ? "down" : "stable"
      }
    }

    setInsights({
      topPerformer: bestProduct.id ? bestProduct : null,
      trend,
      percentChange: Math.abs(percentChange),
    })
  }, [filteredData])

  // Atualizar dados do gráfico quando os filtros mudarem
  useEffect(() => {
    if (filteredData.length === 0) {
      setChartData({
        labels: [],
        datasets: [],
      })
      return
    }

    // Obter todas as datas únicas dos dados filtrados
    const allDates = filteredData.flatMap((product) => product.dailyData.map((d) => d.date))
    const uniqueDates = [...new Set(allDates)].sort()

    // Formatar as datas para exibição (DD/MM)
    const formattedLabels = uniqueDates.map((date) => format(parseISO(date), "dd/MM", { locale: ptBR }))

    // Criar datasets para cada produto
    const datasets = filteredData.map((product, index) => {
      const color = PRODUCT_COLORS[index % PRODUCT_COLORS.length]

      return {
        label: product.nome,
        data: uniqueDates.map((date) => {
          const entry = product.dailyData.find((d) => d.date === date)
          return entry ? entry.value : 0
        }),
        borderColor: color,
        backgroundColor: color.replace("0.9)", "0.1)"),
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.3, // Suaviza as linhas
        fill: true,
      }
    })

    setChartData({
      labels: formattedLabels,
      datasets,
    })
  }, [filteredData])

  // Opções do gráfico - design profissional
  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top",
        labels: {
          usePointStyle: true,
          boxWidth: 6,
          padding: 15,
          font: {
            size: 11,
            family: "'Inter', sans-serif",
          },
        },
      },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          label: (context) => {
            let label = context.dataset.label || ""
            if (label) {
              label += ": "
            }
            if (context.parsed.y !== null) {
              label += selectedMetric === "roi" ? `${context.parsed.y.toFixed(2)}%` : formatCurrency(context.parsed.y)
            }
            return label
          },
        },
        backgroundColor: "rgba(17, 24, 39, 0.8)",
        titleColor: "rgba(255, 255, 255, 1)",
        bodyColor: "rgba(255, 255, 255, 0.9)",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        padding: 10,
        titleFont: {
          size: 13,
          weight: "bold",
          family: "'Inter', sans-serif",
        },
        bodyFont: {
          size: 12,
          family: "'Inter', sans-serif",
        },
        displayColors: true,
        boxPadding: 5,
        cornerRadius: 4,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
          drawBorder: false,
        },
        ticks: {
          color: "rgba(107, 114, 128, 0.9)",
          font: {
            size: 10,
            family: "'Inter', sans-serif",
          },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 10,
        },
        border: {
          display: false,
        },
      },
      y: {
        grid: {
          color: "rgba(229, 231, 235, 0.5)",
          drawBorder: false,
          lineWidth: 0.5,
        },
        ticks: {
          color: "rgba(107, 114, 128, 0.9)",
          font: {
            size: 10,
            family: "'Inter', sans-serif",
          },
          callback: (value) => (selectedMetric === "roi" ? `${value}%` : formatCurrency(value as number)),
          maxTicksLimit: 6,
          padding: 8,
        },
        border: {
          display: false,
        },
        beginAtZero: true,
      },
    },
    elements: {
      line: {
        tension: 0.4,
      },
      point: {
        radius: 2,
        hoverRadius: 4,
        borderWidth: 1,
      },
    },
    layout: {
      padding: {
        top: 10,
        right: 10,
        bottom: 10,
        left: 10,
      },
    },
    interaction: {
      mode: "nearest",
      axis: "x",
      intersect: false,
    },
  }

  // Selecionar automaticamente os primeiros 3 produtos quando a lista de produtos mudar
  useEffect(() => {
    if (products.length > 0 && selectedProducts.length === 0) {
      const initialSelection = products.slice(0, Math.min(3, products.length)).map((p) => p.id)
      setSelectedProducts(initialSelection)
    }
  }, [products, selectedProducts.length])

  // Verificar se há produtos para exibir
  const hasProducts = products.length > 0
  const hasSelectedProducts = selectedProducts.length > 0

  return (
    <Card className="w-full border-border bg-background shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-col space-y-1.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-medium">Comparativo de Performance</CardTitle>
              <div className="rounded-full bg-blue-50 p-1 dark:bg-blue-950">
                <InfoIcon className="h-3.5 w-3.5 text-blue-500" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="h-8 w-[100px] text-xs">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                <SelectTrigger className="h-8 w-[120px] text-xs">
                  <SelectValue placeholder="Métrica" />
                </SelectTrigger>
                <SelectContent>
                  {METRIC_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Compare o desempenho entre produtos ao longo do tempo
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {hasProducts ? (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex items-center justify-between">
                <TabsList className="mb-4 h-8 w-auto">
                  <TabsTrigger value="chart" className="h-7 text-xs">
                    Gráfico
                  </TabsTrigger>
                  <TabsTrigger value="insights" className="h-7 text-xs">
                    Insights
                  </TabsTrigger>
                </TabsList>

                {activeTab === "chart" && (
                  <div className="mb-4 flex flex-wrap gap-2 max-h-[120px] overflow-y-auto sm:max-h-none">
                    {products.map((product, index) => (
                      <div
                        key={product.id}
                        className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 transition-colors ${
                          selectedProducts.includes(product.id)
                            ? `bg-opacity-15 border border-${index % PRODUCT_COLORS.length}`
                            : "bg-muted/30 border border-transparent"
                        }`}
                        style={{
                          backgroundColor: selectedProducts.includes(product.id)
                            ? PRODUCT_COLORS[index % PRODUCT_COLORS.length].replace("0.9", "0.08")
                            : "",
                          borderColor: selectedProducts.includes(product.id)
                            ? PRODUCT_COLORS[index % PRODUCT_COLORS.length].replace("0.9", "0.3")
                            : "",
                        }}
                      >
                        <Checkbox
                          id={`product-${product.id}`}
                          checked={selectedProducts.includes(product.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedProducts([...selectedProducts, product.id])
                            } else {
                              setSelectedProducts(selectedProducts.filter((id) => id !== product.id))
                            }
                          }}
                          className="h-3 w-3 rounded-sm border-muted-foreground/50"
                        />
                        <Label
                          htmlFor={`product-${product.id}`}
                          className="cursor-pointer text-xs font-medium"
                          style={{
                            color: selectedProducts.includes(product.id)
                              ? PRODUCT_COLORS[index % PRODUCT_COLORS.length]
                                  .replace("rgba", "rgb")
                                  .replace(", 0.9)", ")")
                              : "",
                          }}
                        >
                          {product.nome}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <TabsContent value="chart" className="mt-0">
                {hasSelectedProducts ? (
                  <div className="h-[350px] w-full">
                    <Line data={chartData} options={chartOptions} />
                  </div>
                ) : (
                  <div className="flex h-[350px] w-full items-center justify-center rounded-md border border-dashed border-muted-foreground/20 bg-muted/5 text-muted-foreground">
                    Selecione pelo menos um produto para visualizar o gráfico
                  </div>
                )}
              </TabsContent>

              <TabsContent value="insights" className="mt-0">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col justify-between rounded-lg border bg-card p-5 shadow-sm h-auto md:h-[160px]">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Melhor Desempenho</h3>
                      {insights.topPerformer ? (
                        <div className="mt-2">
                          <p className="text-xl font-bold">{insights.topPerformer.name}</p>
                          <p className="mt-1 text-sm">
                            {selectedMetric === "roi"
                              ? `${insights.topPerformer.value.toFixed(2)}%`
                              : formatCurrency(insights.topPerformer.value)}
                            <span className="ml-1 text-xs text-muted-foreground">total no período</span>
                          </p>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Selecione produtos para ver o melhor desempenho
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-4 md:mt-0">
                      <InfoIcon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>
                        Baseado no total acumulado de{" "}
                        {METRIC_OPTIONS.find((m) => m.value === selectedMetric)?.label.toLowerCase()}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-lg border bg-card p-5 shadow-sm h-auto md:h-[160px]">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Tendência</h3>
                      {insights.trend !== "stable" ? (
                        <div className="mt-2">
                          <div className="flex items-center gap-2">
                            <p className="text-xl font-bold">{insights.percentChange.toFixed(1)}%</p>
                            {insights.trend === "up" ? (
                              <TrendingUpIcon className="h-5 w-5 text-green-500" />
                            ) : (
                              <TrendingDownIcon className="h-5 w-5 text-red-500" />
                            )}
                          </div>
                          <p className="mt-1 text-sm">
                            {insights.trend === "up" ? "Crescimento" : "Queda"}
                            <span className="ml-1 text-xs text-muted-foreground">
                              comparando primeira e segunda metade do período
                            </span>
                          </p>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">Tendência estável ou dados insuficientes</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-4 md:mt-0">
                      <InfoIcon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>
                        Baseado na variação de{" "}
                        {METRIC_OPTIONS.find((m) => m.value === selectedMetric)?.label.toLowerCase()} ao longo do tempo
                      </span>
                    </div>
                  </div>

                  <div className="md:col-span-2 rounded-lg border bg-card p-5 shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Recomendações</h3>
                    <ul className="mt-3 space-y-2">
                      <li className="flex items-start gap-2 text-sm">
                        <ArrowRightIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                        <span>
                          {insights.topPerformer
                            ? `Analise as estratégias utilizadas em "${insights.topPerformer.name}" e aplique em outros produtos.`
                            : "Selecione produtos para receber recomendações personalizadas."}
                        </span>
                      </li>
                      {insights.trend === "down" && (
                        <li className="flex items-start gap-2 text-sm">
                          <ArrowRightIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                          <span>Revise sua estratégia atual, pois há uma tendência de queda no desempenho.</span>
                        </li>
                      )}
                      {selectedProducts.length > 1 && (
                        <li className="flex items-start gap-2 text-sm">
                          <ArrowRightIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                          <span>
                            Compare os produtos com desempenho inferior e identifique oportunidades de melhoria.
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="flex h-[350px] w-full items-center justify-center rounded-md border border-dashed border-muted-foreground/20 bg-muted/5 text-muted-foreground">
            Nenhum produto disponível para comparação
          </div>
        )}
      </CardContent>
    </Card>
  )
}
