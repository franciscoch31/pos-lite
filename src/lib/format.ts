import { getConfig } from './config'

/** Formatea como moneda (MXN por defecto). */
export function money(v: number): string {
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: getConfig().moneda || 'MXN',
    }).format(v || 0)
  } catch {
    return `$${(v || 0).toFixed(2)}`
  }
}

/** Redondea a 2 decimales evitando errores de punto flotante. */
export function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100
}

export function hora(d: string | Date): string {
  return new Date(d).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

export function fechaHora(d: string | Date): string {
  return new Date(d).toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 'YYYY-MM-DD' del día local (el que usa <input type="date">). */
export function claveDia(d: string | Date = new Date()): string {
  const f = new Date(d)
  const mm = String(f.getMonth() + 1).padStart(2, '0')
  const dd = String(f.getDate()).padStart(2, '0')
  return `${f.getFullYear()}-${mm}-${dd}`
}

export function fechaLarga(clave: string): string {
  const [y, m, d] = clave.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** id corto y único, sin dependencias. */
export function nuevoId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
