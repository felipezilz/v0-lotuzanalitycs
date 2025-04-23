import { createClient } from "@supabase/supabase-js"

// Tipos para as tabelas do Supabase
export type Profile = {
  id: string
  name: string
  email: string
  profile_image?: string
  created_at?: string
  updated_at?: string
}

export type ProductDB = {
  id: string
  name: string
  image?: string
  user_id: string
  created_at?: string
  updated_at?: string
}

export type ProductDataDB = {
  id: string
  product_id: string
  date: string
  investment: number
  revenue: number
  profit: number
  roi: number
  visits: number
  cpa: number
  clicks: number
  impressions: number
  sales: number
  ctr: number
  cpc: number
  cpm: number
}

// Cria um cliente Supabase para o lado do cliente
const createBrowserClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      storageKey: "prodtrack-auth-storage",
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  })
}

// Cria um cliente Supabase para o lado do servidor
const createServerClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL as string
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string

  return createClient(supabaseUrl, supabaseServiceKey)
}

// Singleton para o cliente do lado do cliente
let browserClient: ReturnType<typeof createClient> | null = null

// Obtém o cliente do Supabase para o lado do cliente
export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient()
  }
  return browserClient
}

// Obtém o cliente do Supabase para o lado do servidor
export function getSupabaseServerClient() {
  return createServerClient()
}
