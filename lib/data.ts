import type { ProductDB, ProductDataDB } from "./supabase"
import { type DateRange, isDateInRange } from "./date-utils"
import { supabase } from "./supabaseClient"
import { cache } from "./cache"

// Tipos
export type DailyData = {
  data: string // ISO date string: YYYY-MM-DD
  investimento: number
  faturamento: number
  lucro: number
  roi: number
  visitas: number
  cpa: number // Mantido porque existe no banco, mas não será exibido na UI
  initiateCheckout?: number // Novo campo para entrada manual
  cliques?: number
  impressoes?: number
  vendas?: number
  ctr?: number
  cpc?: number
  cpm?: number
}

export type Product = {
  id: string
  nome: string
  imagem: string
  dados: DailyData[]
  createdAt: string // ISO date string
}

// Função para converter um produto do formato do banco para o formato da aplicação
function convertProductFromDB(product: ProductDB, productData: ProductDataDB[] = []): Product {
  return {
    id: product.id,
    nome: product.name,
    imagem: product.image || "/placeholder.svg?height=200&width=200",
    dados: productData.map((data) => ({
      data: data.date,
      investimento: data.investment,
      faturamento: data.revenue,
      lucro: data.profit,
      roi: data.roi,
      visitas: data.visits,
      cpa: data.cpa,
      // Mapear os campos adicionais do banco de dados
      cliques: data.clicks || 0,
      impressoes: data.impressions || 0,
      vendas: data.sales || 0,
      initiateCheckout: data.initiate_checkout || 0,
      // Campos calculados
      ctr: data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0,
      cpc: data.clicks > 0 ? data.investment / data.clicks : 0,
      cpm: data.impressions > 0 ? (data.investment / data.impressions) * 1000 : 0,
    })),
    createdAt: product.created_at || new Date().toISOString(),
  }
}

// Função otimizada para obter o ID do usuário atual
async function getCurrentUserId(): Promise<string | null> {
  // Verificar primeiro no cache
  const cachedUserId = cache.get<string>("currentUserId")
  if (cachedUserId) {
    return cachedUserId
  }

  try {
    // Se não estiver no cache, buscar da sessão
    const { data } = await supabase.auth.getSession()
    const userId = data?.session?.user?.id || null

    // Armazenar no cache por 30 minutos
    if (userId) {
      cache.set("currentUserId", userId, 30 * 60 * 1000)
    }

    return userId
  } catch (error) {
    console.error("Erro ao obter ID do usuário:", error)
    return null
  }
}

// Obter todos os produtos do usuário atual - Otimizado com cache
export async function getProducts(): Promise<Product[]> {
  try {
    // Obter ID do usuário
    const userId = await getCurrentUserId()
    if (!userId) {
      console.error("Nenhum usuário autenticado")
      return []
    }

    // Verificar cache
    const cacheKey = `products_${userId}`
    const cachedProducts = cache.get<Product[]>(cacheKey)

    if (cachedProducts) {
      console.log("Usando produtos do cache")
      return cachedProducts
    }

    console.log("Buscando produtos para o usuário:", userId)

    // Buscar produtos do banco
    const { data: products, error } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Erro ao buscar produtos:", error)
      return []
    }

    console.log("Produtos encontrados:", products?.length || 0)

    if (!products || products.length === 0) {
      return []
    }

    // Buscar dados dos produtos em paralelo
    const productsWithData = await Promise.all(
      products.map(async (product) => {
        // Verificar cache para dados do produto
        const productCacheKey = `product_data_${product.id}`
        const cachedProductData = cache.get<ProductDataDB[]>(productCacheKey)

        if (cachedProductData) {
          return convertProductFromDB(product, cachedProductData)
        }

        try {
          const { data: productData, error: dataError } = await supabase
            .from("product_data")
            .select("*")
            .eq("product_id", product.id)
            .order("date", { ascending: false })

          if (dataError) {
            console.error(`Erro ao buscar dados do produto ${product.id}:`, dataError)
            return convertProductFromDB(product)
          }

          // Armazenar dados do produto no cache
          if (productData) {
            cache.set(productCacheKey, productData, 5 * 60 * 1000) // 5 minutos
          }

          return convertProductFromDB(product, productData || [])
        } catch (error) {
          console.error(`Erro ao processar produto ${product.id}:`, error)
          return convertProductFromDB(product)
        }
      }),
    )

    // Armazenar produtos completos no cache
    cache.set(cacheKey, productsWithData, 5 * 60 * 1000) // 5 minutos

    return productsWithData
  } catch (error) {
    console.error("Erro ao buscar produtos:", error)
    return []
  }
}

// Obter um único produto por ID - Otimizado com cache
export async function getProduct(id: string): Promise<Product | null> {
  try {
    // Verificar cache
    const cacheKey = `product_${id}`
    const cachedProduct = cache.get<Product>(cacheKey)

    if (cachedProduct) {
      console.log(`Usando produto ${id} do cache`)
      return cachedProduct
    }

    console.log(`Buscando produto com ID: ${id}`)

    // Verificar se o usuário está autenticado
    const userId = await getCurrentUserId()
    if (!userId) {
      console.error("Nenhum usuário autenticado")
      return null
    }

    // Buscar produto
    const { data: product, error } = await supabase.from("products").select("*").eq("id", id).single()

    if (error) {
      console.error(`Erro ao buscar produto:`, error)
      return null
    }

    if (!product) {
      console.error("Produto não encontrado com ID:", id)
      return null
    }

    console.log("Produto encontrado:", product.name)

    // Buscar dados do produto
    const { data: productData, error: dataError } = await supabase.from("product_data").select("*").eq("product_id", id)

    if (dataError) {
      console.error(`Erro ao buscar dados do produto ${id}:`, dataError)
      return convertProductFromDB(product, [])
    }

    console.log(`Encontrados ${productData?.length || 0} registros de dados para o produto`)

    // Converter e armazenar no cache
    const convertedProduct = convertProductFromDB(product, productData || [])
    cache.set(cacheKey, convertedProduct, 5 * 60 * 1000) // 5 minutos

    return convertedProduct
  } catch (error) {
    console.error(`Erro ao buscar produto:`, error)
    return null
  }
}

