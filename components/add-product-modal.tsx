"use client"

import type React from "react"

import { useState } from "react"
import { ImagePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabaseClient"

type AddProductModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: (product: any) => void
}

export function AddProductModal({ isOpen, onClose, onSuccess }: AddProductModalProps) {
  const { toast } = useToast()
  const [productName, setProductName] = useState("")
  const [imagePreview, setImagePreview] = useState("/placeholder.svg?height=200&width=200")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const resetForm = () => {
    setProductName("")
    setImagePreview("/placeholder.svg?height=200&width=200")
    setError("")
  }

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm()
      onClose()
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]

      // Verifica o tamanho do arquivo (máx 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("A imagem deve ter no máximo 5MB")
        return
      }

      const reader = new FileReader()

      reader.onload = (event) => {
        if (event.target && typeof event.target.result === "string") {
          setImagePreview(event.target.result)
        }
      }

      reader.onerror = () => {
        setError("Erro ao carregar a imagem. Tente novamente.")
      }

      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Validação básica
    if (!productName.trim()) {
      setError("O nome do produto é obrigatório")
      return
    }

    try {
      setIsSubmitting(true)
      console.log("Iniciando adição de produto:", productName)

      // 1. Verificar se há uma sessão ativa
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        throw new Error(`Erro ao verificar sessão: ${sessionError.message}`)
      }

      if (!sessionData.session) {
        throw new Error("Usuário não autenticado")
      }

      const userId = sessionData.session.user.id
      console.log("Usuário autenticado:", userId)

      // 2. Preparar dados para inserção
      const productData = {
        name: productName.trim(),
        image: imagePreview || "/placeholder.svg?height=200&width=200",
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      console.log("Dados preparados para inserção:", productData)

      // 3. Inserir o novo produto
      const { data: newProduct, error: insertError } = await supabase
        .from("products")
        .insert(productData)
        .select()
        .single()

      if (insertError) {
        console.error("Erro ao inserir produto:", insertError)

        // Verificar se é um erro de RLS
        if (insertError.code === "42501" || insertError.message.includes("permission denied")) {
          throw new Error("Você não tem permissão para adicionar produtos")
        }

        throw new Error(`Erro ao salvar produto: ${insertError.message}`)
      }

      if (!newProduct) {
        throw new Error("Produto não foi criado")
      }

      console.log("Produto salvo com sucesso:", newProduct.id)

      // 4. Converter para o formato da aplicação
      const formattedProduct = {
        id: newProduct.id,
        nome: newProduct.name,
        imagem: newProduct.image || "/placeholder.svg?height=200&width=200",
        dados: [],
        createdAt: newProduct.created_at || new Date().toISOString(),
      }

      // Notificar sucesso
      toast({
        title: "Produto adicionado",
        description: `${productName} foi adicionado com sucesso.`,
      })

      // Resetar formulário e fechar modal
      resetForm()
      onSuccess(formattedProduct)
      onClose()
    } catch (error) {
      console.error("Erro ao adicionar produto:", error)
      setError(error instanceof Error ? error.message : "Ocorreu um erro ao adicionar o produto. Tente novamente.")

      toast({
        title: "Erro ao adicionar produto",
        description: error instanceof Error ? error.message : "Ocorreu um erro inesperado",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Adicionar Novo Produto</DialogTitle>
            <DialogDescription>Preencha os dados do novo produto digital que deseja acompanhar.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome do Produto</Label>
              <Input
                id="name"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Ex: Curso de Marketing Digital"
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="image">Imagem do Produto</Label>
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 overflow-hidden rounded-md border">
                  <img src={imagePreview || "/placeholder.svg"} alt="Preview" className="h-full w-full object-cover" />
                </div>
                <Label
                  htmlFor="image-upload"
                  className={`flex h-10 cursor-pointer items-center gap-2 rounded-md border bg-background px-4 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    isSubmitting ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  <ImagePlus className="h-4 w-4" />
                  <span>Escolher Imagem</span>
                  <Input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                    disabled={isSubmitting}
                  />
                </Label>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!productName.trim() || isSubmitting}>
              {isSubmitting ? "Adicionando..." : "Adicionar Produto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
