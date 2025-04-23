"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { MainNav } from "@/components/main-nav"
import { PerformanceReport } from "@/components/performance-report"
import { supabase } from "@/lib/supabase"

export default function ReportsPage() {
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
        const { data } = await supabase.auth.getSession()

        // Se não houver sessão, tentar recuperar de cookies ou localStorage
        if (!data.session) {
          console.log("Nenhuma sessão encontrada, tentando recuperar de armazenamento local...")

          // Tentar refresh automático uma vez antes de redirecionar
          const refreshed = await refreshSession()

          if (!refreshed) {
            console.log("Falha ao recuperar sessão, redirecionando para login")
            setIsRedirecting(true)
            router.push("/")
            return
          } else {
            console.log("Sessão recuperada com sucesso")
          }
        }

        // Se houver uma sessão mas não houver usuário no contexto, tenta atualizar
        if (data.session && !user) {
          console.log("Sessão encontrada, mas usuário não está no contexto. Atualizando sessão...")
          const refreshed = await refreshSession()

          if (!refreshed) {
            console.log("Falha ao atualizar sessão, redirecionando para login")
            setIsRedirecting(true)
            router.push("/")
            return
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

  // Mostrar tela de carregamento enquanto verifica autenticação
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

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xl font-semibold">
              ProdTrack
            </Link>
            <h1 className="text-xl font-semibold">Relatórios</h1>
          </div>
          <MainNav />
        </div>
      </header>
      <main className="flex-1">
        <div className="container py-6">
          <div className="mb-6">
            <Link
              href="/dashboard"
              className="mb-4 flex items-center text-sm font-medium text-muted-foreground hover:underline"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Voltar para o Dashboard
            </Link>
            <h2 className="text-3xl font-bold tracking-tight">Relatórios de Desempenho</h2>
            <p className="mt-2 text-muted-foreground">
              Compare métricas entre períodos e exporte relatórios detalhados
            </p>
          </div>

          <PerformanceReport />
        </div>
      </main>
    </div>
  )
}
