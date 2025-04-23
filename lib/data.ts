import type { ProductDB, ProductDataDB } from "./supabase"
import { type DateRange, isDateInRange } from "./date-utils"
import { supabase } from "./supabaseClient"

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

// Obter todos os produtos do usuário atual
export async function getProducts(): Promise<Product[]> {
  try {
    // Verificar se há uma sessão ativa
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
      console.error("Erro ao verificar sessão:", sessionError)
      throw new Error(`Erro ao verificar sessão: ${sessionError.message}`)
    }

    if (!sessionData.session) {
      console.error("Nenhuma sessão ativa encontrada")
      return []
    }

    const userId = sessionData.session.user.id
    if (!userId) {
      console.error("ID do usuário não encontrado na sessão")
      return []
    }

    console.log("Buscando produtos para o usuário:", userId)

    // Busca todos os produtos do usuário atual
    const { data: products, error } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Erro ao buscar produtos:", error)
      throw new Error(`Erro ao buscar produtos: ${error.message}`)
    }

    console.log("Produtos encontrados:", products?.length || 0)

    if (!products || products.length === 0) {
      return []
    }

    // Para cada produto, busca seus dados diários
    const productsWithData = await Promise.all(
      products.map(async (product) => {
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

          return convertProductFromDB(product, productData || [])
        } catch (error) {
          console.error(`Erro ao processar produto ${product.id}:`, error)
          return convertProductFromDB(product)
        }
      }),
    )

    return productsWithData
  } catch (error) {
    console.error("Erro ao buscar produtos:", error)
    throw error // Propaga o erro para ser tratado pelo chamador
  }
}

// Obter um único produto por ID
export async function getProduct(id: string): Promise<Product | null> {
  const MAX_RETRIES = 3
  const RETRY_DELAY = 1000 // 1 segundo

  let retries = 0

  while (retries < MAX_RETRIES) {
    try {
      console.log(`Tentativa ${retries + 1} de buscar o produto com ID: ${id}`)

      // Verificar se há uma sessão ativa
      const { data: sessionData } = await supabase.auth.getSession()

      if (!sessionData.session) {
        console.error("Nenhuma sessão ativa encontrada")
        return null
      }

      // Busca o produto pelo ID
      const { data: product, error } = await supabase.from("products").select("*").eq("id", id).single()

      if (error) {
        console.error(`Erro ao buscar produto (tentativa ${retries + 1}):`, error)

        // Se for um erro de conexão, tenta novamente
        if (error.code === "PGRST301" || error.message.includes("Failed to fetch")) {
          retries++
          if (retries < MAX_RETRIES) {
            console.log(`Aguardando ${RETRY_DELAY}ms antes da próxima tentativa...`)
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * retries)) // Backoff exponencial
            continue
          }
        }

        return null
      }

      if (!product) {
        console.error("Produto não encontrado com ID:", id)
        return null
      }

      console.log("Produto encontrado:", product.name)

      // Busca os dados diários do produto
      const { data: productData, error: dataError } = await supabase
        .from("product_data")
        .select("*")
        .eq("product_id", id)

      if (dataError) {
        console.error(`Erro ao buscar dados do produto ${id}:`, dataError)
        // Retorna o produto mesmo sem dados
        return convertProductFromDB(product, [])
      }

      console.log(`Encontrados ${productData?.length || 0} registros de dados para o produto`)

      // Retorna o produto com os dados
      return convertProductFromDB(product, productData || [])
    } catch (error) {
      console.error(`Erro ao buscar produto (tentativa ${retries + 1}):`, error)

      // Incrementa o contador de tentativas
      retries++

      // Se ainda tiver tentativas, espera antes de tentar novamente
      if (retries < MAX_RETRIES) {
        console.log(`Aguardando ${RETRY_DELAY}ms antes da próxima tentativa...`)
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * retries)) // Backoff exponencial
      }
    }
  }

  console.error(`Falha após ${MAX_RETRIES} tentativas de buscar o produto.`)
  return null
}

