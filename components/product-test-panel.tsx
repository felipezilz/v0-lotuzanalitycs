"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { saveProduct } from "@/lib/data"
import { checkAuthStatus } from "@/lib/debug-utils"
import { supabase } from "@/lib/supabaseClient"
import { Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export function ProductTestPanel() {
  const { toast } = useToast()
  const [productName, setProductName] = useState("Produto de Teste")
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [testSteps, setTestSteps] = useState<
    Array<{
      step: string
      status: "pending" | "loading" | "success" | "error"
      message?: string
    }>
  >([])

  const resetTest = () => {
    setTestSteps([])
    setResults(null)
  }

  const addTestStep = (step: string, status: "pending" | "loading" | "success" | "error", message?: string) => {
    setTestSteps((prev) => [...prev, { step, status, message }])
  }

  const updateLastStep = (status: "pending" | "loading" | "success" | "error", message?: string) => {
    setTestSteps((prev) => {
      const newSteps = [...prev]
      if (newSteps.length > 0) {
        const lastIndex = newSteps.length - 1
        newSteps[lastIndex] = { ...newSteps[lastIndex], status, message }
      }
      return newSteps
    })
  }

  const runFullTest = async () => {
    resetTest()
    setIsLoading(true)

    try {
      // Passo 1: Verificar autenticação
      addTestStep("Verificando autenticação", "loading")
      const authStatus = await checkAuthStatus()

      if (!authStatus.isAuthenticated) {
        updateLastStep("error", "Usuário não autenticado")
        setResults({ error: "Usuário não autenticado", authStatus })
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar autenticado para adicionar produtos",
          variant: "destructive",
        })
        return
      }

      updateLastStep("success", `Autenticado como ${authStatus.user?.email}`)

      // Passo 2: Verificar permissões RLS
      addTestStep("Verificando permissões RLS", "loading")
      try {
        const { count, error } = await supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("user_id", authStatus.user?.id)

        if (error) {
          updateLastStep("error", `Erro ao verificar permissões: ${error.message}`)
          throw error
        }

        updateLastStep("success", `Permissões verificadas. Você tem ${count} produtos.`)
      } catch (error) {
        updateLastStep(
          "error",
          `Erro ao verificar permissões: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
        )
        throw error
      }

      // Passo 3: Preparar dados do produto
      addTestStep("Preparando dados do produto", "loading")
      const testProductName = `${productName} ${new Date().toISOString().substring(0, 19)}`

      updateLastStep("success", `Dados preparados: "${testProductName}"`)

      // Passo 4: Salvar produto usando a função da aplicação
      addTestStep("Salvando produto via função saveProduct", "loading")
      try {
        const newProduct = await saveProduct({
          nome: testProductName,
          imagem: "/placeholder.svg?height=200&width=200",
        })

        if (!newProduct) {
          updateLastStep("error", "Falha ao salvar produto: retorno nulo")
          throw new Error("Falha ao salvar produto: retorno nulo")
        }

        updateLastStep("success", `Produto salvo com sucesso! ID: ${newProduct.id}`)

        // Passo 5: Verificar se o produto foi realmente salvo
        addTestStep("Verificando se o produto foi salvo no banco", "loading")
        const { data: savedProduct, error: fetchError } = await supabase
          .from("products")
          .select("*")
          .eq("id", newProduct.id)
          .single()

        if (fetchError) {
          updateLastStep("error", `Erro ao verificar produto salvo: ${fetchError.message}`)
          throw fetchError
        }

        if (!savedProduct) {
          updateLastStep("error", "Produto não encontrado após salvamento")
          throw new Error("Produto não encontrado após salvamento")
        }

        updateLastStep("success", "Produto verificado no banco de dados")

        // Resultado final
        setResults({
          success: true,
          product: newProduct,
          savedProduct,
          message: "Teste completo! O produto foi adicionado com sucesso.",
        })

        toast({
          title: "Teste concluído com sucesso",
          description: "O produto foi adicionado corretamente",
        })
      } catch (error) {
        updateLastStep("error", `Erro: ${error instanceof Error ? error.message : "Erro desconhecido"}`)
        setResults({
          success: false,
          error: error instanceof Error ? error.message : "Erro desconhecido",
          details: error,
        })

        toast({
          title: "Erro no teste",
          description: error instanceof Error ? error.message : "Ocorreu um erro durante o teste",
          variant: "destructive",
        })
      }
    } catch (error) {
      setResults({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
        details: error,
      })

      toast({
        title: "Erro no teste",
        description: "Ocorreu um erro durante o teste",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Teste de Adição de Produto</CardTitle>
        <CardDescription>Teste passo a passo para verificar a adição de produtos</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="product-name">Nome do Produto de Teste</Label>
            <Input
              id="product-name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <Button onClick={runFullTest} disabled={isLoading || !productName.trim()} className="w-full">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Executar Teste Completo
          </Button>

          {testSteps.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-medium">Progresso do Teste:</h3>
              <ul className="space-y-2">
                {testSteps.map((step, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    {step.status === "loading" && (
                      <Loader2 className="h-5 w-5 text-blue-500 animate-spin shrink-0 mt-0.5" />
                    )}
                    {step.status === "success" && <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />}
                    {step.status === "error" && <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />}
                    {step.status === "pending" && <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />}
                    <div>
                      <p className="font-medium">{step.step}</p>
                      {step.message && <p className="text-muted-foreground text-xs">{step.message}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {results && (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Resultado do Teste:</h3>
              <div
                className={`p-3 rounded-md text-sm ${results.success ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}
              >
                {results.success ? (
                  <p className="text-green-600 dark:text-green-400 font-medium">{results.message}</p>
                ) : (
                  <p className="text-red-600 dark:text-red-400 font-medium">
                    {results.error || "Ocorreu um erro durante o teste"}
                  </p>
                )}
              </div>

              <div className="mt-4 bg-muted p-3 rounded-md overflow-auto max-h-60">
                <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(results, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        Este painel de teste pode ser usado para diagnosticar problemas com a adição de produtos.
      </CardFooter>
    </Card>
  )
}
