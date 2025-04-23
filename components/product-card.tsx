"use client"

import { useState } from "react"
import Link from "next/link"
import { Trash2 } from "lucide-react"

import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import type { DateRange } from "@/lib/date-utils"
import { type Product, getProductStats, deleteProduct } from "@/lib/data"
import { ConfirmationModal } from "@/components/confirmation-modal"
import { useToast } from "@/components/ui/use-toast"

type ProductCardProps = {
  product: Product
  dateRange: DateRange | null
  onDelete?: () => void
}

export function ProductCard({ product, dateRange, onDelete }: ProductCardProps) {
  const { toast } = useToast()
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Calculate product stats based on the date range
  const stats = getProductStats(product, dateRange)

  // Determine if values are positive or negative
  const isRoiPositive = stats.roi >= 100
  const isLucroPositive = stats.lucro >= 0

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const success = await deleteProduct(product.id)
      if (success) {
        toast({
          title: "Produto excluído",
          description: `${product.nome} foi excluído com sucesso.`,
        })
        if (onDelete) {
          onDelete()
        }
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível excluir o produto. Tente novamente.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Erro ao excluir produto:", error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao excluir o produto. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setIsDeleteModalOpen(false)
    }
  }

  return (
    <>
      <Card className="overflow-hidden border-border hover:border-primary/50 transition-colors">
        <div className="relative h-32 sm:h-40 w-full">
          <div className="h-full w-full">
            <img
              src={product.imagem || "/placeholder.svg?height=200&width=200"}
              alt={product.nome}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
        <CardContent className="p-3 sm:p-4">
          <h3 className="mb-2 text-base sm:text-lg font-semibold line-clamp-1">{product.nome}</h3>
          <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
            <div>
              <p className="text-muted-foreground">Investimento</p>
              <p className="font-medium">{formatCurrency(stats.investimento)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Faturamento</p>
              <p className="font-medium">{formatCurrency(stats.faturamento)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Lucro</p>
              <p className={isLucroPositive ? "value-positive" : "value-negative"}>{formatCurrency(stats.lucro)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">ROI</p>
              <p className={isRoiPositive ? "value-positive" : "value-negative"}>{stats.roi.toFixed(2)}%</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="p-3 sm:p-4 pt-0 flex gap-2">
          <Button
            asChild
            variant="default"
            className="w-full text-xs sm:text-sm bg-info hover:bg-info/90 text-info-foreground"
          >
            <Link href={`/produtos/${product.id}`} prefetch={false}>
              Ver Detalhes
            </Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setIsDeleteModalOpen(true)}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Excluir produto</span>
          </Button>
        </CardFooter>
      </Card>

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Excluir produto"
        description={`Tem certeza que deseja excluir o produto "${product.nome}"? Esta ação não pode ser desfeita.`}
        confirmText={isDeleting ? "Excluindo..." : "Excluir"}
        cancelText="Cancelar"
        variant="destructive"
      />
    </>
  )
}
