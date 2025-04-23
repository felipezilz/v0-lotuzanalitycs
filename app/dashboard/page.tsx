"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { DashboardPage } from "@/components/dashboard-page"
import { useAuth } from "@/lib/auth-context"
import { Loader2 } from "lucide-react"
import { cache } from "@/lib/cache"
import { supabase } from "@/lib/supabase-client"

export default function Dashboard() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(false)
  const sessionCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasCheckedSessionRef = useRef(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    // Marcar componente como montado
    isMountedRef.current = true

    // Função para verificar a sessão
    async function checkSession() {
      // Se já verificamos a sessão ou estamos carregando, não verificar novamente
      if (hasCheckedSessionRef.current || isLoading) {
        return
      }

      try {
        if (isMountedRef.current) {
          setIsCheckingSession(true)
        }
        hasCheckedSessionRef.current = true

        // Verificar cache primeiro
        const cachedUserId = cache.get<string>("currentUserId")
        if (cachedUserId) {
          console.log("Sessão encontrada no cache")
          if (isMountedRef.current) {
            setIsCheckingSession(false)
          }
          return
        }

        // Configurar um timeout para evitar carregamento infinito
        sessionCheckTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            console.log("Timeout de verificação de sessão atingido")
            setIsCheckingSession(false)
            router.push("/")
          }
        }, 5000) // Reduzido para 5 segundos

        // Se não estiver em cache, verificar se há uma sessão no Supabase
        const { data } = await supabase.auth.getSession()

        // Limpar o timeout
        if (sessionCheckTimeoutRef.current) {
          clearTimeout(sessionCheckTimeoutRef.current)
          sessionCheckTimeoutRef.current = null
        }

        // Se não houver sessão, redirecionar para login
        if (!data.session) {
          console.log("Nenhuma sessão encontrada, redirecionando para login")
          if (isMountedRef.current) {
            setIsRedirecting(true)
            router.push("/")
          }
          return
        }

        // Se chegou aqui, temos uma sessão válida
        // Armazenar em cache
        cache.set("currentUserId", data.session.user.id, 30 * 60 * 1000)

        if (isMountedRef.current) {
          setIsCheckingSession(false)
        }
      } catch (error) {
        console.error("Erro ao verificar sessão:", error)
        if (isMountedRef.current) {
          setIsRedirecting(true)
          router.push("/")
        }
      } finally {
        // Limpar o timeout se ainda existir
        if (sessionCheckTimeoutRef.current) {
          clearTimeout(sessionCheckTimeoutRef.current)
          sessionCheckTimeoutRef.current = null
        }
        if (isMountedRef.current) {
          setIsCheckingSession(false)
        }
      }
    }

    // Só verificar a sessão se não tivermos usuário e não estivermos carregando
    if (!user && !isLoading && !hasCheckedSessionRef.current) {
      checkSession()
    } else if (user) {
      // Se temos usuário, não precisamos verificar a sessão
      setIsCheckingSession(false)
      hasCheckedSessionRef.current = true
    }

    // Limpar o timeout quando o componente for desmontado
    return () => {
      // Marcar componente como desmontado
      isMountedRef.current = false

      if (sessionCheckTimeoutRef.current) {
        clearTimeout(sessionCheckTimeoutRef.current)
        sessionCheckTimeoutRef.current = null
      }
    }
  }, [user, isLoading, router])

  // Se estiver verificando a sessão ou redirecionando, mostrar tela de carregamento
  if (isLoading || isRedirecting || isCheckingSession) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {isRedirecting ? "Redirecionando..." : isCheckingSession ? "Verificando sessão..." : "Carregando..."}
          </p>
        </div>
      </div>
    )
  }

  // Se não houver usuário após a verificação, não renderizar nada
  if (!user) return null

  // Renderizar o dashboard se o usuário estiver autenticado
  return <DashboardPage />
}
