"use client"

import { useState, useEffect } from "react"
import { AlertCircle, XCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { testSupabaseConnection } from "@/lib/supabaseClient"

export function ConnectionStatusAlert() {
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const checkConnection = async () => {
      const result = await testSupabaseConnection()
      if (!result.success) {
        setConnectionError(result.error || "Erro de conexão com o servidor")
        setIsVisible(true)
      } else {
        setConnectionError(null)
        setIsVisible(false)
      }
    }

    // Verificar conexão na inicialização
    checkConnection()

    // Verificar conexão periodicamente
    const interval = setInterval(checkConnection, 60000) // A cada minuto

    return () => clearInterval(interval)
  }, [])

  if (!isVisible || !connectionError) {
    return null
  }

  return (
    <Alert variant="destructive" className="fixed top-4 right-4 w-auto max-w-md z-50">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Problema de conexão</AlertTitle>
      <AlertDescription className="flex justify-between items-center">
        <span>{connectionError}</span>
        <XCircle className="h-4 w-4 cursor-pointer" onClick={() => setIsVisible(false)} />
      </AlertDescription>
    </Alert>
  )
}
