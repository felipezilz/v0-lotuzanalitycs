"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { MainNav } from "@/components/main-nav"
import { AnalyticsDashboard } from "@/components/analytics-dashboard"
import { supabase } from "@/lib/supabaseClient"

export default function AnalyticsPage() {
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
            <Link href="/dashboard">
              <Image
                src="https://lotuzpay.com/wp-content/webp-express/webp-images/uploads/2024/09/Logo-Logomarca-LotuzPay-Png-Colorful.png.webp"
                alt="Lotuz Analytics"
                width={120}
                height={40}
                className="h-8 w-auto"
              />
            </Link>
            <h1 className="text-xl font-semibold">Analytics</h1>
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
            <h2 className="text-3xl font-bold tracking-tight">Analytics Avançado</h2>
            <p className="mt-2 text-muted-foreground">
              Visualize métricas detalhadas e tendências de desempenho dos seus produtos
            </p>
          </div>

          <AnalyticsDashboard />
        </div>
      </main>
    </div>
  )
}
