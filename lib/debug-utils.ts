// Utilitários para ajudar na depuração de problemas com o Supabase

import { supabase } from "./supabaseClient"

// Verifica se o usuário está autenticado e retorna informações da sessão
export async function checkAuthStatus() {
  try {
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      console.error("Erro ao verificar sessão:", error)
      return {
        isAuthenticated: false,
        error: error.message,
        session: null,
        user: null,
      }
    }

    return {
      isAuthenticated: !!data.session,
      error: null,
      session: data.session,
      user: data.session?.user || null,
    }
  } catch (error) {
    console.error("Exceção ao verificar autenticação:", error)
    return {
      isAuthenticated: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
      session: null,
      user: null,
    }
  }
}

// Testa a conexão com o Supabase e as permissões
export async function testSupabaseConnection() {
  try {
    // Teste básico de conexão
    const { data: connectionTest, error: connectionError } = await supabase
      .from("products")
      .select("count(*)", { count: "exact", head: true })

    if (connectionError) {
      return {
        connected: false,
        error: connectionError.message,
        details: connectionError,
      }
    }

    // Verifica a sessão atual
    const authStatus = await checkAuthStatus()

    return {
      connected: true,
      authStatus,
      error: null,
    }
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
      details: error,
    }
  }
}

// Função para testar a inserção de um produto
export async function testProductInsert() {
  try {
    const authStatus = await checkAuthStatus()

    if (!authStatus.isAuthenticated) {
      return {
        success: false,
        error: "Usuário não autenticado",
        authStatus,
      }
    }

    const testProduct = {
      name: `Produto de Teste ${new Date().toISOString()}`,
      image: "/placeholder.svg?height=200&width=200",
      user_id: authStatus.user?.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase.from("products").insert(testProduct).select().single()

    if (error) {
      return {
        success: false,
        error: error.message,
        details: error,
        authStatus,
      }
    }

    return {
      success: true,
      product: data,
      authStatus,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
      details: error,
    }
  }
}
