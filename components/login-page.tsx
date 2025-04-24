"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function LoginPage() {
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [registerName, setRegisterName] = useState("")
  const [registerEmail, setRegisterEmail] = useState("")
  const [registerPassword, setRegisterPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null)
  const { login, register, user, testConnection } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  // Verificar se o usuário já está autenticado
  useEffect(() => {
    // Pequeno atraso para evitar flash de conteúdo
    const timer = setTimeout(() => {
      setIsCheckingAuth(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  // Redirecionar se o usuário estiver autenticado
  useEffect(() => {
    if (user) {
      router.push("/dashboard")
    }
  }, [user, router])

  // Função para testar a conexão com o Supabase
  const handleTestConnection = async () => {
    setIsTestingConnection(true)
    setConnectionStatus(null)

    try {
      const result = await testConnection()

      if (result.success) {
        setConnectionStatus({
          success: true,
          message: "Conexão com o servidor estabelecida com sucesso!",
        })
      } else {
        setConnectionStatus({
          success: false,
          message: `Falha na conexão: ${result.error}`,
        })
      }
    } catch (error) {
      setConnectionStatus({
        success: false,
        message: "Erro ao testar conexão",
      })
    } finally {
      setIsTestingConnection(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Validação básica
      if (!loginEmail || !loginPassword) {
        toast({
          title: "Erro",
          description: "Por favor, preencha todos os campos",
          variant: "destructive",
        })
        setIsLoading(false)
        return
      }

      console.log("Tentando login com:", loginEmail)
      const { success, error } = await login(loginEmail, loginPassword)

      if (!success) {
        console.error("Erro no login:", error)
        toast({
          title: "Erro de login",
          description: error || "Email ou senha incorretos",
          variant: "destructive",
        })
        setIsLoading(false)
      } else {
        toast({
          title: "Login bem-sucedido",
          description: "Redirecionando para o dashboard...",
        })

        // Adicionar um timeout para garantir que isLoading seja redefinido mesmo se o redirecionamento demorar
        setTimeout(() => {
          setIsLoading(false)
        }, 3000) // 3 segundos de timeout
      }
    } catch (error) {
      console.error("Erro inesperado durante login:", error)
      toast({
        title: "Erro de login",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    if (!registerName || !registerEmail || !registerPassword) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    if (registerPassword.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    const { success, error } = await register(registerName, registerEmail, registerPassword)

    if (!success) {
      toast({
        title: "Erro no cadastro",
        description: error || "Este email já está em uso",
        variant: "destructive",
      })
      setIsLoading(false)
    } else {
      toast({
        title: "Cadastro realizado",
        description: "Sua conta foi criada com sucesso!",
      })

      // Adicionar um timeout para garantir que isLoading seja redefinido mesmo se o redirecionamento demorar
      setTimeout(() => {
        setIsLoading(false)
      }, 3000) // 3 segundos de timeout
    }
  }

  // Mostrar tela de carregamento enquanto verifica autenticação
  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950 p-4">
        <div className="flex flex-col items-center gap-4">
          <Image
            src="https://lotuzpay.com/wp-content/webp-express/webp-images/uploads/2024/09/Logo-Logomarca-LotuzPay-Png-Colorful.png.webp"
            alt="Lotuz Analytics"
            width={180}
            height={60}
            className="mb-2"
          />
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950 p-4">
      <div className="mb-8 flex flex-col items-center">
        <Image
          src="https://lotuzpay.com/wp-content/webp-express/webp-images/uploads/2024/09/Logo-Logomarca-LotuzPay-Png-Colorful.png.webp"
          alt="Lotuz Analytics"
          width={180}
          height={60}
          className="mb-2"
        />
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Analytics</h1>
      </div>

      {/* Botão para testar conexão */}
      <div className="w-full max-w-md mb-4">
        <Button onClick={handleTestConnection} variant="outline" className="w-full" disabled={isTestingConnection}>
          {isTestingConnection ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testando conexão...
            </>
          ) : (
            "Testar conexão com o servidor"
          )}
        </Button>

        {connectionStatus && (
          <Alert className="mt-2" variant={connectionStatus.success ? "default" : "destructive"}>
            {connectionStatus.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertTitle>{connectionStatus.success ? "Sucesso" : "Erro"}</AlertTitle>
            <AlertDescription>{connectionStatus.message}</AlertDescription>
          </Alert>
        )}
      </div>

      <Tabs defaultValue="login" className="w-full max-w-md">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Login</TabsTrigger>
          <TabsTrigger value="register">Cadastro</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <Card>
            <CardHeader>
              <CardTitle>Login</CardTitle>
              <CardDescription>Entre com suas credenciais para acessar sua conta.</CardDescription>
            </CardHeader>
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    "Entrar"
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="register">
          <Card>
            <CardHeader>
              <CardTitle>Criar Conta</CardTitle>
              <CardDescription>Preencha os dados abaixo para criar sua conta.</CardDescription>
            </CardHeader>
            <form onSubmit={handleRegister}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    placeholder="Seu nome"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Senha</Label>
                  <Input
                    id="register-password"
                    type="password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    "Cadastrar"
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
