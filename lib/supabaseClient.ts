import { createClient } from "@supabase/supabase-js"

// Garantir que as variáveis de ambiente estejam disponíveis
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("ERRO CRÍTICO: Variáveis de ambiente do Supabase não definidas!")
}

// Configuração simplificada para maior confiabilidade
export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // Desativado para evitar problemas com redirecionamentos
    storageKey: "lotuz_analytics_auth",
  },
})

// Função para testar a conexão com o Supabase
export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.from("profiles").select("count").limit(1)

    if (error) {
      console.error("Erro ao conectar ao Supabase:", error.message)
      return { success: false, error: error.message }
    }

    console.log("Conexão com Supabase estabelecida com sucesso")
    return { success: true }
  } catch (e) {
    console.error("Exceção ao testar conexão com Supabase:", e)
    return { success: false, error: String(e) }
  }
}
