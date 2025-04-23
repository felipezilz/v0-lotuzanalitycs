"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "@/lib/auth-context"
import { cache } from "@/lib/cache"

export function GlobalSessionCheck() {
  const { refreshSession } = useAuth()
  const hasCheckedRef = useRef(false)

  useEffect(() => {
    // Verificar sessão apenas uma vez na montagem do componente
    if (!hasCheckedRef.current) {
      hasCheckedRef.current = true

      // Verificar cache primeiro
      const cachedUserId = cache.get<string>("currentUserId")
      if (cachedUserId) {
        // Se temos um ID em cache, a sessão está ativa
        console.log("Sessão global encontrada no cache")
        return
      }

      // Se não estiver em cache, tentar refresh
      refreshSession()
    }
  }, [refreshSession])

  // Este componente não renderiza nada visualmente
  return null
}
