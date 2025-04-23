"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { BarChart, LineChart, PieChart } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { formatCurrency } from "@/lib/utils"

// Tipos para os dados
type ProductSummary = {
  id: string
  name: string
  totalInvestment: number
  totalRevenue: number
  totalProfit: number
  averageRoi: number
  dataPoints: number
}

type MonthlyData = {
  month: string
  investment: number
  revenue: number
  profit: number
  roi: number
}

export function AnalyticsDashboard() {
  const [isLoading, setIsLoading] = useState(true)
  const [productSummaries, setProductSummaries] = useState<ProductSummary[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [selectedProduct, setSelectedProduct] = useState<string>("all")
  const [activeTab, setActiveTab] = useState("overview")
  const [timeframe, setTimeframe] = useState("last6months")
  const { toast } = useToast()

  // Carregar dados de resumo dos produtos
  useEffect(() => {
    async function loadProductSummaries() {
      try {
        setIsLoading(true)

        // Buscar todos os produtos do usuário
        const { data: products, error: productsError } = await supabase.from("products").select("id, name")

        if (productsError) throw productsError

        if (!products || products.length === 0) {
          setProductSummaries([])
          setIsLoading(false)
          return
        }

        // Para cada produto, calcular métricas agregadas
        const summaries = await Promise.all(
          products.map(async (product) => {
            const { data, error } = await supabase
              .from("product_data")
              .select("investment, revenue, profit, roi")
              .eq("product_id", product.id)

            if (error) throw error

            // Calcular totais
            const summary: ProductSummary = {
              id: product.id,
              name: product.name,
              totalInvestment: data.reduce((sum, item) => sum + (item.investment || 0), 0),
              totalRevenue: data.reduce((sum, item) => sum + (item.revenue || 0), 0),
              totalProfit: data.reduce((sum, item) => sum + (item.profit || 0), 0),
              averageRoi: data.length > 0 ? data.reduce((sum, item) => sum + (item.roi || 0), 0) / data.length : 0,
              dataPoints: data.length,
            }

            return summary
          }),
        )

        setProductSummaries(summaries)
      } catch (error) {
        console.error("Erro ao carregar resumos dos produtos:", error)
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados dos produtos",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadProductSummaries()
  }, [toast])

  // Carregar dados mensais com base no produto e timeframe selecionados
  useEffect(() => {
    async function loadMonthlyData() {
      try {
        setIsLoading(true)

        // Determinar o período de tempo
        const now = new Date()
        const startDate = new Date()

        switch (timeframe) {
          case "last3months":
            startDate.setMonth(now.getMonth() - 3)
            break
          case "last6months":
            startDate.setMonth(now.getMonth() - 6)
            break
          case "lastyear":
            startDate.setFullYear(now.getFullYear() - 1)
            break
          default:
            startDate.setMonth(now.getMonth() - 6)
        }

        // Construir a consulta base
        let query = supabase
          .from("product_data")
          .select("product_id, date, investment, revenue, profit, roi")
          .gte("date", startDate.toISOString().split("T")[0])
          .order("date", { ascending: true })

        // Filtrar por produto específico se não for "all"
        if (selectedProduct !== "all") {
          query = query.eq("product_id", selectedProduct)
        }

        const { data, error } = await query

        if (error) throw error

        // Agrupar dados por mês
        const monthlyDataMap = new Map<string, MonthlyData>()

        data.forEach((item) => {
          const date = new Date(item.date)
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

          if (!monthlyDataMap.has(monthKey)) {
            monthlyDataMap.set(monthKey, {
              month: monthKey,
              investment: 0,
              revenue: 0,
              profit: 0,
              roi: 0,
            })
          }

          const monthData = monthlyDataMap.get(monthKey)!
          monthData.investment += item.investment || 0
          monthData.revenue += item.revenue || 0
          monthData.profit += item.profit || 0

          // Acumular ROI para calcular média depois
          monthData.roi += item.roi || 0
        })

        // Calcular média de ROI para cada mês
        monthlyDataMap.forEach((monthData) => {
          const dataCount = data.filter((item) => {
            const date = new Date(item.date)
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
            return monthKey === monthData.month
          }).length

          monthData.roi = dataCount > 0 ? monthData.roi / dataCount : 0
        })

        // Converter o Map para array e ordenar por mês
        const monthlyDataArray = Array.from(monthlyDataMap.values()).sort((a, b) => a.month.localeCompare(b.month))

        setMonthlyData(monthlyDataArray)
      } catch (error) {
        console.error("Erro ao carregar dados mensais:", error)
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados mensais",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadMonthlyData()
  }, [selectedProduct, timeframe, toast])

  // Calcular métricas gerais
  const totalInvestment = productSummaries.reduce((sum, product) => sum + product.totalInvestment, 0)
  const totalRevenue = productSummaries.reduce((sum, product) => sum + product.totalRevenue, 0)
  const totalProfit = productSummaries.reduce((sum, product) => sum + product.totalProfit, 0)
  const overallRoi = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0

  // Renderizar o componente
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h2>

        <div className="flex items-center gap-2">
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecionar produto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os produtos</SelectItem>
              {productSummaries.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last3months">Últimos 3 meses</SelectItem>
              <SelectItem value="last6months">Últimos 6 meses</SelectItem>
              <SelectItem value="lastyear">Último ano</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Investimento Total</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-[120px]" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(totalInvestment)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento Total</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-[120px]" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro Total</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-[120px]" />
            ) : (
              <div
                className={`text-2xl font-bold ${totalProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
              >
                {formatCurrency(totalProfit)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ROI Geral</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-[120px]" />
            ) : (
              <div
                className={`text-2xl font-bold ${overallRoi >= 100 ? "text-green-600 dark:text-green-400" : overallRoi >= 0 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}
              >
                {overallRoi.toFixed(2)}%
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs para diferentes visualizações */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 md:w-auto">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart className="h-4 w-4" />
            <span>Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="trends" className="flex items-center gap-2">
            <LineChart className="h-4 w-4" />
            <span>Tendências</span>
          </TabsTrigger>
          <TabsTrigger value="distribution" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            <span>Distribuição</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Desempenho por Produto</CardTitle>
              <CardDescription>Comparação de métricas entre produtos no período selecionado</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : productSummaries.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-center">
                  <p className="text-muted-foreground">Nenhum dado disponível para o período selecionado</p>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="pb-2 text-left font-medium">Produto</th>
                          <th className="pb-2 text-right font-medium">Investimento</th>
                          <th className="pb-2 text-right font-medium">Faturamento</th>
                          <th className="pb-2 text-right font-medium">Lucro</th>
                          <th className="pb-2 text-right font-medium">ROI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productSummaries.map((product) => (
                          <tr key={product.id} className="border-b last:border-0">
                            <td className="py-3">{product.name}</td>
                            <td className="py-3 text-right">{formatCurrency(product.totalInvestment)}</td>
                            <td className="py-3 text-right">{formatCurrency(product.totalRevenue)}</td>
                            <td
                              className={`py-3 text-right ${product.totalProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                            >
                              {formatCurrency(product.totalProfit)}
                            </td>
                            <td
                              className={`py-3 text-right ${product.averageRoi >= 100 ? "text-green-600 dark:text-green-400" : product.averageRoi >= 0 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}
                            >
                              {product.averageRoi.toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded-lg border p-4">
                    <h4 className="mb-4 text-sm font-medium">Insights</h4>
                    <ul className="space-y-2 text-sm">
                      {productSummaries.length > 0 && (
                        <>
                          {productSummaries.some((p) => p.totalProfit < 0) && (
                            <li className="flex items-start gap-2">
                              <span className="text-red-500">•</span>
                              <span>
                                Alguns produtos estão operando com prejuízo. Considere revisar a estratégia de
                                investimento.
                              </span>
                            </li>
                          )}

                          {productSummaries.some((p) => p.averageRoi > 200) && (
                            <li className="flex items-start gap-2">
                              <span className="text-green-500">•</span>
                              <span>
                                Produtos com ROI acima de 200% estão performando excepcionalmente bem. Considere
                                aumentar o investimento.
                              </span>
                            </li>
                          )}

                          {productSummaries.some((p) => p.dataPoints < 5) && (
                            <li className="flex items-start gap-2">
                              <span className="text-yellow-500">•</span>
                              <span>
                                Alguns produtos têm poucos pontos de dados. Considere adicionar mais dados para análises
                                mais precisas.
                              </span>
                            </li>
                          )}
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tendências Mensais</CardTitle>
              <CardDescription>Evolução das métricas ao longo do tempo</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : monthlyData.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-center">
                  <p className="text-muted-foreground">Nenhum dado disponível para o período selecionado</p>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="pb-2 text-left font-medium">Mês</th>
                          <th className="pb-2 text-right font-medium">Investimento</th>
                          <th className="pb-2 text-right font-medium">Faturamento</th>
                          <th className="pb-2 text-right font-medium">Lucro</th>
                          <th className="pb-2 text-right font-medium">ROI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyData.map((month) => (
                          <tr key={month.month} className="border-b last:border-0">
                            <td className="py-3">{formatMonth(month.month)}</td>
                            <td className="py-3 text-right">{formatCurrency(month.investment)}</td>
                            <td className="py-3 text-right">{formatCurrency(month.revenue)}</td>
                            <td
                              className={`py-3 text-right ${month.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                            >
                              {formatCurrency(month.profit)}
                            </td>
                            <td
                              className={`py-3 text-right ${month.roi >= 100 ? "text-green-600 dark:text-green-400" : month.roi >= 0 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}
                            >
                              {month.roi.toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded-lg border p-4">
                    <h4 className="mb-4 text-sm font-medium">Análise de Tendência</h4>
                    {monthlyData.length >= 2 && (
                      <div className="space-y-2 text-sm">
                        {(() => {
                          // Calcular tendências
                          const firstMonth = monthlyData[0]
                          const lastMonth = monthlyData[monthlyData.length - 1]
                          const profitTrend = lastMonth.profit - firstMonth.profit
                          const roiTrend = lastMonth.roi - firstMonth.roi

                          return (
                            <>
                              <p
                                className={`flex items-center gap-2 ${profitTrend >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                              >
                                {profitTrend >= 0 ? "↗" : "↘"}
                                <span>
                                  {profitTrend >= 0 ? "Aumento" : "Redução"} de lucro:{" "}
                                  {formatCurrency(Math.abs(profitTrend))} desde {formatMonth(firstMonth.month)}
                                </span>
                              </p>
                              <p
                                className={`flex items-center gap-2 ${roiTrend >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                              >
                                {roiTrend >= 0 ? "↗" : "↘"}
                                <span>
                                  {roiTrend >= 0 ? "Aumento" : "Redução"} de ROI: {Math.abs(roiTrend).toFixed(2)}% desde{" "}
                                  {formatMonth(firstMonth.month)}
                                </span>
                              </p>
                            </>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Investimento e Retorno</CardTitle>
              <CardDescription>Análise da distribuição de recursos e resultados</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : productSummaries.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-center">
                  <p className="text-muted-foreground">Nenhum dado disponível para o período selecionado</p>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border p-4">
                      <h4 className="mb-4 text-sm font-medium">Distribuição de Investimento</h4>
                      <div className="space-y-4">
                        {productSummaries.map((product) => {
                          const percentage = totalInvestment > 0 ? (product.totalInvestment / totalInvestment) * 100 : 0

                          return (
                            <div key={`inv-${product.id}`} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span>{product.name}</span>
                                <span>{percentage.toFixed(1)}%</span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-muted">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <h4 className="mb-4 text-sm font-medium">Distribuição de Lucro</h4>
                      <div className="space-y-4">
                        {productSummaries
                          .filter((product) => product.totalProfit > 0)
                          .map((product) => {
                            const totalPositiveProfit = productSummaries
                              .filter((p) => p.totalProfit > 0)
                              .reduce((sum, p) => sum + p.totalProfit, 0)

                            const percentage =
                              totalPositiveProfit > 0 ? (product.totalProfit / totalPositiveProfit) * 100 : 0

                            return (
                              <div key={`profit-${product.id}`} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span>{product.name}</span>
                                  <span>{percentage.toFixed(1)}%</span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-green-500"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            )
                          })}

                        {productSummaries.filter((product) => product.totalProfit > 0).length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            Nenhum produto com lucro positivo no período selecionado
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <h4 className="mb-4 text-sm font-medium">Eficiência de Investimento</h4>
                    <div className="space-y-4">
                      {productSummaries
                        .sort((a, b) => b.averageRoi - a.averageRoi)
                        .map((product) => {
                          // Normalizar ROI para visualização (máximo 200%)
                          const normalizedRoi = Math.min(product.averageRoi, 200)
                          const percentage = Math.max(0, normalizedRoi / 2) // Dividir por 2 para escala de 0-100%

                          return (
                            <div key={`roi-${product.id}`} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span>{product.name}</span>
                                <span
                                  className={
                                    product.averageRoi >= 100
                                      ? "text-green-600 dark:text-green-400"
                                      : product.averageRoi >= 0
                                        ? "text-yellow-600 dark:text-yellow-400"
                                        : "text-red-600 dark:text-red-400"
                                  }
                                >
                                  {product.averageRoi.toFixed(1)}% ROI
                                </span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-muted">
                                <div
                                  className={`h-full rounded-full ${product.averageRoi >= 100 ? "bg-green-500" : product.averageRoi >= 0 ? "bg-yellow-500" : "bg-red-500"}`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Função auxiliar para formatar mês (YYYY-MM para nome do mês)
function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number)
  const date = new Date(year, month - 1)
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
}
