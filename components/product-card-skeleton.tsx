import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function ProductCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="relative h-40 w-full">
        <Skeleton className="h-full w-full" />
      </div>
      <CardContent className="p-4">
        <Skeleton className="h-6 w-3/4 mb-4" />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-5 w-2/3" />
          </div>
          <div>
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-5 w-2/3" />
          </div>
          <div>
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-5 w-2/3" />
          </div>
          <div>
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Skeleton className="h-10 w-full" />
      </CardFooter>
    </Card>
  )
}
