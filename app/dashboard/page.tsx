"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardPage } from "@/components/dashboard-page"
import { useAuth } from "@/lib/auth-context"
import { Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"

export default function Dashboard() {
  const { user, isLoading, refreshSession } = useAuth()
  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    // Verificar se há uma sessão ativa
    async function checkSession() {
      try {
        setIsCheckingSession(true)

        // Verificar se há uma sessão no Supabase
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error("Erro ao verificar sessão:", error)
          throw error
        }

        // Se não houver sessão, tentar recuperar de cookies ou localStorage
        if (!data.session) {
          console.log("Nenhuma sessão encontrada, tentando recuperar de armazenamento local...")

          // Tentar refresh automático uma vez antes de redirecionar
          const refreshed = await refreshSession()

          if (!refreshed) {
            console.log("Falha ao recuperar sessão, tentando uma última vez...")

            // Espera um pouco e tenta novamente
            await new Promise((resolve) => setTimeout(resolve, 1000))
            const secondAttempt = await refreshSession()

            if (!secondAttempt) {
              console.log("Falha definitiva, redirecionando para login")
              setIsRedirecting(true)
              router.push("/")
              return
            } else {
              console.log("Sessão recuperada na segunda tentativa")
            }
          } else {
            console.log("Sessão recuperada com sucesso")
          }
        }

        // Se houver uma sessão mas não houver usuário no contexto, tenta atualizar
        if (data.session && !user) {
          console.log("Sessão encontrada, mas usuário não está no contexto. Atualizando sessão...")
          const refreshed = await refreshSession()

          if (!refreshed) {
            console.log("Falha ao atualizar sessão, tentando uma última vez...")

            // Espera um pouco e tenta novamente
            await new Promise((resolve) => setTimeout(resolve, 1000))
            const secondAttempt = await refreshSession()

            if (!secondAttempt) {
              console.log("Falha definitiva, redirecionando para login")
              setIsRedirecting(true)
              router.push("/")
              return
            }
          }
        }
      } catch (error) {
        console.error("Erro ao verificar sessão:", error)
        setIsRedirecting(true)
        router.push("/")
      } finally {
        setIsCheckingSession(false)
      }
    }

    if (!isLoading) {
      if (!user) {
        checkSession()
      } else {
        setIsCheckingSession(false)
      }
    }
  }, [user, isLoading, router, refreshSession])

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
