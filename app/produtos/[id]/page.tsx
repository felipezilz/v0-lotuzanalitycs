"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Loader2 } from "lucide-react"
import { ProductDetailPage } from "@/components/product-detail-page"
import { supabase } from "@/lib/supabaseClient"

export default function ProductPage({ params }: { params: { id: string } }) {
  const { user, isLoading, refreshSession } = useAuth()
  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [sessionChecked, setSessionChecked] = useState(false)

  // Verificar sessão antes de carregar dados
  async function checkSession() {
    try {
      console.log("Verificando sessão antes de carregar produto...")
      const { data } = await supabase.auth.getSession()

      if (!data.session) {
        console.log("Nenhuma sessão encontrada, tentando recuperar de armazenamento local...")

        // Tentar refresh automático uma vez antes de redirecionar
        const refreshed = await refreshSession()

        if (!refreshed) {
          console.log("Falha ao recuperar sessão, redirecionando para login")
          setIsRedirecting(true)
          router.push("/")
          return false
        } else {
          console.log("Sessão recuperada com sucesso")
          return true
        }
      }

      return true
    } catch (error) {
      console.error("Erro ao verificar sessão:", error)
      setIsRedirecting(true)
      router.push("/")
      return false
    } finally {
      setSessionChecked(true)
      setIsCheckingSession(false)
    }
  }

  useEffect(() => {
    // Verificar se há uma sessão ativa
    async function initialCheck() {
      try {
        setIsCheckingSession(true)

        // Verificar se há uma sessão no Supabase
        const { data } = await supabase.auth.getSession()

        if (!data.session) {
          console.log("Nenhuma sessão encontrada, redirecionando para login")
          setIsRedirecting(true)
          router.push("/")
          return
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
        initialCheck()
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

  // Renderizar a página de detalhes do produto se o usuário estiver autenticado
  return <ProductDetailPage productId={params.id} />
}
