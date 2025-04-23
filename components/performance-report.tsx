"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import {
  Calendar,
  Download,
  FileSpreadsheet,
  LineChart,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { formatCurrency, formatPercentage } from "@/lib/utils"
import { DateRangePicker } from "@/components/date-range-picker"
import { format, subDays } from "date-fns"

// Tipos para os dados
type ProductPerformance = {
  id: string
  name: string
  totalInvestment: number
  totalRevenue: number
  totalProfit: number
  averageRoi: number
  visits: number
  cpa: number
}

type DateRange = {
  from: Date
  to: Date
}

type PeriodComparison = {
  currentPeriod: ProductPerformance
  previousPeriod: ProductPerformance
  changePercentage: {
    investment: number
    revenue: number
    profit: number
    roi: number
    visits: number
    cpa: number
  }
}

export function PerformanceReport() {
  // Estados
  const [isLoading, setIsLoading] = useState(true)
  const [products, setProducts] = useState<{ id: string; name: string }[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>("")
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  })
  const [performanceData, setPerformanceData] = useState<PeriodComparison | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const router = useRouter()
  const { toast } = useToast()

  // Carregar lista de produtos
  useEffect(() => {
    async function loadProducts() {
      try {
        const { data, error } = await supabase.from("products").select("id, name").order("name")

        if (error) throw error

        if (data && data.length > 0) {
          setProducts(data)
          setSelectedProductId(data[0].id)
        }
      } catch (error) {
        console.error("Erro ao carregar produtos:", error)
        toast({
          title: "Erro",
          description: "Não foi possível carregar a lista de produtos",
          variant: "destructive",
        })
      }
    }

    loadProducts()
  }, [toast])

  // Carregar dados de desempenho quando o produto ou período mudar
  useEffect(() => {
    async function loadPerformanceData() {
      if (!selectedProductId) return

      try {
        setIsLoading(true)

        // Formatar datas para consulta
        const currentFromDate = format(dateRange.from, "yyyy-MM-dd")
        const currentToDate = format(dateRange.to, "yyyy-MM-dd")

        // Calcular período anterior com a mesma duração
        const daysDiff = Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24))
        const previousFromDate = format(subDays(dateRange.from, daysDiff), "yyyy-MM-dd")
        const previousToDate = format(subDays(dateRange.to, daysDiff), "yyyy-MM-dd")

        // Buscar dados do período atual
        const { data: currentData, error: currentError } = await supabase
          .from("product_data")
          .select("investment, revenue, profit, roi, visits, cpa")
          .eq("product_id", selectedProductId)
          .gte("date", currentFromDate)
          .lte("date", currentToDate)

        if (currentError) throw currentError

        // Buscar dados do período anterior
        const { data: previousData, error: previousError } = await supabase
          .from("product_data")
          .select("investment, revenue, profit, roi, visits, cpa")
          .eq("product_id", selectedProductId)
          .gte("date", previousFromDate)
          .lte("date", previousToDate)

        if (previousError) throw previousError

        // Buscar nome do produto
        const { data: productData, error: productError } = await supabase
          .from("products")
          .select("name")
          .eq("id", selectedProductId)
          .single()

        if (productError) throw productError

        // Calcular métricas para o período atual
        const currentPeriod: ProductPerformance = {
          id: selectedProductId,
          name: productData.name,
          totalInvestment: currentData.reduce((sum, item) => sum + (item.investment || 0), 0),
          totalRevenue: currentData.reduce((sum, item) => sum + (item.revenue || 0), 0),
          totalProfit: currentData.reduce((sum, item) => sum + (item.profit || 0), 0),
          averageRoi:
            currentData.length > 0
              ? currentData.reduce((sum, item) => sum + (item.roi || 0), 0) / currentData.length
              : 0,
          visits: currentData.reduce((sum, item) => sum + (item.visits || 0), 0),
          cpa:
            currentData.length > 0 && currentData.reduce((sum, item) => sum + (item.visits || 0), 0) > 0
              ? currentData.reduce((sum, item) => sum + (item.investment || 0), 0) /
                currentData.reduce((sum, item) => sum + (item.visits || 0), 0)
              : 0,
        }

        // Calcular métricas para o período anterior
        const previousPeriod: ProductPerformance = {
          id: selectedProductId,
          name: productData.name,
          totalInvestment: previousData.reduce((sum, item) => sum + (item.investment || 0), 0),
          totalRevenue: previousData.reduce((sum, item) => sum + (item.revenue || 0), 0),
          totalProfit: previousData.reduce((sum, item) => sum + (item.profit || 0), 0),
          averageRoi:
            previousData.length > 0
              ? previousData.reduce((sum, item) => sum + (item.roi || 0), 0) / previousData.length
              : 0,
          visits: previousData.reduce((sum, item) => sum + (item.visits || 0), 0),
          cpa:
            previousData.length > 0 && previousData.reduce((sum, item) => sum + (item.visits || 0), 0) > 0
              ? previousData.reduce((sum, item) => sum + (item.investment || 0), 0) /
                previousData.reduce((sum, item) => sum + (item.visits || 0), 0)
              : 0,
        }

        // Calcular variações percentuais
        const calculatePercentageChange = (current: number, previous: number) => {
          if (previous === 0) return current > 0 ? 100 : 0
          return ((current - previous) / Math.abs(previous)) * 100
        }

        const comparison: PeriodComparison = {
          currentPeriod,
          previousPeriod,
          changePercentage: {
            investment: calculatePercentageChange(currentPeriod.totalInvestment, previousPeriod.totalInvestment),
            revenue: calculatePercentageChange(currentPeriod.totalRevenue, previousPeriod.totalRevenue),
            profit: calculatePercentageChange(currentPeriod.totalProfit, previousPeriod.totalProfit),
            roi: calculatePercentageChange(currentPeriod.averageRoi, previousPeriod.averageRoi),
            visits: calculatePercentageChange(currentPeriod.visits, previousPeriod.visits),
            cpa: calculatePercentageChange(currentPeriod.cpa, previousPeriod.cpa),
          },
        }

        setPerformanceData(comparison)
      } catch (error) {
        console.error("Erro ao carregar dados de desempenho:", error)
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados de desempenho",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    if (selectedProductId) {
      loadPerformanceData()
    }
  }, [selectedProductId, dateRange, toast])

  // Função para exportar dados para CSV
  const exportToCSV = async () => {
    if (!selectedProductId) return

    try {
      setIsExporting(true)

      // Formatar datas para consulta
      const fromDate = format(dateRange.from, "yyyy-MM-dd")
      const toDate = format(dateRange.to, "yyyy-MM-dd")

      // Buscar dados detalhados
      const { data, error } = await supabase
        .from("product_data")
        .select("date, investment, revenue, profit, roi, visits, cpa")
        .eq("product_id", selectedProductId)
        .gte("date", fromDate)
        .lte("date", toDate)
        .order("date")

      if (error) throw error

      if (!data || data.length === 0) {
        toast({
          title: "Aviso",
          description: "Não há dados para exportar no período selecionado",
        })
        return
      }

      // Buscar nome do produto
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("name")
        .eq("id", selectedProductId)
        .single()

      if (productError) throw productError

      // Criar cabeçalho do CSV
      let csvContent = "Data,Investimento,Faturamento,Lucro,ROI,Visitas,CPA\n"

      // Adicionar linhas de dados
      data.forEach((row) => {
        const formattedDate = row.date
        const investment = row.investment || 0
        const revenue = row.revenue || 0
        const profit = row.profit || 0
        const roi = row.roi || 0
        const visits = row.visits || 0
        const cpa = row.cpa || 0

        csvContent += `${formattedDate},${investment},${revenue},${profit},${roi},${visits},${cpa}\n`
      })

      // Criar e baixar o arquivo
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `${productData.name}_${fromDate}_to_${toDate}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Sucesso",
        description: "Relatório exportado com sucesso",
      })
    } catch (error) {
      console.error("Erro ao exportar dados:", error)
      toast({
        title: "Erro",
        description: "Não foi possível exportar os dados",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  // Função para atualizar os dados
  const refreshData = () => {
    setIsLoading(true)
    // Recarregar os dados usando os mesmos filtros
    // Isso vai acionar o useEffect que carrega os dados
    setTimeout(() => {
      setSelectedProductId((prev) => {
        // Forçar a reavaliação do useEffect
        const current = prev
        setSelectedProductId("")
        return current
      })
    }, 100)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Relatório de Desempenho</h2>
          <p className="text-muted-foreground">Compare métricas entre períodos e exporte relatórios detalhados</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" size="sm" onClick={refreshData} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Atualizar
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={exportToCSV}
            disabled={isLoading || isExporting || !performanceData}
          >
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Selecione um produto e período para análise</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Produto</label>
              <Select
                value={selectedProductId}
                onValueChange={setSelectedProductId}
                disabled={products.length === 0 || isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Período</label>
              <DateRangePicker
                date={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to })
                  }
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo de Desempenho */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo de Desempenho</CardTitle>
          <CardDescription>
            {performanceData && (
              <>
                Comparando {format(dateRange.from, "dd/MM/yyyy")} a {format(dateRange.to, "dd/MM/yyyy")} com o período
                anterior
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {Array(6)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
            </div>
          ) : !performanceData ? (
            <div className="flex h-24 items-center justify-center">
              <p className="text-muted-foreground">Selecione um produto e período para visualizar os dados</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {/* Investimento */}
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">Investimento</p>
                  <div
                    className={`flex items-center ${
                      performanceData.changePercentage.investment > 0
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-green-600 dark:text-green-400"
                    }`}
                  >
                    {performanceData.changePercentage.investment > 0 ? (
                      <TrendingUp className="mr-1 h-4 w-4" />
                    ) : (
                      <TrendingDown className="mr-1 h-4 w-4" />
                    )}
                    <span className="text-xs font-medium">
                      {formatPercentage(Math.abs(performanceData.changePercentage.investment))}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-2xl font-bold">
                  {formatCurrency(performanceData.currentPeriod.totalInvestment)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Período anterior: {formatCurrency(performanceData.previousPeriod.totalInvestment)}
                </p>
              </div>

              {/* Faturamento */}
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">Faturamento</p>
                  <div
                    className={`flex items-center ${
                      performanceData.changePercentage.revenue > 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {performanceData.changePercentage.revenue > 0 ? (
                      <TrendingUp className="mr-1 h-4 w-4" />
                    ) : (
                      <TrendingDown className="mr-1 h-4 w-4" />
                    )}
                    <span className="text-xs font-medium">
                      {formatPercentage(Math.abs(performanceData.changePercentage.revenue))}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-2xl font-bold">{formatCurrency(performanceData.currentPeriod.totalRevenue)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Período anterior: {formatCurrency(performanceData.previousPeriod.totalRevenue)}
                </p>
              </div>

              {/* Lucro */}
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">Lucro</p>
                  <div
                    className={`flex items-center ${
                      performanceData.changePercentage.profit > 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {performanceData.changePercentage.profit > 0 ? (
                      <TrendingUp className="mr-1 h-4 w-4" />
                    ) : (
                      <TrendingDown className="mr-1 h-4 w-4" />
                    )}
                    <span className="text-xs font-medium">
                      {formatPercentage(Math.abs(performanceData.changePercentage.profit))}
                    </span>
                  </div>
                </div>
                <p
                  className={`mt-2 text-2xl font-bold ${
                    performanceData.currentPeriod.totalProfit >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {formatCurrency(performanceData.currentPeriod.totalProfit)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Período anterior: {formatCurrency(performanceData.previousPeriod.totalProfit)}
                </p>
              </div>

              {/* ROI */}
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">ROI</p>
                  <div
                    className={`flex items-center ${
                      performanceData.changePercentage.roi > 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {performanceData.changePercentage.roi > 0 ? (
                      <TrendingUp className="mr-1 h-4 w-4" />
                    ) : (
                      <TrendingDown className="mr-1 h-4 w-4" />
                    )}
                    <span className="text-xs font-medium">
                      {formatPercentage(Math.abs(performanceData.changePercentage.roi))}
                    </span>
                  </div>
                </div>
                <p
                  className={`mt-2 text-2xl font-bold ${
                    performanceData.currentPeriod.averageRoi >= 100
                      ? "text-green-600 dark:text-green-400"
                      : performanceData.currentPeriod.averageRoi >= 0
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {performanceData.currentPeriod.averageRoi.toFixed(2)}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Período anterior: {performanceData.previousPeriod.averageRoi.toFixed(2)}%
                </p>
              </div>

              {/* Visitas */}
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">Visitas</p>
                  <div
                    className={`flex items-center ${
                      performanceData.changePercentage.visits > 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {performanceData.changePercentage.visits > 0 ? (
                      <TrendingUp className="mr-1 h-4 w-4" />
                    ) : (
                      <TrendingDown className="mr-1 h-4 w-4" />
                    )}
                    <span className="text-xs font-medium">
                      {formatPercentage(Math.abs(performanceData.changePercentage.visits))}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-2xl font-bold">{performanceData.currentPeriod.visits.toLocaleString()}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Período anterior: {performanceData.previousPeriod.visits.toLocaleString()}
                </p>
              </div>

              {/* CPA */}
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">CPA</p>
                  <div
                    className={`flex items-center ${
                      performanceData.changePercentage.cpa < 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {performanceData.changePercentage.cpa < 0 ? (
                      <TrendingDown className="mr-1 h-4 w-4" />
                    ) : (
                      <TrendingUp className="mr-1 h-4 w-4" />
                    )}
                    <span className="text-xs font-medium">
                      {formatPercentage(Math.abs(performanceData.changePercentage.cpa))}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-2xl font-bold">{formatCurrency(performanceData.currentPeriod.cpa)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Período anterior: {formatCurrency(performanceData.previousPeriod.cpa)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className="mr-2 h-4 w-4" />
              <span>Dados atualizados em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/analytics")}
              className="flex items-center gap-2"
            >
              <LineChart className="h-4 w-4" />
              <span>Ver Analytics Completo</span>
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Insights */}
      {performanceData && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              <span>Insights e Recomendações</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Análise de ROI */}
              {performanceData.currentPeriod.averageRoi < performanceData.previousPeriod.averageRoi && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950">
                  <h4 className="mb-2 font-medium">Queda no ROI</h4>
                  <p className="text-sm">
                    O ROI caiu de {performanceData.previousPeriod.averageRoi.toFixed(2)}% para{" "}
                    {performanceData.currentPeriod.averageRoi.toFixed(2)}%. Considere revisar sua estratégia de
                    investimento e otimizar campanhas com baixo desempenho.
                  </p>
                </div>
              )}

              {/* Análise de CPA */}
              {performanceData.currentPeriod.cpa > performanceData.previousPeriod.cpa && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950">
                  <h4 className="mb-2 font-medium">Aumento no CPA</h4>
                  <p className="text-sm">
                    O custo por aquisição aumentou de {formatCurrency(performanceData.previousPeriod.cpa)} para{" "}
                    {formatCurrency(performanceData.currentPeriod.cpa)}. Isso pode indicar uma redução na eficiência das
                    campanhas de marketing.
                  </p>
                </div>
              )}

              {/* Análise de Lucro */}
              {performanceData.currentPeriod.totalProfit > performanceData.previousPeriod.totalProfit &&
                performanceData.changePercentage.profit > 20 && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
                    <h4 className="mb-2 font-medium">Crescimento Significativo</h4>
                    <p className="text-sm">
                      Parabéns! Seu lucro aumentou {formatPercentage(performanceData.changePercentage.profit)} em
                      relação ao período anterior. Considere aumentar o investimento para escalar ainda mais os
                      resultados.
                    </p>
                  </div>
                )}

              {/* Análise de Investimento vs Retorno */}
              {performanceData.changePercentage.investment > 0 &&
                performanceData.changePercentage.revenue < performanceData.changePercentage.investment && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
                    <h4 className="mb-2 font-medium">Retorno Não Proporcional</h4>
                    <p className="text-sm">
                      O investimento aumentou {formatPercentage(performanceData.changePercentage.investment)}, mas o
                      faturamento não cresceu na mesma proporção. Avalie a eficiência dos canais de marketing e
                      considere realocar recursos para campanhas mais eficientes.
                    </p>
                  </div>
                )}

              {/* Análise de Visitas */}
              {performanceData.currentPeriod.visits < performanceData.previousPeriod.visits && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950">
                  <h4 className="mb-2 font-medium">Redução no Tráfego</h4>
                  <p className="text-sm">
                    O número de visitas caiu de {performanceData.previousPeriod.visits.toLocaleString()} para{" "}
                    {performanceData.currentPeriod.visits.toLocaleString()}. Verifique se houve mudanças nos algoritmos
                    das plataformas ou problemas técnicos no site.
                  </p>
                </div>
              )}

              {/* Recomendação Geral */}
              <div className="rounded-lg border p-4">
                <h4 className="mb-2 font-medium">Recomendação Geral</h4>
                <p className="text-sm">
                  {performanceData.currentPeriod.averageRoi >= 100
                    ? "Seu ROI está acima de 100%, o que é excelente. Continue monitorando e otimizando para manter esse desempenho."
                    : performanceData.currentPeriod.averageRoi >= 50
                      ? "Seu ROI está em um bom patamar, mas ainda há espaço para melhorias. Considere testar novas abordagens de marketing."
                      : "Seu ROI está abaixo do ideal. Recomendamos revisar sua estratégia de marketing e focar em canais com melhor desempenho."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
