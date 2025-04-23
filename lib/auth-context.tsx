"use client"

import { createContext, useContext, useState, useEffect, type ReactNode, useRef, useCallback } from "react"
import { supabase } from "./supabaseClient"

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

// Adicione esta função no início do arquivo, antes do AuthProvider
const REFRESH_TOKEN_INTERVAL = 1000 * 60 * 30 // 30 minutos

// Modifique o AuthProvider para incluir um sistema de refresh token automático
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Modifique a função setupRefreshTimer para ser mais robusta
  const setupRefreshTimer = useCallback(() => {
    // Limpar qualquer timer existente
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current)
    }

    // Configurar novo timer para refresh periódico do token
    // Reduzindo o intervalo para 15 minutos para ser mais seguro
    refreshTimerRef.current = setInterval(
      async () => {
        console.log("Executando refresh automático do token...")
        try {
          const { data, error } = await supabase.auth.refreshSession()

          if (error) {
            console.error("Erro no refresh automático:", error)
            // Tentar novamente uma vez antes de desistir
            const retryResult = await supabase.auth.refreshSession()
            if (retryResult.error) {
              console.error("Falha na segunda tentativa de refresh:", retryResult.error)
              clearInterval(refreshTimerRef.current!)
              refreshTimerRef.current = null
              setUser(null) // Limpar o usuário se não conseguir renovar a sessão
            } else {
              console.log("Token atualizado com sucesso na segunda tentativa")
            }
          } else if (!data.session) {
            console.log("Sessão expirada durante refresh automático")
            clearInterval(refreshTimerRef.current!)
            refreshTimerRef.current = null
            setUser(null)
          } else {
            console.log("Token atualizado com sucesso via refresh automático")
          }
        } catch (error) {
          console.error("Erro no refresh automático:", error)
        }
      },
      1000 * 60 * 15,
    ) // 15 minutos

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [])

  // Carrega o usuário do Supabase Auth na renderização inicial
  useEffect(() => {
    async function loadUser() {
      try {
        setIsLoading(true)
        console.log("Verificando sessão existente...")

        // Verifica se há uma sessão ativa
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session?.user) {
          console.log("Sessão encontrada, carregando perfil do usuário...")
          await fetchAndSetUserProfile(session.user.id)

          // Configurar refresh automático quando temos uma sessão válida
          setupRefreshTimer()
        } else {
          console.log("Nenhuma sessão encontrada")
          setUser(null)
        }
      } catch (error) {
        console.error("Erro ao carregar usuário:", error)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    // Configura o listener para mudanças de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event)

      if (event === "SIGNED_IN" && session) {
        await fetchAndSetUserProfile(session.user.id)
        setupRefreshTimer()
      } else if (event === "SIGNED_OUT") {
        setUser(null)
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current)
          refreshTimerRef.current = null
        }
      } else if (event === "TOKEN_REFRESHED" && session) {
        // Atualiza o usuário quando o token é atualizado
        await fetchAndSetUserProfile(session.user.id)
      }
    })

    loadUser()

    // Limpa o listener e o timer quando o componente é desmontado
    return () => {
      subscription.unsubscribe()
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [setupRefreshTimer])

  // Função auxiliar para buscar e definir o perfil do usuário
  const fetchAndSetUserProfile = async (userId: string) => {
    try {
      // Busca o perfil do usuário usando maybeSingle() em vez de single()
      // maybeSingle() retorna null se não encontrar, em vez de lançar um erro
      const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle()

      if (error) {
        console.error("Erro ao buscar perfil:", error)
        // Busca informações básicas do usuário se houver erro ao buscar o perfil
        await fallbackToUserData(userId)
        return
      }

      if (profile) {
        setUser({
          id: profile.id,
          name: profile.name || "Usuário",
          email: profile.email || "",
          profileImage: profile.profile_image,
        })
        console.log("Perfil do usuário carregado com sucesso")
      } else {
        console.log("Perfil não encontrado, tentando criar um novo")
        // Se não encontrou perfil, tenta criar um novo perfil
        await createUserProfile(userId)
      }
    } catch (error) {
      console.error("Erro ao buscar perfil do usuário:", error)
      // Em caso de erro, tenta usar os dados básicos do usuário
      await fallbackToUserData(userId)
    }
  }

  // Função para criar um novo perfil de usuário se não existir
  const createUserProfile = async (userId: string) => {
    try {
      // Busca informações básicas do usuário
      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (userError || !userData?.user) {
        console.error("Erro ao buscar dados do usuário:", userError)
        return
      }

      const user = userData.user
      const name = user.user_metadata?.name || "Usuário"
      const email = user.email || ""

      // Tenta inserir um novo perfil
      const { error: insertError } = await supabase.from("profiles").insert({
        id: userId,
        name: name,
        email: email,
      })

      if (insertError) {
        console.error("Erro ao criar perfil:", insertError)
        // Se não conseguir criar o perfil, usa os dados básicos
        setUser({
          id: userId,
          name: name,
          email: email,
        })
        return
      }

      // Se criou com sucesso, define o usuário
      setUser({
        id: userId,
        name: name,
        email: email,
      })
      console.log("Novo perfil de usuário criado com sucesso")
    } catch (error) {
      console.error("Erro ao criar perfil de usuário:", error)
      await fallbackToUserData(userId)
    }
  }

  // Função para usar dados básicos do usuário quando não conseguir buscar o perfil
  const fallbackToUserData = async (userId: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser()

      if (userData?.user) {
        setUser({
          id: userId,
          name: userData.user.user_metadata?.name || "Usuário",
          email: userData.user.email || "",
        })
        console.log("Usando dados básicos do usuário como fallback")
      } else {
        console.log("Nenhum dado de usuário disponível para fallback")
        setUser(null)
      }
    } catch (error) {
      console.error("Erro ao buscar dados básicos do usuário:", error)
      setUser(null)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      console.log("Tentando fazer login com email:", email)

      // Validar entrada
      if (!email || !password) {
        return { success: false, error: "Email e senha são obrigatórios" }
      }

      // Limpar espaços em branco
      const trimmedEmail = email.trim()

      // Fazer login com Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (error) {
        console.error("Erro no login:", error.message)

        // Mensagens de erro mais amigáveis
        if (error.message.includes("Invalid login credentials")) {
          return { success: false, error: "Email ou senha incorretos" }
        }

        return { success: false, error: error.message }
      }

      if (!data.user || !data.session) {
        console.error("Login bem-sucedido, mas sem dados de usuário ou sessão")
        return { success: false, error: "Erro ao obter dados do usuário" }
      }

      console.log("Login bem-sucedido para:", data.user.email)
      return { success: true }
    } catch (error) {
      console.error("Exceção ao fazer login:", error)
      return { success: false, error: "Ocorreu um erro inesperado ao fazer login. Tente novamente." }
    }
  }

  const register = async (name: string, email: string, password: string) => {
    try {
      console.log("Tentando registrar novo usuário...")
      // Registra o usuário no Supabase Auth
      // O perfil será criado automaticamente pelo trigger que configuramos
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

      console.log("Registro bem-sucedido")
      return { success: true }
    } catch (error) {
      console.error("Erro ao registrar:", error)
      return { success: false, error: "Ocorreu um erro ao registrar. Tente novamente." }
    }
  }

  const logout = async () => {
    try {
      console.log("Fazendo logout...")
      await supabase.auth.signOut()
      setUser(null)
      console.log("Logout bem-sucedido")
      // Redirecionar para a página inicial acontecerá automaticamente
      // devido ao useEffect nos componentes protegidos
    } catch (error) {
      console.error("Erro ao fazer logout:", error)
    }
  }

  const updateUser = async (userData: Partial<AuthUser>) => {
    try {
      if (!user) {
        console.error("Tentativa de atualizar usuário sem estar autenticado")
        return { success: false, error: "Usuário não autenticado" }
      }

      console.log("Atualizando perfil do usuário...")
      // Atualiza o perfil na tabela profiles
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

      // Atualiza o estado local
      setUser({
        ...user,
        ...userData,
      })

      console.log("Perfil atualizado com sucesso")
      return { success: true }
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error)
      return { success: false, error: "Ocorreu um erro ao atualizar o perfil. Tente novamente." }
    }
  }

  // Modifique a função refreshSession para ser mais robusta
  const refreshSession = async () => {
    try {
      console.log("Tentando atualizar sessão...")

      // Primeiro, verifica se existe uma sessão ativa
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        console.error("Erro ao verificar sessão:", sessionError)
        return false
      }

      // Se não houver sessão, tenta recuperar de cookies ou localStorage
      if (!sessionData.session) {
        console.log("Nenhuma sessão ativa para atualizar, tentando recuperar...")

        // Tenta forçar uma reconexão com o Supabase
        try {
          // Tenta reconectar usando o token armazenado
          const { data: reconnectData, error: reconnectError } = await supabase.auth.refreshSession()

          if (reconnectError || !reconnectData.session) {
            console.log("Falha ao reconectar:", reconnectError)
            setUser(null)
            return false
          }

          console.log("Reconexão bem-sucedida")
          await fetchAndSetUserProfile(reconnectData.session.user.id)
          setupRefreshTimer() // Reinicia o timer após reconexão
          return true
        } catch (reconnectError) {
          console.error("Erro ao tentar reconectar:", reconnectError)
          setUser(null)
          return false
        }
      }

      // Se houver sessão, tenta atualizá-la
      const { data, error } = await supabase.auth.refreshSession()

      if (error) {
        console.error("Erro ao atualizar sessão:", error)

        // Tenta uma segunda vez antes de desistir
        const retryResult = await supabase.auth.refreshSession()
        if (retryResult.error) {
          console.error("Falha na segunda tentativa de atualizar sessão:", retryResult.error)
          setUser(null)
          return false
        } else if (retryResult.data.session) {
          console.log("Sessão atualizada com sucesso na segunda tentativa")
          await fetchAndSetUserProfile(retryResult.data.session.user.id)
          return true
        }

        setUser(null)
        return false
      }

      if (data.session) {
        console.log("Sessão atualizada com sucesso")
        await fetchAndSetUserProfile(data.session.user.id)
        return true
      }

      console.log("Sessão não encontrada após atualização")
      setUser(null)
      return false
    } catch (error) {
      console.error("Erro ao atualizar sessão:", error)
      return false
    }
  }

  // Modificado para verificar se o usuário está logado antes de tentar atualizar a sessão
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Só tenta atualizar a sessão se houver um usuário logado
        if (user) {
          console.log("Página voltou a ficar visível, verificando sessão...")
          refreshSession()
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [user]) // Adicionado user como dependência

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, register, logout, updateUser, refreshSession: refreshSession }}
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