// Função para salvar um novo produto
export async function saveProduct(product: { nome: string; imagem: string }): Promise<Product | null> {
  try {
    console.log("Iniciando saveProduct com:", product.nome)

    // 1. Verificar se há uma sessão ativa
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
      console.error("Erro ao verificar sessão:", sessionError)
      throw new Error(`Erro ao verificar sessão: ${sessionError.message}`)
    }

    if (!sessionData.session) {
      console.error("Nenhuma sessão ativa encontrada")
      throw new Error("Usuário não autenticado")
    }

    const userId = sessionData.session.user.id
    console.log("Usuário autenticado:", userId)

    // 2. Preparar dados para inserção
    const productData = {
      name: product.nome,
      image: product.imagem || "/placeholder.svg?height=200&width=200",
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    console.log("Dados preparados para inserção:", productData)

    // 3. Inserir o novo produto com timeout interno
    const insertPromise = new Promise<Product>((resolve, reject) => {
      supabase
        .from("products")
        .insert(productData)
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error("Erro ao inserir produto:", error)

            // Verificar se é um erro de RLS
            if (error.code === "42501" || error.message.includes("permission denied")) {
              reject(new Error("Você não tem permissão para adicionar produtos"))
            } else {
              reject(new Error(`Erro ao salvar produto: ${error.message}`))
            }
            return
          }

          if (!data) {
            console.error("Produto não foi criado: retorno nulo")
            reject(new Error("Produto não foi criado"))
            return
          }

          console.log("Produto salvo com sucesso:", data.id)

          // Converter para o formato da aplicação
          resolve({
            id: data.id,
            nome: data.name,
            imagem: data.image || "/placeholder.svg?height=200&width=200",
            dados: [],
            createdAt: data.created_at || new Date().toISOString(),
          })
        })
        .catch((err) => {
          console.error("Exceção ao inserir produto:", err)
          reject(err)
        })
    })

    // Definir um timeout interno para a operação
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Tempo limite excedido ao salvar produto no banco de dados"))
      }, 8000) // 8 segundos
    })

    // Usar Promise.race para implementar o timeout
    return await Promise.race([insertPromise, timeoutPromise])
  } catch (error) {
    console.error("Erro ao salvar produto:", error)
    throw error
  }
}

// Atualizar os dados de um produto existente
export async function updateProductData(productId: string, date: string, data: DailyData): Promise<boolean> {
  try {
    console.log("Iniciando updateProductData para produto:", productId, "data:", date)

    // Verificar se há uma sessão ativa
    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      console.error("Nenhuma sessão ativa encontrada")
      return false
    }

    // Certifique-se de que todos os valores são números
    const investment = Number.parseFloat(data.investimento.toString()) || 0
    const revenue = Number.parseFloat(data.faturamento.toString()) || 0
    const visits = Number.parseInt(data.visitas.toString()) || 0
    const clicks = Number.parseInt(data.cliques?.toString() || "0")
    const impressions = Number.parseInt(data.impressoes?.toString() || "0")
    const sales = Number.parseInt(data.vendas?.toString() || "0")
    const initiateCheckout = Number.parseInt(data.initiateCheckout?.toString() || "0")

    // Incluir todos os campos em uma única operação de upsert
    const baseData = {
      product_id: productId,
      date: date,
      investment: investment,
      revenue: revenue,
      visits: visits,
      clicks: clicks,
      impressions: impressions,
      sales: sales,
      initiate_checkout: initiateCheckout,
      // Não incluímos os campos calculados (profit, roi, cpa) pois são calculados pelo trigger
    }

    console.log("Dados preparados para upsert:", baseData)

    // Usar upsert para inserir ou atualizar em uma única operação
    const { data: result, error } = await supabase.from("product_data").upsert(baseData, {
      onConflict: "product_id,date",
      returning: "minimal", // Não precisamos dos dados de retorno
    })

    if (error) {
      console.error("Erro ao salvar dados do produto:", error)
      return false
    }

    console.log("Dados atualizados com sucesso no banco de dados")
    return true
  } catch (error) {
    console.error("Exceção ao atualizar dados do produto:", error)
    return false
  }
}

// Excluir um produto
export async function deleteProduct(productId: string): Promise<boolean> {
  try {
    // Verificar se há uma sessão ativa
    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      console.error("Nenhuma sessão ativa encontrada")
      return false
    }

    const userId = sessionData.session.user.id

    // Primeiro, exclui todos os dados relacionados ao produto
    const { error: dataError } = await supabase.from("product_data").delete().eq("product_id", productId)

    if (dataError) {
      console.error("Erro ao excluir dados do produto:", dataError)
      return false
    }

    // Em seguida, exclui o produto
    const { error } = await supabase.from("products").delete().eq("id", productId).eq("user_id", userId) // Garante que apenas o proprietário pode excluir

    if (error) {
      console.error("Erro ao excluir produto:", error)
      return false
    }

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
