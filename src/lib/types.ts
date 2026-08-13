// Modelo mínimo del POS Lite. Todo vive en el teléfono (IndexedDB), no hay servidor.

export interface Producto {
  id: string
  codigo: string // código de barras; vacío si el producto no tiene
  nombre: string
  precio: number
  costo: number // opcional para el usuario; sirve para la utilidad del corte
  stock: number
  activo: boolean
  vendidos: number // acumulado, ordena la lista de "más vendidos"
}

export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia'

export interface ItemVenta {
  producto_id: string | null // null = venta suelta (monto libre)
  codigo: string
  nombre: string
  cantidad: number
  precio: number
  costo: number
  importe: number
}

export interface Venta {
  folio: number
  fecha: string // ISO
  items: ItemVenta[]
  total: number
  metodo: MetodoPago
  recibido: number
  cambio: number
  /** Teléfono al que se mandó el ticket. No hay clientes registrados: se captura al vuelo. */
  whatsapp?: string
  cancelada?: boolean
}

/**
 * Entradas y salidas de mercancía (kardex).
 * `venta` y `cancelacion` se generan solos; los demás los captura el encargado.
 */
export type TipoMovimiento = 'entrada' | 'salida' | 'merma' | 'ajuste' | 'venta' | 'cancelacion'

export interface Movimiento {
  id: string
  fecha: string // ISO
  producto_id: string
  codigo: string
  nombre: string
  tipo: TipoMovimiento
  cantidad: number // positiva = entra, negativa = sale
  stock_resultante: number
  costo_unitario: number
  motivo: string
  folio: number | null // folio de la venta que lo originó
}

export interface Config {
  nombre: string
  telefono: string
  direccion: string
  mensajeTicket: string
  moneda: string
  /** El lector manda Enter al final del código (lo normal). Si no, se cierra por tiempo. */
  sufijoEnter: boolean
  /** Bip + vibración al escanear. */
  sonido: boolean
  /** Descontar stock en cada venta y avisar cuando baje. */
  controlarStock: boolean
  stockMinimo: number
  /** Preguntar el WhatsApp del cliente al terminar cada venta. */
  pedirWhatsApp: boolean
}
