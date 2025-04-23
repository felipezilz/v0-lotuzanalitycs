"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Upload } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { updateProductImage } from "@/lib/data"

interface UpdateProductImageModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newImageUrl: string) => void
  productId: string
  currentImage: string
}

export function UpdateProductImageModal({
  isOpen,
  onClose,
  onSuccess,
  productId,
  currentImage,
}: UpdateProductImageModalProps) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Verificar tamanho do arquivo (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo permitido é 2MB.",
        variant: "destructive",
      })
      return
    }

    setSelectedImage(file)

    // Criar URL para preview
    const fileReader = new FileReader()
    fileReader.onload = () => {
      setPreviewUrl(fileReader.result as string)
    }
    fileReader.readAsDataURL(file)
  }

  const handleUpload = async () => {
    if (!selectedImage || !productId) return

    setIsUploading(true)
    setUploadProgress(10)

    try {
      // Simular progresso de upload
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          const newProgress = prev + Math.random() * 20
          return newProgress >= 90 ? 90 : newProgress
        })
      }, 300)

      // Converter a imagem para base64
      const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(selectedImage)
      })

      clearInterval(progressInterval)
      setUploadProgress(95)

      // Atualizar a imagem do produto no banco de dados
      const success = await updateProductImage(productId, base64Image)

      if (!success) {
        throw new Error("Falha ao atualizar a imagem do produto")
      }

      setUploadProgress(100)
      toast({
        title: "Imagem atualizada",
        description: "A imagem do produto foi atualizada com sucesso.",
      })

      // Notificar o componente pai sobre a atualização bem-sucedida
      onSuccess(base64Image)

      // Fechar o modal após um breve atraso
      setTimeout(() => {
        onClose()
        setSelectedImage(null)
        setPreviewUrl(null)
        setUploadProgress(0)
      }, 1000)
    } catch (error) {
      console.error("Erro ao fazer upload da imagem:", error)
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a imagem do produto. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleCancel = () => {
    setSelectedImage(null)
    setPreviewUrl(null)
    setUploadProgress(0)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atualizar Imagem do Produto</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex flex-col items-center gap-4">
            {/* Imagem atual ou preview */}
            <div className="relative h-40 w-40 overflow-hidden rounded-md border">
              <img
                src={previewUrl || currentImage || "/placeholder.svg?height=200&width=200"}
                alt="Imagem do produto"
                className="h-full w-full object-cover"
              />
            </div>

            {/* Botão para selecionar arquivo */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
              disabled={isUploading}
            />

            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              Escolher Nova Imagem
            </Button>

            {/* Barra de progresso */}
            {isUploading && (
              <div className="w-full space-y-2">
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-center text-muted-foreground">{Math.round(uploadProgress)}%</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isUploading}>
            Cancelar
          </Button>
          <Button onClick={handleUpload} disabled={!selectedImage || isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Atualizar Imagem"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
