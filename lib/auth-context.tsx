"use client"

import { createContext, useContext, useState, useEffect, type ReactNode, useRef, useCallback } from "react"
import { supabase } from "./supabaseClient"
import { useRouter } from "next/navigation"
import { cache } from "./cache"

type AuthUser = {
  id: string
  name: string
  email: string
  profileImage?: string
}

type AuthContextType = {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  updateUser: (user: Partial<AuthUser>) => Promise<{ success: boolean; error?: string }>
  refreshSession: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Função para configurar o heartbeat da sessão - otimizada
function setupSessionHeartbeat(intervalMinutes = 30) {
  if (typeof window === "undefined") return () => {}

  // Usar um intervalo maior para reduzir chamadas à API
  const heartbeatInterval = setInterval(
    async () => {
      try {
        // Verificar se há uma sessão antes de tentar atualizar
        const cachedUserId = cache.get<string>("currentUserId")
        if (cachedUserId) {
          // Se temos um ID de usuário em cache, a sessão provavelmente está ativa
          // Não precisamos fazer nada
          return
        }

        // Se não temos ID em cache, verificar sessão
        const { data } = await supabase.auth.getSession()
        if (data?.session) {
          // Armazenar ID do usuário em cache
          cache.set("currentUserId", data.session.user.id, 30 * 60 * 1000)
        }
      } catch (e) {
        console.error("Erro no heartbeat da sessão:", e)
      }
    },
    intervalMinutes * 60 * 1000,
  )

  return () => clearInterval(heartbeatInterval)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const initialLoadDoneRef = useRef(false)
  const visibilityCheckedRef = useRef(false)
  const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)

  // Função para buscar e definir o perfil do usuário - otimizada com cache
  const fetchAndSetUserProfile = useCallback(async (userId: string) => {
    try {
      // Verificar cache primeiro
      const cacheKey = `user_profile_${userId}`
      const cachedProfile = cache.get<AuthUser>(cacheKey)

      if (cachedProfile) {
        console.log("Usando perfil de usuário do cache")
        setUser(cachedProfile)
        return
      }

      // Se não estiver em cache, buscar do banco
      const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle()

      if (error) {
        console.error("Erro ao buscar perfil:", error)
        // Fallback para dados básicos
        const { data: userData } = await supabase.auth.getUser()
        if (userData?.user) {
          const basicUser = {
            id: userId,
            name: userData.user.user_metadata?.name || "Usuário",
            email: userData.user.email || "",
          }

          setUser(basicUser)
          // Armazenar em cache
          cache.set(cacheKey, basicUser, 30 * 60 * 1000) // 30 minutos
        }
        return
      }

      if (profile) {
        const userProfile = {
          id: profile.id,
          name: profile.name || "Usuário",
          email: profile.email || "",
          profileImage: profile.profile_image,
        }

        setUser(userProfile)
        // Armazenar em cache
        cache.set(cacheKey, userProfile, 30 * 60 * 1000) // 30 minutos
      } else {
        // Criar perfil se não existir
        const { data: userData } = await supabase.auth.getUser()
        if (userData?.user) {
          const name = userData.user.user_metadata?.name || "Usuário"
          const email = userData.user.email || ""

          await supabase.from("profiles").insert({
            id: userId,
            name: name,
            email: email,
          })

          const newUser = {
            id: userId,
            name: name,
            email: email,
          }

          setUser(newUser)
          // Armazenar em cache
          cache.set(cacheKey, newUser, 30 * 60 * 1000) // 30 minutos
        }
      }
    } catch (error) {
      console.error("Erro ao processar perfil:", error)
    }
  }, [])

  // Função de refresh de sessão simplificada e não-bloqueante
  const refreshSession = useCallback(async () => {
    try {
      // Verificar cache primeiro
      const cachedUserId = cache.get<string>("currentUserId")
      if (cachedUserId) {
        // Se temos um ID em cache, a sessão está ativa
        // Só atualiza o usuário se não existir
        if (!user) {
          await fetchAndSetUserProfile(cachedUserId)
        }
        return true
      }

      // Se não temos ID em cache, tentar refresh
      const { data, error } = await supabase.auth.refreshSession()

      if (!error && data?.session) {
        // Armazenar ID em cache
        cache.set("currentUserId", data.session.user.id, 30 * 60 * 1000)

        // Só atualiza o usuário se não existir
        if (!user && data.session.user) {
          await fetchAndSetUserProfile(data.session.user.id)
        }
        return true
      }

      return false
    } catch (error) {
      console.error("Erro ao atualizar sessão:", error)
      return false
    }
  }, [fetchAndSetUserProfile, user])

  // Definir handleVisibilityChange no nível superior do componente
  const handleVisibilityChange = useCallback(() => {
    // Evitar múltiplas chamadas em sequência
    if (visibilityTimeoutRef.current) {
      clearTimeout(visibilityTimeoutRef.current)
    }

    // Só verificar quando a página fica visível
    if (document.visibilityState === "visible" && !visibilityCheckedRef.current) {
      visibilityCheckedRef.current = true

      // Usar timeout para debounce
      visibilityTimeoutRef.current = setTimeout(async () => {
        // Só verificar se temos um usuário
        if (user) {
          await refreshSession()
        }
        visibilityCheckedRef.current = false
      }, 1000)
    }
  }, [refreshSession, user])

  // Carrega o usuário na inicialização - otimizado
  useEffect(() => {
    // Marcar componente como montado
    isMountedRef.current = true

    // Evitar múltiplas cargas
    if (initialLoadDoneRef.current) return

    async function loadUser() {
      try {
        setIsLoading(true)

        // Verificar cache primeiro
        const cachedUserId = cache.get<string>("currentUserId")
        if (cachedUserId) {
          console.log("Usando ID de usuário do cache")
          await fetchAndSetUserProfile(cachedUserId)
          if (isMountedRef.current) {
            setIsLoading(false)
            initialLoadDoneRef.current = true
          }
          return
        }

        // Se não estiver em cache, verificar sessão
        const { data } = await supabase.auth.getSession()

        if (data?.session?.user) {
          // Armazenar ID em cache
          cache.set("currentUserId", data.session.user.id, 30 * 60 * 1000)

          // Carregar perfil
          await fetchAndSetUserProfile(data.session.user.id)
        } else {
          if (isMountedRef.current) {
            setUser(null)
          }
        }
      } catch (error) {
        console.error("Erro ao carregar usuário:", error)
        if (isMountedRef.current) {
          setUser(null)
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false)
          initialLoadDoneRef.current = true
        }
      }
    }

    // Configurar listener de autenticação - apenas uma vez
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event)

      if (event === "SIGNED_IN" && session) {
        // Armazenar ID em cache
        cache.set("currentUserId", session.user.id, 30 * 60 * 1000)

        await fetchAndSetUserProfile(session.user.id)
      } else if (event === "SIGNED_OUT") {
        // Limpar cache
        cache.clear("currentUserId")

        if (isMountedRef.current) {
          setUser(null)
        }
      } else if (event === "TOKEN_REFRESHED" && session) {
        // Atualizar cache
        cache.set("currentUserId", session.user.id, 30 * 60 * 1000)

        // Só atualiza o usuário se não existir ainda
        if (!user && session.user && isMountedRef.current) {
          await fetchAndSetUserProfile(session.user.id)
        }
      }
    })

    // Iniciar carregamento sem bloquear a renderização
    loadUser()

    // Configurar heartbeat leve - apenas uma vez
    const cleanupHeartbeat = setupSessionHeartbeat(30) // A cada 30 minutos

    return () => {
      // Marcar componente como desmontado
      isMountedRef.current = false

      subscription.unsubscribe()
      if (cleanupHeartbeat) cleanupHeartbeat()
    }
  }, [fetchAndSetUserProfile]) // Remover user para evitar loops

  // Verificação de visibilidade simplificada
  useEffect(() => {
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current)
      }
    }
  }, [handleVisibilityChange])

  // Função de login otimizada
  const login = async (email: string, password: string) => {
    try {
      if (!email || !password) {
        return { success: false, error: "Email e senha são obrigatórios" }
      }

      const trimmedEmail = email.trim()

      // Login com Supabase - sem operações bloqueantes extras
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (error) {
        console.error("Erro no login:", error.message)
        if (error.message.includes("Invalid login credentials")) {
          return { success: false, error: "Email ou senha incorretos" }
        }
        return { success: false, error: error.message }
      }

      if (!data.user || !data.session) {
        return { success: false, error: "Erro ao obter dados do usuário" }
      }

      // Armazenar ID em cache
      cache.set("currentUserId", data.user.id, 30 * 60 * 1000)

      return { success: true }
    } catch (error) {
      console.error("Exceção ao fazer login:", error)
      return { success: false, error: "Ocorreu um erro inesperado ao fazer login. Tente novamente." }
    }
  }

  // Função de registro - sem alterações
  const register = async (name: string, email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      })

      if (error) {
        console.error("Erro no registro:", error.message)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error("Erro ao registrar:", error)
      return { success: false, error: "Ocorreu um erro ao registrar. Tente novamente." }
    }
  }

  // Função de logout - otimizada
  const logout = async () => {
    try {
      await supabase.auth.signOut()

      // Limpar cache
      cache.clear("currentUserId")

      if (isMountedRef.current) {
        setUser(null)
      }
    } catch (error) {
      console.error("Erro ao fazer logout:", error)
    }
  }

  // Função de atualização de usuário - otimizada com cache
  const updateUser = async (userData: Partial<AuthUser>) => {
    try {
      if (!user) {
        return { success: false, error: "Usuário não autenticado" }
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          name: userData.name,
          profile_image: userData.profileImage,
        })
        .eq("id", user.id)

      if (error) {
        console.error("Erro ao atualizar perfil:", error.message)
        return { success: false, error: error.message }
      }

      const updatedUser = {
        ...user,
        ...userData,
      }

      if (isMountedRef.current) {
        setUser(updatedUser)
      }

      // Atualizar cache
      const cacheKey = `user_profile_${user.id}`
      cache.set(cacheKey, updatedUser, 30 * 60 * 1000)

      return { success: true }
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error)
      return { success: false, error: "Ocorreu um erro ao atualizar o perfil. Tente novamente." }
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, updateUser, refreshSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
