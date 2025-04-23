import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

// Configurações mais robustas para persistência de sessão
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "lotuz_analytics_auth",
    storage: {
      getItem: (key) => {
        try {
          // Tenta primeiro o localStorage
          if (typeof window !== "undefined") {
            const value = localStorage.getItem(key)
            if (value) return value
          }

          // Fallback para cookies se localStorage não estiver disponível
          if (typeof document !== "undefined") {
            const cookies = document.cookie.split(";")
            for (const cookie of cookies) {
              const [cookieName, cookieValue] = cookie.split("=")
              if (cookieName.trim() === key) {
                return decodeURIComponent(cookieValue)
              }
            }
          }
          return null
        } catch (error) {
          console.error("Erro ao acessar storage:", error)
          return null
        }
      },
      setItem: (key, value) => {
        try {
          // Tenta primeiro o localStorage
          if (typeof window !== "undefined") {
            localStorage.setItem(key, value)
          }

          // Também salva como cookie para redundância
          if (typeof document !== "undefined") {
            // Cookie com validade de 30 dias
            const expiryDate = new Date()
            expiryDate.setDate(expiryDate.getDate() + 30)
            document.cookie = `${key}=${encodeURIComponent(value)};expires=${expiryDate.toUTCString()};path=/;SameSite=Strict`
          }
        } catch (error) {
          console.error("Erro ao definir storage:", error)
        }
      },
      removeItem: (key) => {
        try {
          // Remove do localStorage
          if (typeof window !== "undefined") {
            localStorage.removeItem(key)
          }

          // Remove o cookie
          if (typeof document !== "undefined") {
            document.cookie = `${key}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Strict`
          }
        } catch (error) {
          console.error("Erro ao remover storage:", error)
        }
      },
    },
    debug: process.env.NODE_ENV === "development", // Habilita logs detalhados em desenvolvimento
  },
  global: {
    headers: {
      "X-Client-Info": "lotuz-analytics-web",
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  // Adicionar configurações de reconexão
  fetch: (url, options) => {
    return fetch(url, {
      ...options,
      // Aumentar o timeout para 30 segundos
      signal: options?.signal || (typeof AbortController !== "undefined" ? new AbortController().signal : undefined),
      // Adicionar cabeçalhos para evitar cache
      headers: {
        ...options?.headers,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }).catch((error) => {
      console.error("Erro na requisição Supabase:", error)
      throw error
    })
  },
})

// Adicionar um evento para reconectar automaticamente quando a conexão de rede for restaurada
if (typeof window !== "undefined") {
  window.addEventListener("online", async () => {
    console.log("Conexão de rede restaurada, tentando reconectar ao Supabase...")
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (error) {
        console.error("Erro ao reconectar após retorno da rede:", error)
      } else if (data.session) {
        console.log("Reconectado com sucesso após retorno da rede")
      }
    } catch (error) {
      console.error("Exceção ao tentar reconectar após retorno da rede:", error)
    }
  })
}
