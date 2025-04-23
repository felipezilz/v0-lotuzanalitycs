"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useAuth } from "@/lib/auth-context"
import { getMonthsInRange, type DateRange } from "@/lib/date-utils"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabaseClient"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import {
  ArrowLeft,
  Loader2,
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  Edit,
  Save,
  RefreshCw,
  Award,
  BarChart,
  Lightbulb,
  Zap,
  Package,
  DollarSign,
  ShoppingCart,
  Users,
  Target,
  PieChart,
  BarChart3,
  LineChart,
  Percent,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { MainNav } from "@/components/main-nav"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ProductDataTable } from "@/components/product-data-table"
import { ConfirmationModal } from "@/components/confirmation-modal"
import { updateProductData } from "@/lib/data"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { format, parseISO, subDays, startOfMonth, endOfMonth, isWithinInterval } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Bar, Line, Doughnut } from "react-chartjs-2"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { DailyData } from "@/types"

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

export function ProductDetailPage({ productId }: { productId: string }) {
  const { user, refreshSession } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [product, setProduct] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [stats, setStats] = useState({
    investimento: 0,
    faturamento: 0,
    lucro: 0,
    roi: 0,
    visitas: 0,
    vendas: 0,
    cliques: 0,
    impressoes: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    initiateCheckout: 0,
    taxaConversao: 0,
    custosFisicos: 0,
  })
  const [selectedMonth, setSelectedMonth] = useState("")
  const [availableMonths, setAvailableMonths] = useState([])
  const [monthlyData, setMonthlyData] = useState([])
  const [activeTab, setActiveTab] = useState("overview")
  const [savingStates, setSavingStates] = useState({})
  const [hasInitialLoad, setHasInitialLoad] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [loadAttempted, setLoadAttempted] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState("")
  const [isSavingName, setIsSavingName] = useState(false)
  const [selectedDateRange, setSelectedDateRange] = useState<{
    from: Date | undefined
    to: Date | undefined
  }>({
    from: undefined,
    to: undefined,
  })
  const [selectedPeriod, setSelectedPeriod] = useState("month")
  const [trendData, setTrendData] = useState({
    investimento: { value: 0, trend: "stable" },
    faturamento: { value: 0, trend: "stable" },
    lucro: { value: 0, trend: "stable" },
    roi: { value: 0, trend: "stable" },
  })
  const [isPhysicalProduct, setIsPhysicalProduct] = useState(false)
  const [physicalProductCosts, setPhysicalProductCosts] = useState({
    frete: { valor: 0, tipo: "fixo" }, // 'fixo' ou 'percentual'
    producao: { valor: 0, tipo: "fixo" }, // 'fixo' ou 'percentual'
  })
  const [isSavingProductType, setIsSavingProductType] = useState(false)
  const [dataCache, setDataCache] = useState({})
  const [isDataCached, setIsDataCached] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const loadingTimerRef = useRef(null)

  // Estado para a análise avançada
  const [advancedAnalysis, setAdvancedAnalysis] = useState({
    bestDay: null,
    worstDay: null,
    bestMetrics: {},
    worstMetrics: {},
    averageMetrics: {},
    dailyTrends: [],
    weekdayPerformance: [],
    conversionFunnel: {},
    profitMargin: 0,
    breakEvenPoint: 0,
    projectedGrowth: 0,
    seasonalTrends: [],
    insights: [],
    recommendations: [],
    chartData: {
      performance: null,
      trends: null,
      weekday: null,
      funnel: null,
      distribution: null,
    },
  })

  // Adicionar um novo estado para controlar o modal de configuração de produto físico
  const [isProductConfigModalOpen, setIsProductConfigModalOpen] = useState(false)

  // Estado temporário para edição dos custos no modal
  const [tempProductCosts, setTempProductCosts] = useState({
    frete: { valor: 0, tipo: "fixo" },
    producao: { valor: 0, tipo: "fixo" },
  })

  // Função para definir o período de tempo
  const handlePeriodChange = useCallback(
    (period) => {
      setSelectedPeriod(period)

      // Definir o intervalo de datas com base no período selecionado
      const today = new Date()
      let from, to

      switch (period) {
        case "today":
          from = new Date(today)
          to = new Date(today)
          break
        case "yesterday":
          from = subDays(today, 1)
          to = subDays(today, 1)
          break
        case "week":
          from = subDays(today, 6)
          to = today
          break
        case "month":
          from = startOfMonth(today)
          to = endOfMonth(today)
          break
        case "last30":
          from = subDays(today, 29)
          to = today
          break
        case "last90":
          from = subDays(today, 89)
          to = today
          break
        case "custom":
          // Usar o intervalo personalizado já definido
          if (selectedDateRange.from && selectedDateRange.to) {
            from = selectedDateRange.from
            to = selectedDateRange.to
          } else {
            // Se não houver intervalo personalizado, usar o mês atual
            from = startOfMonth(today)
            to = endOfMonth(today)
          }
          break
        case "all":
          // Não definir intervalo para mostrar todos os dados
          setDateRange(null)
          return
        default:
          // Padrão para o mês atual
          from = startOfMonth(today)
          to = endOfMonth(today)
      }

      if (from && to) {
        setDateRange({ from, to })
      }
    },
    [selectedDateRange],
  )

  // Efeito para aplicar o período selecionado
  useEffect(() => {
    if (selectedPeriod !== "custom") {
      handlePeriodChange(selectedPeriod)
    } else if (selectedDateRange.from && selectedDateRange.to) {
      setDateRange({
        from: selectedDateRange.from,
        to: selectedDateRange.to,
      })
    }
  }, [selectedPeriod, selectedDateRange, handlePeriodChange])

  // Verificar sessão antes de carregar dados
  useEffect(() => {
    async function checkSession() {
      try {
        console.log("Verificando sessão antes de carregar produto...")
        const { data } = await supabase.auth.getSession()

        if (!data.session) {
          console.log("Nenhuma sessão encontrada, redirecionando para login")
          router.push("/")
          return false
        }

        return true
      } catch (error) {
        console.error("Erro ao verificar sessão:", error)
        return false
      } finally {
        setSessionChecked(true)
      }
    }

    if (!sessionChecked) {
      checkSession()
    }
  }, [router, sessionChecked])

  // Simulação de progresso de carregamento
  useEffect(() => {
    if (isLoading && !loadingTimerRef.current) {
      setLoadingProgress(0)

      loadingTimerRef.current = setInterval(() => {
        setLoadingProgress((prev) => {
          const increment = Math.random() * 15
          const newProgress = Math.min(prev + increment, 90) // Nunca chega a 100% até que os dados estejam realmente carregados
          return newProgress
        })
      }, 300)
    } else if (!isLoading && loadingTimerRef.current) {
      clearInterval(loadingTimerRef.current)
      loadingTimerRef.current = null
      setLoadingProgress(100)
    }

    return () => {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current)
        loadingTimerRef.current = null
      }
    }
  }, [isLoading])

  // Carregar dados do produto
  const loadProduct = useCallback(
    async (forceReload = false) => {
      if (!productId || !user || (loadAttempted && !forceReload) || !sessionChecked) return

      setLoadAttempted(true)

      // Verificar se temos dados em cache
      if (!forceReload && isDataCached && dataCache[productId]) {
        console.log("Usando dados em cache para o produto:", productId)
        const cachedData = dataCache[productId]
        setProduct(cachedData.product)
        setEditedName(cachedData.product.nome)
        setAvailableMonths(cachedData.availableMonths)
        setIsPhysicalProduct(cachedData.isPhysicalProduct || false)
        setPhysicalProductCosts(
          cachedData.physicalProductCosts || {
            frete: { valor: 0, tipo: "fixo" },
            producao: { valor: 0, tipo: "fixo" },
          },
        )

        if (cachedData.availableMonths.length > 0 && !selectedMonth && !hasInitialLoad) {
          setSelectedMonth(cachedData.availableMonths[0].value)
          setHasInitialLoad(true)
        }

        calculateStats(cachedData.product)
        calculateTrends(cachedData.product)
        performAdvancedAnalysis(cachedData.product)

        return
      }

      try {
        setIsLoading(true)
        setError(null)
        console.log("Carregando produto:", productId)

        // Verificar se a sessão ainda é válida
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session) {
          console.error("Sessão expirada ou inválida")
          toast({
            title: "Sessão expirada",
            description: "Sua sessão expirou. Por favor, faça login novamente.",
            variant: "destructive",
          })
          router.push("/")
          return
        }

        // Busca o produto diretamente do Supabase
        const { data: productData, error: productError } = await supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .single()

        if (productError) {
          console.error("Erro ao buscar produto:", productError)
          setError("Produto não encontrado")
          setIsLoading(false)
          return
        }

        if (!productData) {
          setError("Produto não encontrado")
          setIsLoading(false)
          return
        }

        // Busca os dados diários do produto
        const { data: dailyData, error: dailyError } = await supabase
          .from("product_data")
          .select("*")
          .eq("product_id", productId)

        if (dailyError) {
          console.error("Erro ao buscar dados diários:", dailyError)
        }

        // Busca as configurações do produto (tipo físico, custos adicionais)
        const { data: productConfig, error: configError } = await supabase
          .from("product_config")
          .select("*")
          .eq("product_id", productId)
          .single()

        let isPhysical = false
        let physicalCosts = { frete: { valor: 0, tipo: "fixo" }, producao: { valor: 0, tipo: "fixo" } }

        if (!configError && productConfig) {
          isPhysical = productConfig.is_physical || false
          physicalCosts = {
            frete: { valor: productConfig.shipping_cost || 0, tipo: "fixo" },
            producao: { valor: productConfig.production_cost || 0, tipo: "fixo" },
          }
        }

        // Converte os dados para o formato da aplicação
        const formattedProduct = {
          id: productData.id,
          nome: productData.name,
          imagem: productData.image || "/placeholder.svg?height=200&width=200",
          dados: (dailyData || []).map((item) => ({
            data: item.date,
            investimento: item.investment || 0,
            faturamento: item.revenue || 0,
            lucro: item.profit || 0,
            roi: item.roi || 0,
            visitas: item.visits || 0,
            cliques: item.clicks || 0,
            impressoes: item.impressions || 0,
            vendas: item.sales || 0,
            initiateCheckout: item.initiate_checkout || 0,
            ctr: item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0,
            cpc: item.clicks > 0 ? item.investment / item.clicks : 0,
            cpm: item.impressions > 0 ? (item.investment / item.impressions) * 1000 : 0,
            taxaConversao: item.visits > 0 ? (item.sales / item.visits) * 100 : 0,
          })),
          createdAt: productData.created_at || new Date().toISOString(),
        }

        console.log("Produto carregado:", formattedProduct.nome)
        setProduct(formattedProduct)
        setEditedName(formattedProduct.nome)

        // Carregar configurações do produto do localStorage
        try {
          const savedConfig = localStorage.getItem(`product_config_${productId}`)
          if (savedConfig) {
            const config = JSON.parse(savedConfig)
            // Definir os valores do localStorage com prioridade sobre os valores do banco
            setIsPhysicalProduct(config.isPhysical !== undefined ? config.isPhysical : isPhysical)
            setPhysicalProductCosts(
              config.physicalCosts || { frete: { valor: 0, tipo: "fixo" }, producao: { valor: 0, tipo: "fixo" } },
            )
            console.log("Configurações carregadas do localStorage:", config)
          } else {
            // Se não houver configuração no localStorage, usar os valores do banco
            setIsPhysicalProduct(isPhysical)
            setPhysicalProductCosts(physicalCosts)
            console.log("Usando configurações do banco de dados")
          }
        } catch (e) {
          console.error("Erro ao carregar configurações do localStorage:", e)
          // Em caso de erro, usar os valores do banco
          setIsPhysicalProduct(isPhysical)
          setPhysicalProductCosts(physicalCosts)
        }

        setIsPhysicalProduct(isPhysical)
        setPhysicalProductCosts(physicalCosts)

        // Definir meses disponíveis
        const startDate = new Date(formattedProduct.createdAt)
        const endDate = new Date()
        const months = getMonthsInRange(startDate, endDate)
        setAvailableMonths(months)

        // Definir mês atual como padrão se não houver mês selecionado
        if (months.length > 0 && !selectedMonth && !hasInitialLoad) {
          setSelectedMonth(months[0].value)
          setHasInitialLoad(true)
        }

        // Calcular estatísticas iniciais
        calculateStats(formattedProduct)
        calculateTrends(formattedProduct)

        // Realizar análise avançada
        performAdvancedAnalysis(formattedProduct)

        // Armazenar em cache
        setDataCache((prev) => ({
          ...prev,
          [productId]: {
            product: formattedProduct,
            availableMonths: months,
            isPhysicalProduct: isPhysical,
            physicalProductCosts: physicalCosts,
            timestamp: Date.now(),
          },
        }))
        setIsDataCached(true)
      } catch (err) {
        console.error("Erro ao carregar produto:", err)
        setError("Erro ao carregar dados do produto")
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados do produto. Tente novamente.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    },
    [
      productId,
      user,
      toast,
      selectedMonth,
      hasInitialLoad,
      loadAttempted,
      router,
      sessionChecked,
      isDataCached,
      dataCache,
    ],
  )

  // Carregar produto quando o componente montar
  useEffect(() => {
    if (sessionChecked) {
      loadProduct()
    }
  }, [loadProduct, sessionChecked])

  // Modifique o useEffect que lida com a visibilidade da página
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        console.log("Página de produto voltou a ficar visível, verificando sessão...")

        // Tenta atualizar a sessão primeiro
        try {
          const sessionValid = await refreshSession()

          // Só recarrega os dados se a sessão for válida
          if (sessionValid) {
            console.log("Sessão válida, recarregando dados do produto...")
            loadProduct(true) // Força o recarregamento
          } else {
            console.log("Sessão inválida ou expirada, tentando recuperar...")

            // Espera um pouco e tenta novamente com mais persistência
            await new Promise((resolve) => setTimeout(resolve, 2000))
            const retrySession = await refreshSession()

            if (retrySession) {
              console.log("Sessão recuperada na segunda tentativa, recarregando dados...")
              loadProduct(true)
            } else {
              // Última tentativa antes de desistir
              await new Promise((resolve) => setTimeout(resolve, 3000))
              const finalAttempt = await refreshSession()

              if (finalAttempt) {
                console.log("Sessão recuperada na tentativa final, recarregando dados...")
                loadProduct(true)
              } else {
                console.log("Não foi possível recuperar a sessão após múltiplas tentativas")
                // Não redirecionar imediatamente, mostrar um toast e permitir que o usuário tente manualmente
                toast({
                  title: "Problemas de conexão",
                  description: "Houve um problema com sua sessão. Tente recarregar a página.",
                  action: (
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                      Recarregar
                    </Button>
                  ),
                  duration: 10000, // 10 segundos
                })
              }
            }
          }
        } catch (error) {
          console.error("Erro ao verificar sessão após retorno à página:", error)
          toast({
            title: "Erro de conexão",
            description: "Ocorreu um erro ao reconectar. Tente recarregar a página.",
            variant: "destructive",
            action: (
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Recarregar
              </Button>
            ),
            duration: 10000, // 10 segundos
          })
        }
      }
    }

    // Adiciona o listener de visibilidade
    document.addEventListener("visibilitychange", handleVisibilityChange)

    // Remove o listener quando o componente é desmontado
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [loadProduct, refreshSession, toast])

  // Vamos ajustar a função calculateStats para calcular corretamente os custos físicos
  // quando eles são definidos como percentual do faturamento

  // Função para calcular estatísticas
  const calculateStats = useCallback(
    (productData) => {
      if (!productData) return

      let filteredData = productData.dados

      // Filtrar por período se houver um período selecionado
      if (dateRange) {
        filteredData = filteredData.filter((item) => {
          const itemDate = new Date(item.data)
          return isWithinInterval(itemDate, { start: dateRange.from, end: dateRange.to })
        })
      }

      // Calcular totais
      let investimento = 0
      let faturamento = 0
      let visitas = 0
      let cliques = 0
      let impressoes = 0
      let vendas = 0
      let initiateCheckout = 0
      let custosFisicos = 0

      filteredData.forEach((item) => {
        investimento += item.investimento || 0
        faturamento += item.faturamento || 0
        visitas += item.visitas || 0
        cliques += item.cliques || 0
        impressoes += item.impressoes || 0
        vendas += item.vendas || 0
        initiateCheckout += item.initiateCheckout || 0
      })

      // Adicionar custos de produto físico se aplicável
      if (isPhysicalProduct) {
        // Calcular custos fixos
        const custoFixoTotal =
          vendas *
          ((physicalProductCosts.frete.tipo === "fixo" ? physicalProductCosts.frete.valor : 0) +
            (physicalProductCosts.producao.tipo === "fixo" ? physicalProductCosts.producao.valor : 0))

        // Calcular custos percentuais
        const custoPercentualTotal =
          faturamento *
          ((physicalProductCosts.frete.tipo === "percentual" ? physicalProductCosts.frete.valor / 100 : 0) +
            (physicalProductCosts.producao.tipo === "percentual" ? physicalProductCosts.producao.valor / 100 : 0))

        custosFisicos = custoFixoTotal + custoPercentualTotal
        investimento += custosFisicos
      }

      const lucro = faturamento - investimento
      const roi = investimento > 0 ? (lucro / investimento) * 100 : 0
      const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0
      const cpc = cliques > 0 ? investimento / cliques : 0
      const cpm = impressoes > 0 ? (investimento / impressoes) * 1000 : 0
      const taxaConversao = visitas > 0 ? (vendas / visitas) * 100 : 0

      setStats({
        investimento,
        faturamento,
        lucro,
        roi,
        visitas,
        vendas,
        cliques,
        impressoes,
        ctr,
        cpc,
        cpm,
        initiateCheckout,
        taxaConversao,
        custosFisicos,
      })
    },
    [dateRange, isPhysicalProduct, physicalProductCosts],
  )

  // Função para calcular tendências
  const calculateTrends = useCallback(
    (productData) => {
      if (!productData || productData.dados.length < 2) return

      // Filtrar dados pelo período selecionado
      let filteredData = productData.dados
      if (dateRange) {
        filteredData = filteredData.filter((item) => {
          const itemDate = new Date(item.data)
          return isWithinInterval(itemDate, { start: dateRange.from, end: dateRange.to })
        })
      }

      // Ordenar dados por data
      const sortedData = [...filteredData].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())

      // Dividir em dois períodos
      const midPoint = Math.floor(sortedData.length / 2)
      const firstHalf = sortedData.slice(0, midPoint)
      const secondHalf = sortedData.slice(midPoint)

      // Calcular totais para cada período
      const firstHalfTotals = {
        investimento: firstHalf.reduce((sum, item) => sum + (item.investimento || 0), 0),
        faturamento: firstHalf.reduce((sum, item) => sum + (item.faturamento || 0), 0),
        lucro: firstHalf.reduce((sum, item) => sum + (item.lucro || 0), 0),
        roi: firstHalf.reduce((sum, item) => sum + (item.roi || 0) / (firstHalf.length || 1), 0),
      }

      const secondHalfTotals = {
        investimento: secondHalf.reduce((sum, item) => sum + (item.investimento || 0), 0),
        faturamento: secondHalf.reduce((sum, item) => sum + (item.faturamento || 0), 0),
        lucro: secondHalf.reduce((sum, item) => sum + (item.lucro || 0), 0),
        roi: secondHalf.reduce((sum, item) => sum + (item.roi || 0) / (secondHalf.length || 1), 0),
      }

      // Calcular variações percentuais
      const trends = {
        investimento: {
          value:
            firstHalfTotals.investimento > 0
              ? ((secondHalfTotals.investimento - firstHalfTotals.investimento) / firstHalfTotals.investimento) * 100
              : 0,
          trend: "stable",
        },
        faturamento: {
          value:
            firstHalfTotals.faturamento > 0
              ? ((secondHalfTotals.faturamento - firstHalfTotals.faturamento) / firstHalfTotals.faturamento) * 100
              : 0,
          trend: "stable",
        },
        lucro: {
          value:
            firstHalfTotals.lucro > 0
              ? ((secondHalfTotals.lucro - firstHalfTotals.lucro) / firstHalfTotals.lucro) * 100
              : 0,
          trend: "stable",
        },
        roi: {
          value: firstHalfTotals.roi > 0 ? secondHalfTotals.roi - firstHalfTotals.roi : 0,
          trend: "stable",
        },
      }

      // Determinar tendências
      Object.keys(trends).forEach((key) => {
        if (trends[key].value > 1) {
          trends[key].trend = "up"
        } else if (trends[key].value < -1) {
          trends[key].trend = "down"
        }
      })

      setTrendData(trends)
    },
    [dateRange],
  )

  // Função para realizar análise avançada
  const performAdvancedAnalysis = useCallback(
    (productData) => {
      if (!productData || productData.dados.length === 0) return

      // Filtrar dados pelo período selecionado
      let filteredData = productData.dados
      if (dateRange) {
        filteredData = filteredData.filter((item) => {
          const itemDate = new Date(item.data)
          return isWithinInterval(itemDate, { start: dateRange.from, end: dateRange.to })
        })
      }

      // Ordenar dados por data
      const sortedByDate = [...filteredData].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())

      // Ordenar por lucro (decrescente e crescente)
      const sortedByProfit = [...filteredData].sort((a, b) => b.lucro - a.lucro)
      const sortedByProfitAsc = [...filteredData].sort((a, b) => a.lucro - b.lucro)

      // Obter o dia com maior e menor lucro
      const bestDay = sortedByProfit[0]
      const worstDay = sortedByProfitAsc[0]

      // Calcular médias para todos os campos
      const averageMetrics = {}
      const metricKeys = [
        "investimento",
        "faturamento",
        "lucro",
        "roi",
        "visitas",
        "cliques",
        "impressoes",
        "vendas",
        "ctr",
        "cpc",
        "cpm",
        "initiateCheckout",
        "taxaConversao",
      ]

      metricKeys.forEach((key) => {
        averageMetrics[key] = filteredData.reduce((sum, item) => sum + (item[key] || 0), 0) / filteredData.length || 0
      })

      // Encontrar os melhores e piores valores para cada métrica
      const bestMetrics = {}
      const worstMetrics = {}

      metricKeys.forEach((key) => {
        // Para métricas onde maior é melhor
        if (
          ["faturamento", "lucro", "roi", "visitas", "vendas", "ctr", "taxaConversao", "initiateCheckout"].includes(key)
        ) {
          bestMetrics[key] = Math.max(...filteredData.map((item) => item[key] || 0))
          worstMetrics[key] = Math.min(...filteredData.map((item) => item[key] || 0))
        }
        // Para métricas onde menor é melhor
        else if (["investimento", "cpc", "cpm"].includes(key)) {
          bestMetrics[key] = Math.min(
            ...filteredData.filter((item) => (item[key] || 0) > 0).map((item) => item[key] || 0),
          )
          worstMetrics[key] = Math.max(...filteredData.map((item) => item[key] || 0))
        }
        // Para cliques e impressões, maior é geralmente melhor
        else {
          bestMetrics[key] = Math.max(...filteredData.map((item) => item[key] || 0))
          worstMetrics[key] = Math.min(...filteredData.map((item) => item[key] || 0))
        }
      })

      // Analisar tendências diárias
      const dailyTrends = sortedByDate.map((item, index, array) => {
        if (index === 0) return { data: item.data, lucro: item.lucro, tendencia: "stable" }

        const prevLucro = array[index - 1].lucro
        const currentLucro = item.lucro
        let tendencia = "stable"

        if (currentLucro > prevLucro * 1.1) tendencia = "up"
        else if (currentLucro < prevLucro * 0.9) tendencia = "down"

        return { data: item.data, lucro: currentLucro, tendencia }
      })

      // Analisar desempenho por dia da semana
      const weekdayPerformance = [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
        const weekdayData = filteredData.filter((item) => {
          const date = new Date(item.data)
          return date.getDay() === weekday
        })

        if (weekdayData.length === 0)
          return {
            weekday,
            name: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][weekday],
            lucro: 0,
            faturamento: 0,
            investimento: 0,
            roi: 0,
            vendas: 0,
            count: 0,
          }

        return {
          weekday,
          name: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][weekday],
          lucro: weekdayData.reduce((sum, item) => sum + (item.lucro || 0), 0) / weekdayData.length,
          faturamento: weekdayData.reduce((sum, item) => sum + (item.faturamento || 0), 0) / weekdayData.length,
          investimento: weekdayData.reduce((sum, item) => sum + (item.investimento || 0), 0) / weekdayData.length,
          roi: weekdayData.reduce((sum, item) => sum + (item.roi || 0), 0) / weekdayData.length,
          vendas: weekdayData.reduce((sum, item) => sum + (item.vendas || 0), 0) / weekdayData.length,
          count: weekdayData.length,
        }
      })

      // Analisar funil de conversão
      const totalVisitas = filteredData.reduce((sum, item) => sum + (item.visitas || 0), 0)
      const totalInitiateCheckout = filteredData.reduce((sum, item) => sum + (item.initiateCheckout || 0), 0)
      const totalVendas = filteredData.reduce((sum, item) => sum + (item.vendas || 0), 0)

      const conversionFunnel = {
        visitas: totalVisitas,
        initiateCheckout: totalInitiateCheckout,
        vendas: totalVendas,
        taxaVisitasParaCheckout: totalVisitas > 0 ? (totalInitiateCheckout / totalVisitas) * 100 : 0,
        taxaCheckoutParaVendas: totalInitiateCheckout > 0 ? (totalVendas / totalInitiateCheckout) * 100 : 0,
        taxaVisitasParaVendas: totalVisitas > 0 ? (totalVendas / totalVisitas) * 100 : 0,
      }

      // Calcular margem de lucro
      const totalFaturamento = filteredData.reduce((sum, item) => sum + (item.faturamento || 0), 0)
      const totalInvestimento = filteredData.reduce((sum, item) => sum + (item.investimento || 0), 0)
      const profitMargin = totalFaturamento > 0 ? ((totalFaturamento - totalInvestimento) / totalFaturamento) * 100 : 0

      // Calcular ponto de equilíbrio
      const breakEvenPoint = totalFaturamento > 0 ? (totalInvestimento / totalFaturamento) * totalVendas : 0

      // Projetar crescimento (baseado na tendência atual)
      const firstHalfLucro = sortedByDate
        .slice(0, Math.floor(sortedByDate.length / 2))
        .reduce((sum, item) => sum + (item.lucro || 0), 0)
      const secondHalfLucro = sortedByDate
        .slice(Math.floor(sortedByDate.length / 2))
        .reduce((sum, item) => sum + (item.lucro || 0), 0)

      const projectedGrowth = firstHalfLucro > 0 ? ((secondHalfLucro - firstHalfLucro) / firstHalfLucro) * 100 : 0

      // Gerar insights baseados na análise
      const insights = []

      // Insights sobre o melhor dia
      if (bestDay) {
        insights.push(
          `Seu melhor dia foi ${format(parseISO(bestDay.data), "dd/MM/yyyy", { locale: ptBR })} com lucro de ${formatCurrency(bestDay.lucro)}.`,
        )

        if (bestDay.roi > 200) {
          insights.push(`O ROI neste dia foi excepcionalmente alto: ${bestDay.roi.toFixed(2)}%.`)
        }

        if (bestDay.vendas > averageMetrics.vendas * 2) {
          insights.push(`As vendas foram ${(bestDay.vendas / averageMetrics.vendas).toFixed(1)}x maiores que a média.`)
        }
      }

      // Insights sobre dias da semana
      const bestWeekday = [...weekdayPerformance].sort((a, b) => b.lucro - a.lucro)[0]
      if (bestWeekday && bestWeekday.count > 0) {
        insights.push(
          `${bestWeekday.name} é o dia com melhor desempenho médio (${formatCurrency(bestWeekday.lucro)} de lucro).`,
        )
      }

      // Insights sobre funil de conversão
      if (conversionFunnel.taxaVisitasParaVendas < 2) {
        insights.push(
          `Sua taxa de conversão de visitas para vendas é de apenas ${conversionFunnel.taxaVisitasParaVendas.toFixed(2)}%. Há espaço para melhorias.`,
        )
      } else if (conversionFunnel.taxaVisitasParaVendas > 5) {
        insights.push(`Sua taxa de conversão de ${conversionFunnel.taxaVisitasParaVendas.toFixed(2)}% é excelente!`)
      }

      if (conversionFunnel.taxaCheckoutParaVendas < 30) {
        insights.push(
          `${(100 - conversionFunnel.taxaCheckoutParaVendas).toFixed(0)}% dos checkouts não se convertem em vendas. Verifique seu processo de checkout.`,
        )
      }

      // Insights sobre tendências
      if (projectedGrowth > 20) {
        insights.push(`Seu produto está em forte crescimento: +${projectedGrowth.toFixed(0)}% recentemente.`)
      } else if (projectedGrowth < -20) {
        insights.push(`Atenção: seu produto está em declínio de ${Math.abs(projectedGrowth).toFixed(0)}% recentemente.`)
      }

      // Insights sobre ROI
      const avgRoi = averageMetrics.roi
      if (avgRoi < 50) {
        insights.push(`Seu ROI médio de ${avgRoi.toFixed(2)}% está abaixo do ideal. Considere otimizar seus custos.`)
      } else if (avgRoi > 150) {
        insights.push(`Excelente ROI médio de ${avgRoi.toFixed(2)}%. Considere escalar seu investimento.`)
      }

      // Gerar recomendações baseadas na análise
      const recommendations = []

      // Recomendações baseadas no ROI
      if (avgRoi < 100) {
        recommendations.push("Reduza custos de aquisição ou aumente o valor médio do pedido para melhorar o ROI.")
      } else {
        recommendations.push("Seu ROI está saudável. Considere aumentar o investimento para escalar os resultados.")
      }

      // Recomendações baseadas no dia da semana
      if (bestWeekday && bestWeekday.count > 0) {
        recommendations.push(`Concentre mais investimentos em ${bestWeekday.name}, que tem o melhor desempenho.`)
      }

      // Recomendações baseadas no funil de conversão
      if (conversionFunnel.taxaVisitasParaCheckout < 20) {
        recommendations.push("Melhore a experiência da página de produto para aumentar a taxa de checkout.")
      }

      if (conversionFunnel.taxaCheckoutParaVendas < 40) {
        recommendations.push("Simplifique o processo de checkout para reduzir o abandono de carrinho.")
      }

      // Recomendações baseadas na tendência
      if (projectedGrowth < 0) {
        recommendations.push("Revise sua estratégia de marketing e considere testar novas abordagens.")
      }

      // Recomendações para produto físico
      if (isPhysicalProduct) {
        const custoTotal = physicalProductCosts.frete.valor + physicalProductCosts.producao.valor
        if (custoTotal > 0 && custoTotal / averageMetrics.faturamento > 0.3) {
          recommendations.push(
            "Os custos de produção e frete representam uma grande parte do faturamento. Busque otimizá-los.",
          )
        }
      }

      // Preparar dados para gráficos

      // Gráfico de desempenho
      const performanceChartData = {
        labels: sortedByDate.map((item) => format(parseISO(item.data), "dd/MM", { locale: ptBR })),
        datasets: [
          {
            label: "Lucro",
            data: sortedByDate.map((item) => item.lucro),
            borderColor: "rgb(75, 192, 192)",
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            fill: true,
            tension: 0.4,
          },
          {
            label: "Faturamento",
            data: sortedByDate.map((item) => item.faturamento),
            borderColor: "rgb(54, 162, 235)",
            backgroundColor: "rgba(54, 162, 235, 0.1)",
            borderDash: [5, 5],
            fill: false,
            tension: 0.4,
          },
          {
            label: "Investimento",
            data: sortedByDate.map((item) => item.investimento),
            borderColor: "rgb(255, 99, 132)",
            backgroundColor: "rgba(255, 99, 132, 0.1)",
            borderDash: [5, 5],
            fill: false,
            tension: 0.4,
          },
        ],
      }

      // Gráfico de tendências
      const trendsChartData = {
        labels: sortedByDate.map((item) => format(parseISO(item.data), "dd/MM", { locale: ptBR })),
        datasets: [
          {
            label: "ROI (%)",
            data: sortedByDate.map((item) => item.roi),
            borderColor: "rgb(153, 102, 255)",
            backgroundColor: "rgba(153, 102, 255, 0.2)",
            fill: true,
            tension: 0.4,
            yAxisID: "y",
          },
          {
            label: "Vendas",
            data: sortedByDate.map((item) => item.vendas),
            borderColor: "rgb(255, 159, 64)",
            backgroundColor: "rgba(255, 159, 64, 0.2)",
            fill: true,
            tension: 0.4,
            yAxisID: "y1",
          },
        ],
      }

      // Gráfico de desempenho por dia da semana
      const weekdayChartData = {
        labels: weekdayPerformance.map((day) => day.name),
        datasets: [
          {
            label: "Lucro Médio",
            data: weekdayPerformance.map((day) => day.lucro),
            backgroundColor: "rgba(75, 192, 192, 0.7)",
            borderColor: "rgb(75, 192, 192)",
            borderWidth: 1,
          },
          {
            label: "Vendas Médias",
            data: weekdayPerformance.map((day) => day.vendas),
            backgroundColor: "rgba(255, 159, 64, 0.7)",
            borderColor: "rgb(255, 159, 64)",
            borderWidth: 1,
          },
        ],
      }

      // Gráfico de funil de conversão
      const funnelChartData = {
        labels: ["Visitas", "Checkouts Iniciados", "Vendas"],
        datasets: [
          {
            label: "Funil de Conversão",
            data: [conversionFunnel.visitas, conversionFunnel.initiateCheckout, conversionFunnel.vendas],
            backgroundColor: ["rgba(54, 162, 235, 0.7)", "rgba(255, 206, 86, 0.7)", "rgba(75, 192, 192, 0.7)"],
            borderColor: ["rgb(54, 162, 235)", "rgb(255, 206, 86)", "rgb(75, 192, 192)"],
            borderWidth: 1,
          },
        ],
      }

      // Gráfico de distribuição de custos
      const distributionChartData = {
        labels: ["Investimento em Anúncios", "Custo de Produção", "Frete", "Lucro"],
        datasets: [
          {
            label: "Distribuição",
            data: [
              // Investimento em anúncios (sem os custos físicos)
              totalInvestimento -
                (isPhysicalProduct
                  ? // Custos fixos
                    totalVendas *
                      ((physicalProductCosts.frete.tipo === "fixo" ? physicalProductCosts.frete.valor : 0) +
                        (physicalProductCosts.producao.tipo === "fixo" ? physicalProductCosts.producao.valor : 0)) +
                    // Custos percentuais
                    totalFaturamento *
                      ((physicalProductCosts.frete.tipo === "percentual" ? physicalProductCosts.frete.valor / 100 : 0) +
                        (physicalProductCosts.producao.tipo === "percentual"
                          ? physicalProductCosts.producao.valor / 100
                          : 0))
                  : 0),

              // Custo de produção
              isPhysicalProduct
                ? totalVendas *
                    (physicalProductCosts.producao.tipo === "fixo" ? physicalProductCosts.producao.valor : 0) +
                  totalFaturamento *
                    (physicalProductCosts.producao.tipo === "percentual"
                      ? physicalProductCosts.producao.valor / 100
                      : 0)
                : 0,

              // Custo de frete
              isPhysicalProduct
                ? totalVendas * (physicalProductCosts.frete.tipo === "fixo" ? physicalProductCosts.frete.valor : 0) +
                  totalFaturamento *
                    (physicalProductCosts.frete.tipo === "percentual" ? physicalProductCosts.frete.valor / 100 : 0)
                : 0,

              // Lucro
              totalFaturamento - totalInvestimento,
            ],
            backgroundColor: [
              "rgba(255, 99, 132, 0.7)",
              "rgba(54, 162, 235, 0.7)",
              "rgba(255, 206, 86, 0.7)",
              "rgba(75, 192, 192, 0.7)",
            ],
            borderColor: ["rgb(255, 99, 132)", "rgb(54, 162, 235)", "rgb(255, 206, 86)", "rgb(75, 192, 192)"],
            borderWidth: 1,
            hoverOffset: 4,
          },
        ],
      }

      // Atualizar o estado com a análise avançada
      setAdvancedAnalysis({
        bestDay,
        worstDay,
        bestMetrics,
        worstMetrics,
        averageMetrics,
        dailyTrends,
        weekdayPerformance,
        conversionFunnel,
        profitMargin,
        breakEvenPoint,
        projectedGrowth,
        insights,
        recommendations,
        chartData: {
          performance: performanceChartData,
          trends: trendsChartData,
          weekday: weekdayChartData,
          funnel: funnelChartData,
          distribution: distributionChartData,
        },
      })
    },
    [dateRange, isPhysicalProduct, physicalProductCosts],
  )

  // Calcular estatísticas quando o produto ou o intervalo de datas mudam
  useEffect(() => {
    calculateStats(product)
    calculateTrends(product)
    performAdvancedAnalysis(product)
  }, [product, dateRange, calculateStats, calculateTrends, performAdvancedAnalysis])

  // Gerar dados para o mês selecionado
  useEffect(() => {
    if (!product || !selectedMonth) return

    const [year, month] = selectedMonth.split("-").map(Number)

    // Obter o número de dias no mês
    const daysInMonth = new Date(year, month, 0).getDate()

    // Criar array com todos os dias do mês
    const days = []
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`

      // Verificar se já temos dados para este dia
      const existingData = product.dados.find((item) => item.data === dateStr)

      if (existingData) {
        days.push(existingData)
      } else {
        // Criar dados vazios para este dia
        days.push({
          data: dateStr,
          investimento: 0,
          faturamento: 0,
          lucro: 0,
          roi: 0,
          visitas: 0,
          initiateCheckout: 0,
          cliques: 0,
          impressoes: 0,
          vendas: 0,
          ctr: 0,
          cpc: 0,
          cpm: 0,
          taxaConversao: 0,
        })
      }
    }

    setMonthlyData(days)

    // Limpar estados de salvamento ao mudar de mês
    setSavingStates({})
  }, [product, selectedMonth])

  // Função para atualizar um campo de um dia específico
  const updateDayField = async (date: string, data: DailyData) => {
    try {
      console.log("Iniciando updateDayField para data:", date)
      console.log("Dados a serem enviados:", data)

      // Verificar se os dados estão completos
      if (!data.data) {
        data.data = date // Garantir que o campo data está preenchido
      }

      // Garantir que todos os campos numéricos existam para evitar erros
      const completeData: DailyData = {
        data: data.data,
        investimento: data.investimento || 0,
        faturamento: data.faturamento || 0,
        lucro: data.lucro || 0,
        roi: data.roi || 0,
        visitas: data.visitas || 0,
        cliques: data.cliques || 0,
        impressoes: data.impressoes || 0,
        vendas: data.vendas || 0,
        ctr: data.ctr || 0,
        cpc: data.cpc || 0,
        cpm: data.cpm || 0,
        initiateCheckout: data.initiateCheckout || 0,
        taxaConversao: data.taxaConversao || 0,
      }

      // Usar a função updateProductData do lib/data.ts
      const success = await updateProductData(product.id, date, completeData)

      if (success) {
        console.log("Dados atualizados com sucesso para a data:", date)

        // Atualizar o produto localmente para refletir as mudanças imediatamente
        setProduct((prev) => {
          if (!prev) return null

          const updatedProduct = { ...prev }
          const existingIndex = updatedProduct.dados.findIndex((item) => item.data === date)

          if (existingIndex >= 0) {
            updatedProduct.dados[existingIndex] = completeData
          } else {
            updatedProduct.dados.push(completeData)
          }

          return updatedProduct
        })

        // Atualizar o cache
        if (isDataCached && dataCache[productId]) {
          setDataCache((prev) => {
            const updatedCache = { ...prev }
            const updatedProduct = { ...updatedCache[productId].product }

            const existingIndex = updatedProduct.dados.findIndex((item) => item.data === date)
            if (existingIndex >= 0) {
              updatedProduct.dados[existingIndex] = completeData
            } else {
              updatedProduct.dados.push(completeData)
            }

            updatedCache[productId] = {
              ...updatedCache[productId],
              product: updatedProduct,
              timestamp: Date.now(),
            }

            return updatedCache
          })
        }

        return true
      } else {
        console.error("Falha ao atualizar dados para a data:", date)
        return false
      }
    } catch (error) {
      console.error("Erro ao atualizar dados:", error)
      return false
    }
  }

  // Função para atualizar o nome do produto
  const updateProductName = async () => {
    if (!product || editedName.trim() === product.nome || isSavingName) return

    setIsSavingName(true)
    try {
      const { error } = await supabase.from("products").update({ name: editedName.trim() }).eq("id", product.id)

      if (error) {
        throw error
      }

      // Atualizar o produto localmente
      setProduct((prev) => ({
        ...prev,
        nome: editedName.trim(),
      }))

      // Atualizar o cache
      if (isDataCached && dataCache[productId]) {
        setDataCache((prev) => {
          const updatedCache = { ...prev }
          updatedCache[productId] = {
            ...updatedCache[productId],
            product: {
              ...updatedCache[productId].product,
              nome: editedName.trim(),
            },
            timestamp: Date.now(),
          }
          return updatedCache
        })
      }

      toast({
        title: "Nome atualizado",
        description: "O nome do produto foi atualizado com sucesso.",
      })
    } catch (error) {
      console.error("Erro ao atualizar nome:", error)
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o nome do produto.",
        variant: "destructive",
      })
      // Restaurar o nome original
      setEditedName(product.nome)
    } finally {
      setIsSavingName(false)
      setIsEditingName(false)
    }
  }

  // Função para abrir o modal de configuração de produto físico
  const openProductConfigModal = () => {
    // Inicializar o estado temporário com os valores atuais
    setTempProductCosts({
      frete: { ...physicalProductCosts.frete },
      producao: { ...physicalProductCosts.producao },
    })
    setIsProductConfigModalOpen(true)
  }

  // Função para salvar as configurações do modal
  const saveProductConfig = () => {
    // Atualizar o estado principal com os valores temporários
    setPhysicalProductCosts(tempProductCosts)
    setIsProductConfigModalOpen(false)

    // Salvar as configurações imediatamente
    setTimeout(() => {
      try {
        // Preparar a configuração para salvar
        const productConfig = {
          isPhysical: isPhysicalProduct,
          physicalCosts: tempProductCosts, // Usar os valores temporários que acabamos de definir
          updatedAt: new Date().toISOString(),
        }

        // Salvar no localStorage
        localStorage.setItem(`product_config_${product.id}`, JSON.stringify(productConfig))
        console.log("Configurações salvas do modal:", productConfig)

        // Atualizar o tipo de produto e recalcular estatísticas
        updateProductType()
      } catch (error) {
        console.error("Erro ao salvar configurações do modal:", error)
        toast({
          title: "Erro",
          description: "Não foi possível salvar as configurações. Tente novamente.",
          variant: "destructive",
        })
      }
    }, 100)
  }

  // Função para atualizar o tipo de produto e custos adicionais
  const updateProductType = async () => {
    if (!product || isSavingProductType) return

    setIsSavingProductType(true)
    try {
      // Preparar a configuração para salvar
      const productConfig = {
        isPhysical: isPhysicalProduct,
        physicalCosts: physicalProductCosts,
        updatedAt: new Date().toISOString(),
      }

      // Salvar no localStorage
      localStorage.setItem(`product_config_${product.id}`, JSON.stringify(productConfig))
      console.log("Configurações salvas no localStorage:", productConfig)

      // Atualizar o cache
      if (isDataCached && dataCache[productId]) {
        setDataCache((prev) => {
          const updatedCache = { ...prev }
          updatedCache[productId] = {
            ...updatedCache[productId],
            isPhysicalProduct,
            physicalProductCosts,
            timestamp: Date.now(),
          }
          return updatedCache
        })
      }

      // Tentar salvar no banco de dados (opcional, pode ser implementado no futuro)
      // Por enquanto, apenas simulamos o sucesso

      toast({
        title: "Configuração atualizada",
        description: "As configurações do produto foram atualizadas com sucesso.",
      })

      // Recalcular estatísticas para refletir as mudanças
      calculateStats(product)
      performAdvancedAnalysis(product)
    } catch (error) {
      console.error("Erro ao atualizar configuração do produto:", error)
      toast({
        title: "Erro",
        description: "Não foi possível atualizar as configurações do produto.",
        variant: "destructive",
      })
    } finally {
      setIsSavingProductType(false)
    }
  }

  // Adicione este useEffect após os outros useEffects
  useEffect(() => {
    // Sincronizar configurações do produto físico quando o componente montar
    if (product) {
      try {
        const savedConfig = localStorage.getItem(`product_config_${product.id}`)
        if (savedConfig) {
          const config = JSON.parse(savedConfig)
          setIsPhysicalProduct(config.isPhysical)
          setPhysicalProductCosts(
            config.physicalCosts || {
              frete: { valor: 0, tipo: "fixo" },
              producao: { valor: 0, tipo: "fixo" },
            },
          )

          // Recalcular estatísticas com as configurações carregadas
          setTimeout(() => {
            calculateStats(product)
            performAdvancedAnalysis(product)
          }, 100)

          console.log("Configurações sincronizadas do localStorage:", config)
        }
      } catch (e) {
        console.error("Erro ao sincronizar configurações:", e)
      }
    }
  }, [product])

  // Função para recarregar o produto
  const reloadProduct = async () => {
    // Verificar se a sessão ainda é válida antes de recarregar
    const sessionValid = await refreshSession()
    if (sessionValid) {
      setLoadAttempted(false) // Permite uma nova tentativa de carregamento
      await loadProduct(true)
      return true
    } else {
      toast({
        title: "Sessão expirada",
        description: "Sua sessão expirou. Por favor, faça login novamente.",
        variant: "destructive",
      })
      router.push("/")
      return false
    }
  }

  // Função para exportar dados para CSV
  const exportToCSV = () => {
    if (!product || !product.dados || product.dados.length === 0) {
      toast({
        title: "Sem dados para exportar",
        description: "Não há dados disponíveis para exportação.",
        variant: "destructive",
      })
      return
    }

    try {
      // Cabeçalho do CSV
      const headers = [
        "Data",
        "Investimento",
        "Faturamento",
        "Lucro",
        "ROI",
        "Visitas",
        "Cliques",
        "Impressões",
        "Vendas",
        "CTR",
        "CPC",
        "CPM",
        "Checkouts Iniciados",
        "Taxa de Conversão",
      ]

      // Converter dados para linhas CSV
      const rows = product.dados.map((item) => [
        item.data,
        item.investimento.toString().replace(".", ","),
        item.faturamento.toString().replace(".", ","),
        item.lucro.toString().replace(".", ","),
        item.roi.toString().replace(".", ","),
        item.visitas.toString(),
        item.cliques.toString(),
        item.impressoes.toString(),
        item.vendas.toString(),
        item.ctr.toString().replace(".", ","),
        item.cpc.toString().replace(".", ","),
        item.cpm.toString().replace(".", ","),
        item.initiateCheckout.toString(),
        item.taxaConversao.toString().replace(".", ","),
      ])

      // Montar o conteúdo CSV
      const csvContent = [headers.join(";"), ...rows.map((row) => row.join(";"))].join("\n")

      // Criar blob e link para download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `${product.nome.replace(/\s+/g, "_")}_dados.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Exportação concluída",
        description: "Os dados foram exportados com sucesso.",
      })
    } catch (error) {
      console.error("Erro ao exportar dados:", error)
      toast({
        title: "Erro na exportação",
        description: "Ocorreu um erro ao exportar os dados.",
        variant: "destructive",
      })
    }
  }

  // Renderização condicional para estados de carregamento e erro
  if (!sessionChecked) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando sessão...</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 w-full max-w-md px-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando produto...</p>
          <Progress value={loadingProgress} className="w-full h-2" />
          <p className="text-xs text-muted-foreground">{loadingProgress.toFixed(0)}%</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
          <div className="container flex h-16 items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Image
                  src="https://lotuzpay.com/wp-content/webp-express/webp-images/uploads/2024/09/Logo-Logomarca-LotuzPay-Png-Colorful.png.webp"
                  alt="Lotuz Analytics"
                  width={120}
                  height={40}
                  className="h-8 w-auto"
                />
              </Link>
              <h1 className="text-xl font-semibold">Analytics</h1>
            </div>
            <MainNav />
          </div>
        </header>
        <main className="flex-1">
          <div className="container py-6">
            <div className="mb-6">
              <Link
                href="/dashboard"
                className="mb-4 flex items-center text-sm font-medium text-muted-foreground hover:underline"
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Voltar para o Dashboard
              </Link>
            </div>

            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <h3 className="mb-2 text-xl font-semibold text-red-500">Erro ao carregar produto</h3>
              <p className="mb-4 text-muted-foreground">{error}</p>
              <Button onClick={reloadProduct}>Tentar novamente</Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
          <div className="container flex h-16 items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Image
                  src="https://lotuzpay.com/wp-content/webp-express/webp-images/uploads/2024/09/Logo-Logomarca-LotuzPay-Png-Colorful.png.webp"
                  alt="Lotuz Analytics"
                  width={120}
                  height={40}
                  className="h-8 w-auto"
                />
              </Link>
              <h1 className="text-xl font-semibold">Analytics</h1>
            </div>
            <MainNav />
          </div>
        </header>
        <main className="flex-1">
          <div className="container py-6">
            <div className="mb-6">
              <Link
                href="/dashboard"
                className="mb-4 flex items-center text-sm font-medium text-muted-foreground hover:underline"
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Voltar para o Dashboard
              </Link>
            </div>

            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <h3 className="mb-2 text-xl font-semibold">Produto não encontrado</h3>
              <p className="mb-4 text-muted-foreground">
                O produto que você está procurando não existe ou foi removido.
              </p>
              <Button asChild>
                <Link href="/dashboard">Voltar para o Dashboard</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Períodos disponíveis para filtro rápido
  const periodOptions = [
    { value: "today", label: "Hoje" },
    { value: "yesterday", label: "Ontem" },
    { value: "week", label: "7 dias" },
    { value: "month", label: "Mês atual" },
    { value: "last30", label: "Últimos 30 dias" },
    { value: "last90", label: "Últimos 90 dias" },
    { value: "all", label: "Todos" },
    { value: "custom", label: "Personalizado" },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between py-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/dashboard">
              <Image
                src="https://lotuzpay.com/wp-content/webp-express/webp-images/uploads/2024/09/Logo-Logomarca-LotuzPay-Png-Colorful.png.webp"
                alt="Lotuz Analytics"
                width={120}
                height={40}
                className="h-6 w-auto sm:h-8"
              />
            </Link>
            <h1 className="text-base sm:text-xl font-semibold">Analytics</h1>
          </div>
          <MainNav />
        </div>
      </header>
      <main className="flex-1">
        <div className="container py-4 sm:py-6">
          <div className="mb-4 sm:mb-6">
            <Link
              href="/dashboard"
              className="mb-2 sm:mb-4 flex items-center text-xs sm:text-sm font-medium text-muted-foreground hover:underline"
            >
              <ArrowLeft className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
              Voltar para o Dashboard
            </Link>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 sm:h-16 sm:w-16 overflow-hidden rounded-md">
                  <img
                    src={product.imagem || "/placeholder.svg?height=200&width=200"}
                    alt={product.nome}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-col">
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="h-8 text-xl font-bold"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={updateProductName}
                        disabled={isSavingName || !editedName.trim()}
                      >
                        {isSavingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </Button>
                    </div>
                  ) : (
                    <h2 className="text-xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                      {product.nome}
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setIsEditingName(true)}>
                        <Edit className="h-3.5 w-3.5" />
                        <span className="sr-only">Editar nome</span>
                      </Button>
                    </h2>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Criado em: {new Date(product.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={reloadProduct} className="text-xs sm:text-sm">
                  <RefreshCw className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Atualizar</span>
                </Button>
                <Button variant="outline" onClick={exportToCSV} className="text-xs sm:text-sm">
                  <Download className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Exportar</span>
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setIsDeleteModalOpen(true)}
                  disabled={isDeleting}
                  className="text-xs sm:text-sm"
                >
                  {isDeleting ? "Excluindo..." : "Excluir"}
                </Button>
              </div>
            </div>
          </div>

          {/* Configuração de produto físico */}
          <div className="mb-4 sm:mb-6 p-4 border rounded-lg bg-muted/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-medium">Tipo de Produto</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="product-type"
                    checked={isPhysicalProduct}
                    onCheckedChange={(checked) => {
                      setIsPhysicalProduct(checked)
                      // Atualizar automaticamente após a mudança
                      setTimeout(() => updateProductType(), 100)
                      // Se ativou o produto físico, abrir o modal de configuração
                      if (checked) {
                        setTimeout(() => openProductConfigModal(), 200)
                      }
                    }}
                  />
                  <Label htmlFor="product-type" className="text-sm">
                    {isPhysicalProduct ? "Produto Físico" : "Produto Digital"}
                  </Label>
                </div>
              </div>
            </div>

            {isPhysicalProduct && (
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Custos de produto físico configurados</span>
                  {stats.custosFisicos > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {formatCurrency(stats.custosFisicos)}
                    </Badge>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={openProductConfigModal}>
                  Configurar Custos
                </Button>
              </div>
            )}
          </div>

          {/* Filtro de período */}
          <div className="mb-4 sm:mb-6 flex flex-wrap items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-2">
              <Label htmlFor="period-select" className="text-xs sm:text-sm whitespace-nowrap">
                Período:
              </Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger id="period-select" className="h-8 w-[120px] sm:w-[150px] text-xs sm:text-sm">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-xs sm:text-sm">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPeriod === "custom" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1 text-xs sm:text-sm">
                    <Calendar className="h-3.5 w-3.5" />
                    {selectedDateRange.from && selectedDateRange.to ? (
                      <span>
                        {selectedDateRange.from.toLocaleDateString("pt-BR")} -{" "}
                        {selectedDateRange.to.toLocaleDateString("pt-BR")}
                      </span>
                    ) : (
                      <span>Selecionar datas</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="range"
                    selected={selectedDateRange}
                    onSelect={(range) => {
                      setSelectedDateRange(range)
                      if (range.from && range.to) {
                        setDateRange({
                          from: range.from,
                          to: range.to,
                        })
                      }
                    }}
                    numberOfMonths={window.innerWidth < 768 ? 1 : 2}
                  />
                </PopoverContent>
              </Popover>
            )}

            {dateRange && (
              <Badge variant="outline" className="text-xs">
                {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
              </Badge>
            )}
          </div>

          {/* Cards de métricas */}
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card className="overflow-hidden">
              <CardHeader className="pb-2 px-3 sm:px-4">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                  Investimento
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3">
                <div className="text-base sm:text-xl font-bold">{formatCurrency(stats.investimento)}</div>
                {trendData.investimento.trend !== "stable" && (
                  <div className="mt-1 flex items-center text-xs">
                    {trendData.investimento.trend === "up" ? (
                      <TrendingUp className="mr-1 h-3 w-3 text-success" />
                    ) : (
                      <TrendingDown className="mr-1 h-3 w-3 text-destructive" />
                    )}
                    <span className={trendData.investimento.trend === "up" ? "text-success" : "text-destructive"}>
                      {Math.abs(trendData.investimento.value).toFixed(1)}%
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="pb-2 px-3 sm:px-4">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <ShoppingCart className="h-3.5 w-3.5 text-primary" />
                  Faturamento
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3">
                <div className="text-base sm:text-xl font-bold">{formatCurrency(stats.faturamento)}</div>
                {trendData.faturamento.trend !== "stable" && (
                  <div className="mt-1 flex items-center text-xs">
                    {trendData.faturamento.trend === "up" ? (
                      <TrendingUp className="mr-1 h-3 w-3 text-success" />
                    ) : (
                      <TrendingDown className="mr-1 h-3 w-3 text-destructive" />
                    )}
                    <span className={trendData.faturamento.trend === "up" ? "text-success" : "text-destructive"}>
                      {Math.abs(trendData.faturamento.value).toFixed(1)}%
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="pb-2 px-3 sm:px-4">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <BarChart className="h-3.5 w-3.5 text-primary" />
                  Lucro
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3">
                <div
                  className={`text-base sm:text-xl font-bold ${stats.lucro >= 0 ? "text-success" : "text-destructive"}`}
                >
                  {formatCurrency(stats.lucro)}
                </div>
                {trendData.lucro.trend !== "stable" && (
                  <div className="mt-1 flex items-center text-xs">
                    {trendData.lucro.trend === "up" ? (
                      <TrendingUp className="mr-1 h-3 w-3 text-success" />
                    ) : (
                      <TrendingDown className="mr-1 h-3 w-3 text-destructive" />
                    )}
                    <span className={trendData.lucro.trend === "up" ? "text-success" : "text-destructive"}>
                      {Math.abs(trendData.lucro.value).toFixed(1)}%
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="pb-2 px-3 sm:px-4">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Percent className="h-3.5 w-3.5 text-primary" />
                  ROI
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3">
                <div
                  className={`text-base sm:text-xl font-bold ${stats.roi >= 100 ? "text-success" : stats.roi >= 0 ? "" : "text-destructive"}`}
                >
                  {stats.roi.toFixed(2)}%
                </div>
                {trendData.roi.trend !== "stable" && (
                  <div className="mt-1 flex items-center text-xs">
                    {trendData.roi.trend === "up" ? (
                      <TrendingUp className="mr-1 h-3 w-3 text-success" />
                    ) : (
                      <TrendingDown className="mr-1 h-3 w-3 text-destructive" />
                    )}
                    <span className={trendData.roi.trend === "up" ? "text-success" : "text-destructive"}>
                      {Math.abs(trendData.roi.value).toFixed(1)} pts
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="pb-2 px-3 sm:px-4">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  Visitas
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3">
                <div className="text-base sm:text-xl font-bold">{stats.visitas.toLocaleString("pt-BR")}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {stats.taxaConversao > 0 && `${stats.taxaConversao.toFixed(2)}% de conversão`}
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="pb-2 px-3 sm:px-4">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <ShoppingCart className="h-3.5 w-3.5 text-primary" />
                  Vendas
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3">
                <div className="text-base sm:text-xl font-bold">{stats.vendas.toLocaleString("pt-BR")}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {stats.vendas > 0 &&
                    stats.faturamento > 0 &&
                    `${formatCurrency(stats.faturamento / stats.vendas)} por venda`}
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="pb-2 px-3 sm:px-4">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Target className="h-3.5 w-3.5 text-primary" />
                  CTR
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3">
                <div className="text-base sm:text-xl font-bold">{stats.ctr.toFixed(2)}%</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {stats.impressoes > 0 && `${stats.impressoes.toLocaleString("pt-BR")} impressões`}
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="pb-2 px-3 sm:px-4">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  CPC
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3">
                <div className="text-base sm:text-xl font-bold">{formatCurrency(stats.cpc)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {stats.cliques > 0 && `${stats.cliques.toLocaleString("pt-BR")} cliques`}
                </div>
              </CardContent>
            </Card>
            {isPhysicalProduct && (
              <Card className="overflow-hidden">
                <CardHeader className="pb-2 px-3 sm:px-4">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Package className="h-3.5 w-3.5 text-primary" />
                    Custos Físicos
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-4 pb-3">
                  <div className="text-base sm:text-xl font-bold">{formatCurrency(stats.custosFisicos)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {stats.faturamento > 0 &&
                      `${((stats.custosFisicos / stats.faturamento) * 100).toFixed(1)}% do faturamento`}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="mb-8">
            <TabsList className="mb-4">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">
                Visão Geral
              </TabsTrigger>
              <TabsTrigger value="data" className="text-xs sm:text-sm">
                Dados Diários
              </TabsTrigger>
              <TabsTrigger value="analysis" className="text-xs sm:text-sm">
                Análise
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-medium">Resumo do Desempenho</CardTitle>
                  <CardDescription>Visão geral das principais métricas do produto</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Gráfico de desempenho */}
                    <div>
                      <h3 className="text-sm font-medium mb-3">Evolução de Desempenho</h3>
                      <div className="rounded-lg border p-4">
                        <div className="h-[300px]">
                          {advancedAnalysis.chartData.performance && (
                            <Line
                              data={advancedAnalysis.chartData.performance}
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: {
                                    position: "top",
                                    labels: {
                                      usePointStyle: true,
                                      boxWidth: 6,
                                    },
                                  },
                                  tooltip: {
                                    mode: "index",
                                    intersect: false,
                                    backgroundColor: "rgba(0, 0, 0, 0.8)",
                                    titleFont: {
                                      size: 12,
                                    },
                                    bodyFont: {
                                      size: 11,
                                    },
                                    padding: 10,
                                    cornerRadius: 4,
                                    callbacks: {
                                      label: (context) => {
                                        let label = context.dataset.label || ""
                                        if (label) {
                                          label += ": "
                                        }
                                        if (context.parsed.y !== null) {
                                          label += formatCurrency(context.parsed.y)
                                        }
                                        return label
                                      },
                                    },
                                  },
                                },
                                scales: {
                                  x: {
                                    grid: {
                                      display: false,
                                      drawBorder: false,
                                    },
                                    ticks: {
                                      font: {
                                        size: 10,
                                      },
                                      padding: 8,
                                    },
                                    border: {
                                      dash: [4, 4],
                                    },
                                  },
                                  y: {
                                    beginAtZero: true,
                                    grid: {
                                      color: "rgba(0, 0, 0, 0.05)",
                                      drawBorder: false,
                                    },
                                    ticks: {
                                      callback: (value) => formatCurrency(value),
                                      font: {
                                        size: 10,
                                      },
                                      padding: 8,
                                    },
                                    border: {
                                      dash: [4, 4],
                                    },
                                  },
                                },
                                elements: {
                                  line: {
                                    tension: 0.4,
                                  },
                                  point: {
                                    radius: 2,
                                    hoverRadius: 4,
                                  },
                                },
                                animation: {
                                  duration: 1000,
                                  easing: "easeOutQuart",
                                },
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Métricas principais */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-sm font-medium mb-3">Métricas Principais</h3>
                        <div className="rounded-lg border p-4 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">ROI Atual</p>
                              <p className={`text-lg font-medium ${stats.roi >= 100 ? "text-success" : ""}`}>
                                {stats.roi.toFixed(2)}%
                              </p>
                              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${stats.roi >= 100 ? "bg-success" : "bg-primary"}`}
                                  style={{ width: `${Math.min(stats.roi, 200)}%` }}
                                ></div>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Margem de Lucro</p>
                              <p className="text-lg font-medium">
                                {stats.faturamento > 0 ? ((stats.lucro / stats.faturamento) * 100).toFixed(2) : "0.00"}%
                              </p>
                              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary"
                                  style={{
                                    width: `${
                                      stats.faturamento > 0
                                        ? Math.min(Math.max((stats.lucro / stats.faturamento) * 100, 0), 100)
                                        : 0
                                    }%`,
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t">
                            <div className="flex justify-between mb-1">
                              <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
                              <p className="text-xs font-medium">{stats.taxaConversao.toFixed(2)}%</p>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500"
                                style={{ width: `${Math.min(stats.taxaConversao * 5, 100)}%` }}
                              ></div>
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between mb-1">
                              <p className="text-xs text-muted-foreground">Valor Médio por Venda</p>
                              <p className="text-xs font-medium">
                                {stats.vendas > 0
                                  ? formatCurrency(stats.faturamento / stats.vendas)
                                  : formatCurrency(0)}
                              </p>
                            </div>
                          </div>

                          {isPhysicalProduct && (
                            <div className="pt-2 border-t">
                              <div className="flex justify-between mb-1">
                                <p className="text-xs text-muted-foreground">Custos Físicos</p>
                                <p className="text-xs font-medium">{formatCurrency(stats.custosFisicos)}</p>
                              </div>
                              <div className="flex justify-between">
                                <p className="text-xs text-muted-foreground">% do Faturamento</p>
                                <p className="text-xs font-medium">
                                  {stats.faturamento > 0
                                    ? `${((stats.custosFisicos / stats.faturamento) * 100).toFixed(2)}%`
                                    : "0.00%"}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium mb-3">Recomendações</h3>
                        <div className="rounded-lg border p-4 h-full">
                          <ul className="space-y-3">
                            {advancedAnalysis.recommendations.map((recommendation, index) => (
                              <li key={index} className="flex items-start gap-2 text-sm">
                                <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                                  <Lightbulb className="h-3 w-3 text-primary" />
                                </div>
                                <span>{recommendation}</span>
                              </li>
                            ))}

                            {advancedAnalysis.recommendations.length === 0 && (
                              <li className="flex items-start gap-2 text-sm">
                                <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                                  <Info className="h-3 w-3 text-primary" />
                                </div>
                                <span>Adicione mais dados para receber recomendações personalizadas.</span>
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Funil de Conversão Simplificado */}
                    <div>
                      <h3 className="text-sm font-medium mb-3">Funil de Conversão</h3>
                      <div className="rounded-lg border p-4">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="flex flex-col items-center">
                            <div className="w-full h-24 bg-blue-100 dark:bg-blue-950/30 rounded-t-lg flex items-center justify-center">
                              <span className="text-lg font-bold">{stats.visitas.toLocaleString("pt-BR")}</span>
                            </div>
                            <div className="w-full bg-blue-500 py-1 text-center text-white text-xs rounded-b-lg">
                              Visitas
                            </div>
                          </div>

                          <div className="flex flex-col items-center">
                            <div className="w-full h-24 bg-yellow-100 dark:bg-yellow-950/30 rounded-t-lg flex items-center justify-center">
                              <span className="text-lg font-bold">
                                {stats.initiateCheckout.toLocaleString("pt-BR")}
                              </span>
                            </div>
                            <div className="w-full bg-yellow-500 py-1 text-center text-white text-xs rounded-b-lg">
                              Checkouts
                            </div>
                          </div>

                          <div className="flex flex-col items-center">
                            <div className="w-full h-24 bg-green-100 dark:bg-green-950/30 rounded-t-lg flex items-center justify-center">
                              <span className="text-lg font-bold">{stats.vendas.toLocaleString("pt-BR")}</span>
                            </div>
                            <div className="w-full bg-green-500 py-1 text-center text-white text-xs rounded-b-lg">
                              Vendas
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-4">
                          <div className="text-center p-2 bg-muted/20 rounded-lg">
                            <p className="text-xs text-muted-foreground">Visitas → Vendas</p>
                            <p className="text-lg font-medium">{stats.taxaConversao.toFixed(2)}%</p>
                          </div>
                          <div className="text-center p-2 bg-muted/20 rounded-lg">
                            <p className="text-xs text-muted-foreground">Checkout → Vendas</p>
                            <p className="text-lg font-medium">
                              {stats.initiateCheckout > 0
                                ? ((stats.vendas / stats.initiateCheckout) * 100).toFixed(2)
                                : "0.00"}
                              %
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="data">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="month-select" className="text-xs sm:text-sm whitespace-nowrap">
                    Mês:
                  </Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger id="month-select" className="h-8 w-[180px] text-xs sm:text-sm">
                      <SelectValue placeholder="Selecione um mês" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMonths.map((month) => (
                        <SelectItem key={month.value} value={month.value} className="text-xs sm:text-sm">
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedMonth && (
                <ProductDataTable
                  product={product}
                  monthKey={selectedMonth}
                  onDataUpdate={updateDayField}
                  showChart={false}
                />
              )}
            </TabsContent>

            <TabsContent value="analysis" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-yellow-500" />
                    Análise Completa de Desempenho
                  </CardTitle>
                  <CardDescription>
                    Análise detalhada do desempenho do seu produto com insights e recomendações personalizadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {advancedAnalysis.bestDay ? (
                    <div className="space-y-8">
                      {/* Resumo do melhor e pior dia */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="rounded-lg border bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 p-4">
                          <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            Melhor Dia
                          </h3>
                          <p className="text-sm mb-3">
                            {format(parseISO(advancedAnalysis.bestDay.data), "dd 'de' MMMM 'de' yyyy", {
                              locale: ptBR,
                            })}
                          </p>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Faturamento</p>
                              <p className="text-base font-medium">
                                {formatCurrency(advancedAnalysis.bestDay.faturamento)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Lucro</p>
                              <p className="text-base font-medium text-success">
                                {formatCurrency(advancedAnalysis.bestDay.lucro)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">ROI</p>
                              <p className="text-base font-medium text-success">
                                {advancedAnalysis.bestDay.roi.toFixed(2)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Vendas</p>
                              <p className="text-base font-medium">{advancedAnalysis.bestDay.vendas || 0}</p>
                            </div>
                          </div>
                        </div>

                        {advancedAnalysis.worstDay && advancedAnalysis.worstDay.lucro < 0 && (
                          <div className="rounded-lg border bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 p-4">
                            <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-red-500" />
                              Dia com Pior Desempenho
                            </h3>
                            <p className="text-sm mb-3">
                              {format(parseISO(advancedAnalysis.worstDay.data), "dd 'de' MMMM 'de' yyyy", {
                                locale: ptBR,
                              })}
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Faturamento</p>
                                <p className="text-base font-medium">
                                  {formatCurrency(advancedAnalysis.worstDay.faturamento)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Lucro</p>
                                <p className="text-base font-medium text-destructive">
                                  {formatCurrency(advancedAnalysis.worstDay.lucro)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">ROI</p>
                                <p className="text-base font-medium text-destructive">
                                  {advancedAnalysis.worstDay.roi.toFixed(2)}%
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Investimento</p>
                                <p className="text-base font-medium">
                                  {formatCurrency(advancedAnalysis.worstDay.investimento)}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Gráficos de análise */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Gráfico de desempenho por dia da semana */}
                        <div>
                          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" />
                            Desempenho por Dia da Semana
                          </h3>
                          <div className="rounded-lg border p-4">
                            <div className="h-[300px]">
                              {advancedAnalysis.chartData.weekday && (
                                <Bar
                                  data={advancedAnalysis.chartData.weekday}
                                  options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                      legend: {
                                        position: "top",
                                        labels: {
                                          usePointStyle: true,
                                          boxWidth: 6,
                                          font: {
                                            size: 11,
                                          },
                                        },
                                      },
                                      tooltip: {
                                        backgroundColor: "rgba(0, 0, 0, 0.8)",
                                        titleFont: {
                                          size: 12,
                                        },
                                        bodyFont: {
                                          size: 11,
                                        },
                                        padding: 10,
                                        cornerRadius: 4,
                                        callbacks: {
                                          label: (context) => {
                                            let label = context.dataset.label || ""
                                            if (label) {
                                              label += ": "
                                            }
                                            if (context.parsed.y !== null) {
                                              label += formatCurrency(context.parsed.y)
                                            }
                                            return label
                                          },
                                        },
                                      },
                                    },
                                    scales: {
                                      y: {
                                        beginAtZero: true,
                                        grid: {
                                          display: true,
                                          color: "rgba(0, 0, 0, 0.05)",
                                        },
                                        ticks: {
                                          callback: (value) => formatCurrency(value),
                                          font: {
                                            size: 10,
                                          },
                                        },
                                      },
                                      x: {
                                        grid: {
                                          display: false,
                                        },
                                        ticks: {
                                          font: {
                                            size: 10,
                                          },
                                        },
                                      },
                                    },
                                    elements: {
                                      bar: {
                                        borderRadius: 4,
                                      },
                                    },
                                    animation: {
                                      duration: 1000,
                                      easing: "easeOutQuart",
                                    },
                                  }}
                                />
                              )}
                            </div>

                            <div className="mt-4 text-xs text-muted-foreground">
                              {advancedAnalysis.weekdayPerformance.length > 0 && (
                                <p>
                                  {advancedAnalysis.weekdayPerformance.sort((a, b) => b.lucro - a.lucro)[0].name} é o
                                  dia com melhor desempenho médio.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Gráfico de distribuição de custos */}
                        <div>
                          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <PieChart className="h-4 w-4 text-primary" />
                            Distribuição de Custos e Lucro
                          </h3>
                          <div className="rounded-lg border p-4">
                            <div className="h-[300px] flex items-center justify-center">
                              {advancedAnalysis.chartData.distribution && (
                                <Doughnut
                                  data={advancedAnalysis.chartData.distribution}
                                  options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                      legend: {
                                        position: "right",
                                        labels: {
                                          usePointStyle: true,
                                          boxWidth: 6,
                                          font: {
                                            size: 11,
                                          },
                                        },
                                      },
                                      tooltip: {
                                        backgroundColor: "rgba(0, 0, 0, 0.8)",
                                        titleFont: {
                                          size: 12,
                                        },
                                        bodyFont: {
                                          size: 11,
                                        },
                                        padding: 10,
                                        cornerRadius: 4,
                                        callbacks: {
                                          label: (context) => {
                                            let label = context.label || ""
                                            if (label) {
                                              label += ": "
                                            }
                                            if (context.parsed !== null) {
                                              label += formatCurrency(context.parsed)
                                            }
                                            return label
                                          },
                                        },
                                      },
                                    },
                                    cutout: "70%",
                                    animation: {
                                      animateRotate: true,
                                      animateScale: true,
                                      duration: 1000,
                                      easing: "easeOutQuart",
                                    },
                                  }}
                                />
                              )}
                            </div>

                            <div className="mt-4 text-xs text-muted-foreground">
                              <p>Margem de lucro: {advancedAnalysis.profitMargin.toFixed(2)}%</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Funil de conversão */}
                      <div>
                        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <LineChart className="h-4 w-4 text-primary" />
                          Funil de Conversão
                        </h3>
                        <div className="rounded-lg border p-4">
                          <div className="h-[250px]">
                            {advancedAnalysis.chartData.funnel && (
                              <Bar
                                data={advancedAnalysis.chartData.funnel}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  indexAxis: "y",
                                  plugins: {
                                    legend: {
                                      display: false,
                                    },
                                    tooltip: {
                                      backgroundColor: "rgba(0, 0, 0, 0.8)",
                                      titleFont: {
                                        size: 12,
                                      },
                                      bodyFont: {
                                        size: 11,
                                      },
                                      padding: 10,
                                      cornerRadius: 4,
                                      callbacks: {
                                        label: (context) => context.parsed.x.toLocaleString("pt-BR"),
                                      },
                                    },
                                  },
                                  scales: {
                                    x: {
                                      beginAtZero: true,
                                      grid: {
                                        display: true,
                                        color: "rgba(0, 0, 0, 0.05)",
                                      },
                                      ticks: {
                                        font: {
                                          size: 10,
                                        },
                                      },
                                    },
                                    y: {
                                      grid: {
                                        display: false,
                                      },
                                      ticks: {
                                        font: {
                                          size: 10,
                                        },
                                      },
                                    },
                                  },
                                  elements: {
                                    bar: {
                                      borderRadius: 4,
                                    },
                                  },
                                  animation: {
                                    duration: 1000,
                                    easing: "easeOutQuart",
                                  },
                                }}
                              />
                            )}
                          </div>

                          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="rounded-lg bg-muted/20 p-3">
                              <p className="text-xs text-muted-foreground">Visitas para Checkout</p>
                              <p className="text-lg font-medium">
                                {advancedAnalysis.conversionFunnel.taxaVisitasParaCheckout?.toFixed(2)}%
                              </p>
                            </div>
                            <div className="rounded-lg bg-muted/20 p-3">
                              <p className="text-xs text-muted-foreground">Checkout para Vendas</p>
                              <p className="text-lg font-medium">
                                {advancedAnalysis.conversionFunnel.taxaCheckoutParaVendas?.toFixed(2)}%
                              </p>
                            </div>
                            <div className="rounded-lg bg-muted/20 p-3">
                              <p className="text-xs text-muted-foreground">Visitas para Vendas</p>
                              <p className="text-lg font-medium">
                                {advancedAnalysis.conversionFunnel.taxaVisitasParaVendas?.toFixed(2)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Insights e recomendações */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <Lightbulb className="h-4 w-4 text-yellow-500" />
                            Insights
                          </h3>
                          <div className="rounded-lg border p-4">
                            <ul className="space-y-2">
                              {advancedAnalysis.insights.map((insight, index) => (
                                <li key={index} className="flex items-start gap-2 text-sm">
                                  <Zap className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                  <span>{insight}</span>
                                </li>
                              ))}

                              {advancedAnalysis.insights.length === 0 && (
                                <li className="flex items-start gap-2 text-sm">
                                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                  <span>Adicione mais dados para gerar insights.</span>
                                </li>
                              )}
                            </ul>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <Target className="h-4 w-4 text-primary" />
                            Métricas Importantes
                          </h3>
                          <div className="rounded-lg border p-4">
                            <div className="space-y-4">
                              <div>
                                <div className="flex justify-between mb-1">
                                  <span className="text-sm">Ponto de Equilíbrio</span>
                                  <span className="text-sm font-medium">
                                    {advancedAnalysis.breakEvenPoint.toFixed(1)} vendas
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Número de vendas necessárias para cobrir os custos
                                </p>
                              </div>

                              <div>
                                <div className="flex justify-between mb-1">
                                  <span className="text-sm">Projeção de Crescimento</span>
                                  <span
                                    className={`text-sm font-medium ${advancedAnalysis.projectedGrowth >= 0 ? "text-success" : "text-destructive"}`}
                                  >
                                    {advancedAnalysis.projectedGrowth >= 0 ? "+" : ""}
                                    {advancedAnalysis.projectedGrowth.toFixed(1)}%
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Baseado na tendência atual de desempenho
                                </p>
                              </div>

                              <div>
                                <div className="flex justify-between mb-1">
                                  <span className="text-sm">Margem de Lucro</span>
                                  <span className="text-sm font-medium">
                                    {advancedAnalysis.profitMargin.toFixed(2)}%
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Percentual do faturamento que se converte em lucro
                                </p>
                              </div>

                              <div>
                                <div className="flex justify-between mb-1">
                                  <span className="text-sm">Valor Médio por Venda</span>
                                  <span className="text-sm font-medium">
                                    {stats.vendas > 0
                                      ? formatCurrency(stats.faturamento / stats.vendas)
                                      : formatCurrency(0)}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">Valor médio de cada transação</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="rounded-full bg-muted p-3 mb-4">
                        <BarChart className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">Dados insuficientes</h3>
                      <p className="text-sm text-muted-foreground max-w-md">
                        Não há dados suficientes para realizar uma análise completa. Adicione mais dados diários para
                        obter insights sobre o desempenho do seu produto.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Modal de configuração de produto físico */}
      <Dialog open={isProductConfigModalOpen} onOpenChange={setIsProductConfigModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Custos de Produto Físico</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Custo de Produção</h3>
              <div className="space-y-2">
                <RadioGroup
                  value={tempProductCosts.producao.tipo}
                  onValueChange={(value) =>
                    setTempProductCosts((prev) => ({
                      ...prev,
                      producao: { ...prev.producao, tipo: value },
                    }))
                  }
                  className="flex items-center space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fixo" id="producao-fixo" />
                    <Label htmlFor="producao-fixo">Valor Fixo</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="percentual" id="producao-percentual" />
                    <Label htmlFor="producao-percentual">Percentual</Label>
                  </div>
                </RadioGroup>

                <div className="flex items-center space-x-2">
                  <Input
                    type="number"
                    min="0"
                    step={tempProductCosts.producao.tipo === "percentual" ? "0.1" : "0.01"}
                    value={tempProductCosts.producao.valor}
                    onChange={(e) =>
                      setTempProductCosts((prev) => ({
                        ...prev,
                        producao: { ...prev.producao, valor: Number.parseFloat(e.target.value) },
                      }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {tempProductCosts.producao.tipo === "percentual" ? "%" : "R$"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium">Custo de Frete</h3>
              <div className="space-y-2">
                <RadioGroup
                  value={tempProductCosts.frete.tipo}
                  onValueChange={(value) =>
                    setTempProductCosts((prev) => ({
                      ...prev,
                      frete: { ...prev.frete, tipo: value },
                    }))
                  }
                  className="flex items-center space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fixo" id="frete-fixo" />
                    <Label htmlFor="frete-fixo">Valor Fixo</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="percentual" id="frete-percentual" />
                    <Label htmlFor="frete-percentual">Percentual</Label>
                  </div>
                </RadioGroup>

                <div className="flex items-center space-x-2">
                  <Input
                    type="number"
                    min="0"
                    step={tempProductCosts.frete.tipo === "percentual" ? "0.1" : "0.01"}
                    value={tempProductCosts.frete.valor}
                    onChange={(e) =>
                      setTempProductCosts((prev) => ({
                        ...prev,
                        frete: { ...prev.frete, valor: Number.parseFloat(e.target.value) },
                      }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {tempProductCosts.frete.tipo === "percentual" ? "%" : "R$"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProductConfigModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveProductConfig}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de exclusão */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={async () => {
          setIsDeleting(true)
          try {
            // Verificar se a sessão ainda é válida
            const sessionValid = await refreshSession()
            if (!sessionValid) {
              toast({
                title: "Sessão expirada",
                description: "Sua sessão expirou. Por favor, faça login novamente.",
                variant: "destructive",
              })
              router.push("/")
              return
            }

            // Primeiro, exclui todos os dados relacionados ao produto
            const { error: dataError } = await supabase.from("product_data").delete().eq("product_id", product.id)

            if (dataError) {
              console.error("Erro ao excluir dados do produto:", dataError)
              throw dataError
            }

            // Em seguida, exclui o produto
            const { error } = await supabase.from("products").delete().eq("id", product.id)

            if (error) {
              console.error("Erro ao excluir produto:", error)
              throw error
            }

            toast({
              title: "Produto excluído",
              description: `${product.nome} foi excluído com sucesso.`,
            })
            router.push("/dashboard")
          } catch (error) {
            console.error("Erro ao excluir produto:", error)
            toast({
              title: "Erro",
              description: "Ocorreu um erro ao excluir o produto. Tente novamente.",
              variant: "destructive",
            })
          } finally {
            setIsDeleting(false)
            setIsDeleteModalOpen(false)
          }
        }}
        title="Excluir produto"
        description={`Tem certeza que deseja excluir o produto "${product.nome}"? Esta ação não pode ser desfeita.`}
        confirmText={isDeleting ? "Excluindo..." : "Excluir"}
        cancelText="Cancelar"
        variant="destructive"
      />
    </div>
  )
}
