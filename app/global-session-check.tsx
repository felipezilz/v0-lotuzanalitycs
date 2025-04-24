"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "@/lib/auth-context"

export function GlobalSessionCheck() {
  const { refreshSession } = useAuth()
  const hasCheckedRef = useRef(false)

  useEffect(() => {
    // Verificar sessão apenas uma vez na montagem do componente
    if (!hasCheckedRef.current) {
      hasCheckedRef.current = true

      // Usar um timeout para garantir que o componente está totalmente montado
      const timer = setTimeout(() => {
        try {
          refreshSession().catch((err) => {
            console.error("Erro ao verificar sessão global:", err)
          })
        } catch (error) {
          console.error("Exceção ao verificar sessão global:", error)
        }
      }, 500)

      return () => clearTimeout(timer)
    }
  }, [refreshSession])

  // Este componente não renderiza nada visualmente
  return null
}
