"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { MainNav } from "@/components/main-nav"
import { ProductTestPanel } from "@/components/product-test-panel"
import { DebugPanel } from "@/components/debug-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function TestPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(false)

  useEffect(() => {
    // Se não estiver carregando e não houver usuário, redirecionar para login
    if (!isLoading && !user) {
      setIsRedirecting(true)
      router.push("/")
    }
  }, [user, isLoading, router])

  // Mostrar tela de carregamento enquanto verifica autenticação
  if (isLoading || isRedirecting) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{isRedirecting ? "Redirecionando..." : "Carregando..."}</p>
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
            <h2 className="text-3xl font-bold tracking-tight">Ferramentas de Teste</h2>
            <p className="mt-2 text-muted-foreground">
              Use estas ferramentas para testar e diagnosticar problemas com a aplicação.
            </p>
          </div>

          <Tabs defaultValue="product-test">
            <TabsList className="mb-4">
              <TabsTrigger value="product-test">Teste de Produto</TabsTrigger>
              <TabsTrigger value="debug">Diagnóstico</TabsTrigger>
            </TabsList>

            <TabsContent value="product-test">
              <ProductTestPanel />
            </TabsContent>

            <TabsContent value="debug">
              <DebugPanel />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
