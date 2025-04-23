// Sistema de cache simples para reduzir chamadas à API

type CacheItem<T> = {
  data: T
  timestamp: number
  expiry: number // tempo em ms
}

class SimpleCache {
  private cache: Record<string, CacheItem<any>> = {}

  // Obter item do cache
  get<T>(key: string): T | null {
    const item = this.cache[key]

    // Se não existe ou expirou, retorna null
    if (!item || Date.now() > item.timestamp + item.expiry) {
      return null
    }

    return item.data
  }

  // Armazenar item no cache
  set<T>(key: string, data: T, expiryMs: number = 5 * 60 * 1000): void {
    this.cache[key] = {
      data,
      timestamp: Date.now(),
      expiry: expiryMs,
    }
  }

  // Limpar item específico do cache
  clear(key: string): void {
    delete this.cache[key]
  }

  // Limpar todo o cache
  clearAll(): void {
    this.cache = {}
  }

  // Verificar se um item existe e é válido
  has(key: string): boolean {
    const item = this.cache[key]
    return !!item && Date.now() <= item.timestamp + item.expiry
  }
}

// Exportar uma instância única
export const cache = new SimpleCache()
