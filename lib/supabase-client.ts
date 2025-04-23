import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

// Configuração otimizada para balancear persistência e performance
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "lotuz_analytics_auth",
    // Simplificando o storage para usar apenas localStorage por padrão
    // Isso melhora a performance mantendo a persistência
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
})

// Função simplificada para verificar a sessão periodicamente
// sem causar sobrecarga de requisições
export function setupSessionHeartbeat(intervalMinutes = 20) {
  if (typeof window === "undefined") return undefined

  const intervalId = setInterval(
    async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (data?.session) {
          // Só atualiza se estiver próximo de expirar (menos de 30 minutos)
          const expiresAt = new Date(data.session.expires_at * 1000)
          const now = new Date()
          const minutesRemaining = Math.round((expiresAt.getTime() - now.getTime()) / (60 * 1000))

          if (minutesRemaining < 30) {
            await supabase.auth.refreshSession()
          }
        }
      } catch (e) {
        console.error("Erro no heartbeat da sessão:", e)
      }
    },
    intervalMinutes * 60 * 1000,
  )

  return () => clearInterval(intervalId)
}
