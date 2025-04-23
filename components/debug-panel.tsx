"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { checkAuthStatus, testSupabaseConnection, testProductInsert } from "@/lib/debug-utils"
import { Loader2 } from "lucide-react"

export function DebugPanel() {
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<any>(null)

  const runAuthCheck = async () => {
    setIsLoading(true)
    try {
      const result = await checkAuthStatus()
      setResults(result)
    } catch (error) {
      setResults({
        error: error instanceof Error ? error.message : "Erro desconhecido",
        details: error,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const runConnectionTest = async () => {
    setIsLoading(true)
    try {
      const result = await testSupabaseConnection()
      setResults(result)
    } catch (error) {
      setResults({
        error: error instanceof Error ? error.message : "Erro desconhecido",
        details: error,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const runInsertTest = async () => {
    setIsLoading(true)
    try {
      const result = await testProductInsert()
      setResults(result)
    } catch (error) {
      setResults({
        error: error instanceof Error ? error.message : "Erro desconhecido",
        details: error,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Painel de Depuração</CardTitle>
        <CardDescription>Ferramentas para diagnosticar problemas com o Supabase</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          <Button onClick={runAuthCheck} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Verificar Autenticação
          </Button>
          <Button onClick={runConnectionTest} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Testar Conexão
          </Button>
          <Button onClick={runInsertTest} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Testar Inserção
          </Button>
        </div>

        {results && (
          <div className="bg-muted p-4 rounded-md overflow-auto max-h-96">
            <pre className="text-xs">{JSON.stringify(results, null, 2)}</pre>
          </div>
        )}
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        Use estas ferramentas apenas para diagnóstico durante o desenvolvimento.
      </CardFooter>
    </Card>
  )
}
