"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { supabase, testSupabaseConnection } from "./supabaseClient"
import { useRouter } from "next/navigation"

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
  testConnection: () => Promise<{ success: boolean; error?: string }>
  refreshSession: () => Promise<boolean> // Adicionado de volta
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Função simplificada para testar a conexão
  const testConnection = async () => {
    return await testSupabaseConnection()
  }

  // Função simplificada para buscar o perfil do usuário
  const fetchUserProfile = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", userId).single()

      if (error) {
        console.error("Erro ao buscar perfil:", error.message)
        return null
      }

      return {
        id: profile.id,
        name: profile.name || "Usuário",
        email: profile.email || "",
        profileImage: profile.profile_image,
      }
    } catch (e) {
      console.error("Exceção ao buscar perfil:", e)
      return null
    }
  }

  // Função de refresh de sessão simplificada
  const refreshSession = async () => {
    try {
      // Testar conexão primeiro
      const connectionTest = await testConnection()
      if (!connectionTest.success) {
        console.error("Falha na conexão ao tentar atualizar sessão:", connectionTest.error)
        return false
      }

      // Tentar obter a sessão atual
      const { data: sessionData } = await supabase.auth.getSession()

      if (sessionData?.session) {
        // Já temos uma sessão válida
        if (!user && sessionData.session.user) {
          // Se não temos usuário no estado mas temos na sessão, buscar o perfil
          const profile = await fetchUserProfile(sessionData.session.user.id)

          if (profile) {
            setUser(profile)
          } else {
            // Fallback para dados básicos
            setUser({
              id: sessionData.session.user.id,
              name: sessionData.session.user.user_metadata?.name || "Usuário",
              email: sessionData.session.user.email || "",
            })
          }
        }
        return true
      }

      // Se não temos sessão, tentar refresh
      const { data, error } = await supabase.auth.refreshSession()

      if (error) {
        console.error("Erro ao atualizar sessão:", error.message)
        return false
      }

      if (data?.session && data?.user) {
        // Se temos uma nova sessão após refresh, buscar o perfil
        if (!user) {
          const profile = await fetchUserProfile(data.user.id)

          if (profile) {
            setUser(profile)
          } else {
            // Fallback para dados básicos
            setUser({
              id: data.user.id,
              name: data.user.user_metadata?.name || "Usuário",
              email: data.user.email || "",
            })
          }
        }
        return true
      }

      return false
    } catch (error) {
      console.error("Exceção ao atualizar sessão:", error)
      return false
    }
  }

  // Efeito para carregar o usuário na inicialização
  useEffect(() => {
    const loadUser = async () => {
      try {
        setIsLoading(true)

        // Testar conexão com Supabase
        const connectionTest = await testConnection()
        if (!connectionTest.success) {
          console.error("Falha na conexão com Supabase:", connectionTest.error)
          setIsLoading(false)
          return
        }

        const { data } = await supabase.auth.getSession()

        if (data?.session?.user) {
          const profile = await fetchUserProfile(data.session.user.id)

          if (profile) {
            setUser(profile)
          } else {
            // Fallback para dados básicos se o perfil não for encontrado
            setUser({
              id: data.session.user.id,
              name: data.session.user.user_metadata?.name || "Usuário",
              email: data.session.user.email || "",
            })
          }
        }
      } catch (error) {
        console.error("Erro ao carregar usuário:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadUser()

    // Configurar listener de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event)

      if (event === "SIGNED_IN" && session) {
        const profile = await fetchUserProfile(session.user.id)

        if (profile) {
          setUser(profile)
        } else {
          // Fallback para dados básicos
          setUser({
            id: session.user.id,
            name: session.user.user_metadata?.name || "Usuário",
            email: session.user.email || "",
          })
        }
      } else if (event === "SIGNED_OUT") {
        setUser(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Função de login simplificada
  const login = async (email: string, password: string) => {
    try {
      // Testar conexão primeiro
      const connectionTest = await testConnection()
      if (!connectionTest.success) {
        return {
          success: false,
          error: `Falha na conexão com o servidor: ${connectionTest.error}`,
        }
      }

      if (!email || !password) {
        return { success: false, error: "Email e senha são obrigatórios" }
      }

      const trimmedEmail = email.trim()

      // Login com Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (error) {
        console.error("Erro no login:", error.message)

        // Mensagens de erro mais amigáveis
        if (error.message.includes("Invalid login credentials")) {
          return { success: false, error: "Email ou senha incorretos" }
        } else if (error.message.includes("Email not confirmed")) {
          return { success: false, error: "Email não confirmado. Verifique sua caixa de entrada." }
        }

        return { success: false, error: `Erro de autenticação: ${error.message}` }
      }

      if (!data.user || !data.session) {
        return { success: false, error: "Erro ao obter dados do usuário" }
      }

      return { success: true }
    } catch (error) {
      console.error("Exceção ao fazer login:", error)
      return {
        success: false,
        error: "Ocorreu um erro inesperado ao fazer login. Verifique sua conexão e tente novamente.",
      }
    }
  }

  // Função de registro simplificada
  const register = async (name: string, email: string, password: string) => {
    try {
      // Testar conexão primeiro
      const connectionTest = await testConnection()
      if (!connectionTest.success) {
        return {
          success: false,
          error: `Falha na conexão com o servidor: ${connectionTest.error}`,
        }
      }

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

        // Mensagens de erro mais amigáveis
        if (error.message.includes("already registered")) {
          return { success: false, error: "Este email já está registrado" }
        }

        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error("Erro ao registrar:", error)
      return { success: false, error: "Ocorreu um erro ao registrar. Tente novamente." }
    }
  }

  // Função de logout simplificada
  const logout = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      router.push("/")
    } catch (error) {
      console.error("Erro ao fazer logout:", error)
    }
  }

  // Função de atualização de usuário simplificada
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

      setUser({
        ...user,
        ...userData,
      })

      return { success: true }
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error)
      return { success: false, error: "Ocorreu um erro ao atualizar o perfil. Tente novamente." }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        updateUser,
        testConnection,
        refreshSession, // Adicionado de volta
      }}
    >
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