// Função para salvar um novo produto - Limpa o cache após salvar
export async function saveProduct(product: { nome: string; imagem: string }): Promise<Product | null> {
  try {
    console.log("Iniciando saveProduct com:", product.nome)

    // Obter ID do usuário
    const userId = await getCurrentUserId()
    if (!userId) {
      throw new Error("Usuário não autenticado")
    }

    // Preparar dados para inserção
    const productData = {
      name: product.nome,
      image: product.imagem || "/placeholder.svg?height=200&width=200",
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Inserir produto
    const { data, error } = await supabase.from("products").insert(productData).select().single()

    if (error) {
      console.error("Erro ao inserir produto:", error)
      throw new Error(`Erro ao salvar produto: ${error.message}`)
    }

    if (!data) {
      throw new Error("Produto não foi criado")
    }

    console.log("Produto salvo com sucesso:", data.id)

    // Limpar cache de produtos
    cache.clear(`products_${userId}`)

    // Converter para o formato da aplicação
    const newProduct = {
      id: data.id,
      nome: data.name,
      imagem: data.image || "/placeholder.svg?height=200&width=200",
      dados: [],
      createdAt: data.created_at || new Date().toISOString(),
    }

    return newProduct
  } catch (error) {
    console.error("Erro ao salvar produto:", error)
    throw error
  }
}

// Atualizar os dados de um produto existente - Limpa o cache após atualizar
export async function updateProductData(productId: string, date: string, data: DailyData): Promise<boolean> {
  try {
    console.log("Iniciando updateProductData para produto:", productId, "data:", date)

    // Verificar autenticação
    const userId = await getCurrentUserId()
    if (!userId) {
      return false
    }

    // Preparar dados
    const baseData = {
      product_id: productId,
      date: date,
      investment: Number.parseFloat(data.investimento.toString()) || 0,
      revenue: Number.parseFloat(data.faturamento.toString()) || 0,
      visits: Number.parseInt(data.visitas.toString()) || 0,
      clicks: Number.parseInt(data.cliques?.toString() || "0"),
      impressions: Number.parseInt(data.impressoes?.toString() || "0"),
      sales: Number.parseInt(data.vendas?.toString() || "0"),
      initiate_checkout: Number.parseInt(data.initiateCheckout?.toString() || "0"),
    }

    // Atualizar dados
    const { error } = await supabase.from("product_data").upsert(baseData, {
      onConflict: "product_id,date",
      returning: "minimal",
    })

    if (error) {
      console.error("Erro ao salvar dados do produto:", error)
      return false
    }

    // Limpar caches relacionados
    cache.clear(`products_${userId}`)
    cache.clear(`product_${productId}`)
    cache.clear(`product_data_${productId}`)

    console.log("Dados atualizados com sucesso")
    return true
  } catch (error) {
    console.error("Exceção ao atualizar dados do produto:", error)
    return false
  }
}

// Excluir um produto - Limpa o cache após excluir
export async function deleteProduct(productId: string): Promise<boolean> {
  try {
    // Verificar autenticação
    const userId = await getCurrentUserId()
    if (!userId) {
      return false
    }

    // Excluir dados do produto
    const { error: dataError } = await supabase.from("product_data").delete().eq("product_id", productId)

    if (dataError) {
      console.error("Erro ao excluir dados do produto:", dataError)
      return false
    }

    // Excluir produto
    const { error } = await supabase.from("products").delete().eq("id", productId).eq("user_id", userId)

    if (error) {
      console.error("Erro ao excluir produto:", error)
      return false
    }

    // Limpar caches relacionados
    cache.clear(`products_${userId}`)
    cache.clear(`product_${productId}`)
    cache.clear(`product_data_${productId}`)

    console.log("Produto excluído com sucesso:", productId)
    return true
  } catch (error) {
    console.error("Erro ao excluir produto:", error)
    return false
  }
}

// Obter produtos filtrados com base no intervalo de datas
export function getFilteredProducts(products: Product[], dateRange: DateRange | null): Product[] {
  if (!dateRange) return products

  return products.map((product) => {
    return {
      ...product,
      dados: product.dados.filter((entry) => isDateInRange(entry.data, dateRange)),
    }
  })
}

// Calcular estatísticas do produto
export function getProductStats(product: Product, dateRange: DateRange | null) {
  // Filtra os dados por intervalo de datas, se fornecido
  const filteredData = dateRange ? product.dados.filter((entry) => isDateInRange(entry.data, dateRange)) : product.dados

  // Calcula totais
  let investimento = 0
  let faturamento = 0

  filteredData.forEach((entry) => {
    investimento += entry.investimento || 0
    faturamento += entry.faturamento || 0
  })

  const lucro = faturamento - investimento
  const roi = investimento > 0 ? (lucro / investimento) * 100 : 0

  return {
    investimento,
    faturamento,
    lucro,
    roi,
  }
}
