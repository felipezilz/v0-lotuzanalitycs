"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ProfilePage } from "@/components/profile-page"
import { useAuth } from "@/lib/auth-context"
import { Loader2 } from "lucide-react"

export default function Profile() {
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

  // Renderizar a página de perfil se o usuário estiver autenticado
  return <ProfilePage />
}
