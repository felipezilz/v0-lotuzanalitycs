"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Camera, Save } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { MainNav } from "@/components/main-nav"
import { useToast } from "@/components/ui/use-toast"

export function ProfilePage() {
  const { user, updateUser } = useAuth()
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [profileImage, setProfileImage] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name)
      setProfileImage(user.profileImage || "/placeholder.svg?height=200&width=200")
    }
  }, [user])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]

      // Verifica o tamanho do arquivo (máx 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Erro",
          description: "A imagem deve ter no máximo 5MB",
          variant: "destructive",
        })
        return
      }

      const reader = new FileReader()

      reader.onload = (event) => {
        if (event.target && typeof event.target.result === "string") {
          setProfileImage(event.target.result)
        }
      }

      reader.onerror = () => {
        toast({
          title: "Erro",
          description: "Erro ao carregar a imagem. Tente novamente.",
          variant: "destructive",
        })
      }

      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      // Atualiza o perfil do usuário
      if (user) {
        const { success, error } = await updateUser({
          name,
          profileImage,
        })

        if (success) {
          toast({
            title: "Perfil atualizado",
            description: "Seu perfil foi atualizado com sucesso!",
          })
        } else {
          toast({
            title: "Erro",
            description: error || "Ocorreu um erro ao atualizar o perfil. Tente novamente.",
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao atualizar o perfil. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

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
          </div>

          <div className="mx-auto max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>Configurações de Perfil</CardTitle>
                <CardDescription>Atualize suas informações pessoais e preferências.</CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-6">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative h-24 w-24">
                      <Image
                        src={profileImage || "/placeholder.svg?height=200&width=200"}
                        alt="Foto de perfil"
                        fill
                        className="rounded-full object-cover"
                      />
                      <Label
                        htmlFor="profile-image"
                        className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                      >
                        <Camera className="h-4 w-4" />
                        <span className="sr-only">Alterar foto</span>
                        <Input
                          id="profile-image"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageChange}
                        />
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground">Clique no ícone para alterar sua foto</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={user.email} disabled className="bg-muted" />
                    <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={isSaving} className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    {isSaving ? "Salvando..." : "Salvar alterações"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
