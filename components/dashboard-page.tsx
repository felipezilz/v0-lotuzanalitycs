"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import Image from "next/image"
import { Plus, ArrowUpIcon, ArrowDownIcon, RefreshCw, Filter, LayoutDashboard, BarChart3 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PeriodFilter } from "@/components/period-filter"
import { ProductCard } from "@/components/product-card"
import { AddProductModal } from "@/components/add-product-modal"
import { formatCurrency } from "@/lib/utils"
import { type Product, getFilteredProducts, getProducts } from "@/lib/data"
import type { DateRange } from "@/lib/date-utils"
import { useAuth } from "@/lib/auth-context"
import { MainNav } from "@/components/main-nav"
import { useToast } from "@/components/ui/use-toast"
import { ProductCardSkeleton } from "@/components/product-card-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

// Register ChartJS components
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js"
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export function DashboardPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [isAddProductOpen, setIsAddProductOpen] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    investimentoTotal: 0,
    faturamentoTotal: 0,
    lucroTotal: 0,
    roiGeral: 0,
  })
  const [chartData, setChartData] = useState({
    labels: [] as string[],
    lucroData: [] as number[],
    roiData: [] as number[],
  })
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false)
  const [isLoadingInitial, setIsLoadingInitial] = useState(true)
  const [activeView, setActiveView] = useState<string>("grid")
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)

  // Função para carregar produtos - definida com useCallback para evitar recriações desnecessárias
  const fetchProducts = useCallback(
    async (force = false) => {
      // Não tenta carregar se não houver usuário ou componente desmontado
      if (!user || !isMountedRef.current) {
        setIsLoadingInitial(false)
        return
      }

      // Evita carregamentos duplicados
      if (isLoading && !force) return

      // Define o estado de carregamento
      setIsLoading(true)
      setLoadError(null)

      // Configurar um timeout para garantir que o estado de carregamento não fique preso
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }

      loadingTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          console.log("Timeout de carregamento atingido, resetando estado")
          setIsLoading(false)
          setIsLoadingInitial(false)
          setLoadError("Tempo limite excedido ao carregar produtos. Tente novamente.")

          toast({
            title: "Erro",
            description: "Tempo limite excedido ao carregar produtos. Tente novamente.",
            variant: "destructive",
          })
        }
      }, 15000) // 15 segundos de timeout

      try {
        console.log("Iniciando carregamento de produtos...")
        const loadedProducts = await getProducts()
        console.log("Produtos carregados:", loadedProducts.length)

        // Limpar o timeout já que carregou com sucesso
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current)
          loadingTimeoutRef.current = null
        }

        // Só atualiza o estado se o componente ainda estiver montado
        if (isMountedRef.current) {
          // Atualiza o estado com os produtos carregados
          setProducts(loadedProducts)
          setHasInitiallyLoaded(true)
        }
      } catch (error) {
        console.error("Erro ao carregar produtos:", error)

        // Só atualiza o estado se o componente ainda estiver montado
        if (isMountedRef.current) {
          setLoadError("Não foi possível carregar os produtos. Tente novamente.")

          toast({
            title: "Erro",
            description: "Não foi possível carregar os produtos. Tente novamente.",
            variant: "destructive",
          })
        }
      } finally {
        // Limpar o timeout se ainda existir
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current)
          loadingTimeoutRef.current = null
        }

        // Só atualiza o estado se o componente ainda estiver montado
        if (isMountedRef.current) {
          // Sempre finaliza o carregamento, independentemente do resultado
          setIsLoading(false)
          setIsLoadingInitial(false)
        }
      }
    },
    [user, toast, isLoading],
  )

  // Limpar o timeout quando o componente for desmontado
  useEffect(() => {
    // Marcar componente como montado
    isMountedRef.current = true

    return () => {
      // Marcar componente como desmontado
      isMountedRef.current = false

      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
    }
  }, [])

  // Carrega produtos apenas uma vez quando o componente é montado e o usuário está disponível
  useEffect(() => {
    if (!hasInitiallyLoaded && user) {
      fetchProducts()
    } else if (!user) {
      // Se não tem usuário, apenas marca como não carregando inicialmente
      setIsLoadingInitial(false)
    }
  }, [user, fetchProducts, hasInitiallyLoaded])

  // Modificado para recarregar dados quando a página fica visível
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && user && hasInitiallyLoaded) {
        console.log("Dashboard: Página voltou a ficar visível, recarregando produtos...")
        fetchProducts(true)
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [fetchProducts, user, hasInitiallyLoaded])

  // Calcula estatísticas quando os produtos ou o intervalo de datas mudam
  useEffect(() => {
    if (products.length === 0) {
      setStats({
        investimentoTotal: 0,
        faturamentoTotal: 0,
        lucroTotal: 0,
        roiGeral: 0,
      })
      setChartData({
        labels: [],
        lucroData: [],
        roiData: [],
      })
      return
    }

    try {
      const filteredProducts = getFilteredProducts(products, dateRange)

      let investimentoTotal = 0
      let faturamentoTotal = 0

      filteredProducts.forEach((product) => {
        // Soma todos os dados diários para cada produto
        product.dados.forEach((entry) => {
          investimentoTotal += entry.investimento || 0
          faturamentoTotal += entry.faturamento || 0
        })
      })

      const lucroTotal = faturamentoTotal - investimentoTotal
      const roiGeral = investimentoTotal > 0 ? (lucroTotal / investimentoTotal) * 100 : 0

      setStats({
        investimentoTotal,
        faturamentoTotal,
        lucroTotal,
        roiGeral,
      })

      // Prepara dados do gráfico
      // Calcula lucro total e ROI para cada produto
      const productStats = filteredProducts.map((product) => {
        let investimento = 0
        let faturamento = 0

        product.dados.forEach((entry) => {
          investimento += entry.investimento || 0
          faturamento += entry.faturamento || 0
        })

        const lucro = faturamento - investimento
        const roi = investimento > 0 ? (lucro / investimento) * 100 : 0

        return {
          id: product.id,
          nome: product.nome,
          lucro,
          roi,
        }
      })

      // Ordena produtos por lucro (decrescente)
      const sortedByProfit = [...productStats].sort((a, b) => b.lucro - a.lucro)

      // Obtém os 5 principais produtos por lucro
      const topProducts = sortedByProfit.slice(0, 5)

      setChartData({
        labels: topProducts.map((p) => p.nome),
        lucroData: topProducts.map((p) => p.lucro),
        roiData: topProducts.map((p) => p.roi),
      })
    } catch (error) {
      console.error("Erro ao calcular estatísticas:", error)
    }
  }, [products, dateRange])

  // Função para lidar com o sucesso na adição de um produto
  const handleProductAdded = (newProduct: Product) => {
    console.log("Produto adicionado com sucesso:", newProduct.id)

    // Atualiza o estado local com o novo produto
    setProducts((prevProducts) => [newProduct, ...prevProducts])

    // Fecha o modal
    setIsAddProductOpen(false)
  }

  // Adicione esta função dentro do componente DashboardPage
  const handleProductDelete = useCallback(() => {
    // Recarregar a lista de produtos após a exclusão
    fetchProducts(true)
  }, [fetchProducts])

  // Calcular variações percentuais para os cards de métricas
  const percentChanges = useMemo(() => {
    // Simulando variações percentuais (em uma aplicação real, isso viria da comparação com períodos anteriores)
    return {
      investimento: 5.2,
      faturamento: 8.7,
      lucro: stats.lucroTotal > 0 ? 12.3 : -4.5,
      roi: 3.8,
    }
  }, [stats.lucroTotal])

  // Memoizar os cards de produtos para evitar re-renderizações desnecessárias
  const productCards = useMemo(() => {
    return products.map((product) => (
      <ProductCard key={product.id} product={product} dateRange={dateRange} onDelete={handleProductDelete} />
    ))
  }, [products, dateRange, handleProductDelete])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between py-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <Image
              src="https://lotuzpay.com/wp-content/webp-express/webp-images/uploads/2024/09/Logo-Logomarca-LotuzPay-Png-Colorful.png.webp"
              alt="Lotuz Analytics"
              width={120}
              height={40}
              className="h-6 w-auto sm:h-8"
            />
            <h1 className="text-base sm:text-xl font-semibold">Analytics</h1>
          </div>
          <MainNav />
        </div>
      </header>
      <main className="flex-1">
        <div className="container py-6">
          <div className="mb-6 sm:mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h2>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                Acompanhe o desempenho dos seus produtos e tome decisões baseadas em dados
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <PeriodFilter onDateRangeChange={setDateRange} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchProducts(true)}
                  disabled={isLoading}
                  className="h-9 w-9 p-0"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  <span className="sr-only">Atualizar</span>
                </Button>
              </div>
            </div>
          </div>

          <div className="mb-6 sm:mb-8 grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
            <Card className="overflow-hidden">
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Investimento Total
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="text-lg sm:text-2xl font-bold">{formatCurrency(stats.investimentoTotal)}</div>
                <div className="mt-1 flex items-center text-xs">
                  <div
                    className={`mr-1 flex items-center ${percentChanges.investimento >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {percentChanges.investimento >= 0 ? (
                      <ArrowUpIcon className="mr-1 h-3 w-3" />
                    ) : (
                      <ArrowDownIcon className="mr-1 h-3 w-3" />
                    )}
                    {Math.abs(percentChanges.investimento).toFixed(1)}%
                  </div>
                  <span className="text-muted-foreground">vs. período anterior</span>
                </div>
              </CardContent>
              <div className="h-1 w-full bg-gradient-to-r from-blue-400 to-blue-600" />
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Faturamento Total
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="text-lg sm:text-2xl font-bold">{formatCurrency(stats.faturamentoTotal)}</div>
                <div className="mt-1 flex items-center text-xs">
                  <div
                    className={`mr-1 flex items-center ${percentChanges.faturamento >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {percentChanges.faturamento >= 0 ? (
                      <ArrowUpIcon className="mr-1 h-3 w-3" />
                    ) : (
                      <ArrowDownIcon className="mr-1 h-3 w-3" />
                    )}
                    {Math.abs(percentChanges.faturamento).toFixed(1)}%
                  </div>
                  <span className="text-muted-foreground">vs. período anterior</span>
                </div>
              </CardContent>
              <div className="h-1 w-full bg-gradient-to-r from-green-400 to-green-600" />
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Lucro Total</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className={`text-lg sm:text-2xl font-bold ${stats.lucroTotal >= 0 ? "" : "text-destructive"}`}>
                  {formatCurrency(stats.lucroTotal)}
                </div>
                <div className="mt-1 flex items-center text-xs">
                  <div
                    className={`mr-1 flex items-center ${percentChanges.lucro >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {percentChanges.lucro >= 0 ? (
                      <ArrowUpIcon className="mr-1 h-3 w-3" />
                    ) : (
                      <ArrowDownIcon className="mr-1 h-3 w-3" />
                    )}
                    {Math.abs(percentChanges.lucro).toFixed(1)}%
                  </div>
                  <span className="text-muted-foreground">vs. período anterior</span>
                </div>
              </CardContent>
              <div className="h-1 w-full bg-gradient-to-r from-purple-400 to-purple-600" />
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">ROI Geral</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div
                  className={`text-lg sm:text-2xl font-bold ${stats.roiGeral >= 100 ? "text-success" : stats.roiGeral >= 0 ? "" : "text-destructive"}`}
                >
                  {stats.roiGeral.toFixed(2)}%
                </div>
                <div className="mt-1 flex items-center text-xs">
                  <div
                    className={`mr-1 flex items-center ${percentChanges.roi >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {percentChanges.roi >= 0 ? (
                      <ArrowUpIcon className="mr-1 h-3 w-3" />
                    ) : (
                      <ArrowDownIcon className="mr-1 h-3 w-3" />
                    )}
                    {Math.abs(percentChanges.roi).toFixed(1)}%
                  </div>
                  <span className="text-muted-foreground">vs. período anterior</span>
                </div>
              </CardContent>
              <div className="h-1 w-full bg-gradient-to-r from-orange-400 to-orange-600" />
            </Card>
          </div>

          {isLoadingInitial ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-9 w-32" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <ProductCardSkeleton key={index} />
                ))}
              </div>
            </>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <h3 className="mb-2 text-xl font-semibold text-red-500">Erro ao carregar produtos</h3>
              <p className="mb-4 text-muted-foreground">{loadError}</p>
              <Button onClick={() => fetchProducts(true)}>Tentar novamente</Button>
            </div>
          ) : products.length > 0 ? (
            <>
              <div className="mb-4 flex flex-col gap-2 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg sm:text-xl font-semibold">Produtos ({products.length})</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => setIsAddProductOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Adicionar</span>
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="rounded-md border p-1">
                    <div className="flex">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-7 w-8 p-0 ${activeView === "grid" ? "bg-background shadow-sm" : ""}`}
                        onClick={() => setActiveView("grid")}
                      >
                        <LayoutDashboard className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-7 w-8 p-0 ${activeView === "chart" ? "bg-background shadow-sm" : ""}`}
                        onClick={() => setActiveView("chart")}
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                    <Filter className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Filtros</span>
                  </Button>
                </div>
              </div>

              {activeView === "grid" ? (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {productCards}
                </div>
              ) : (
                <Card className="mb-8 border shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-medium">Visão Geral de Produtos</CardTitle>
                    <CardDescription>Comparação de desempenho entre produtos</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] sm:h-[400px]">
                      {/* Aqui poderia ser implementado um gráfico de barras ou outro tipo de visualização */}
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        Visualização em desenvolvimento
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <h3 className="mb-2 text-xl font-semibold">Nenhum produto cadastrado</h3>
              <p className="mb-4 text-muted-foreground">
                Adicione seu primeiro produto para começar a acompanhar suas métricas.
              </p>
              <Button onClick={() => setIsAddProductOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Produto
              </Button>
            </div>
          )}
        </div>
      </main>

      <Button
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-lg"
        onClick={() => setIsAddProductOpen(true)}
      >
        <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
        <span className="sr-only">Adicionar Produto</span>
      </Button>

      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onSuccess={handleProductAdded}
      />
    </div>
  )
}
