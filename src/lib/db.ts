import { get, set } from 'idb-keyval'
import { useSyncExternalStore } from 'react'
import { nuevoId, round2 } from './format'
import { getConfig } from './config'
import type { ItemVenta, MetodoPago, Movimiento, Producto, TipoMovimiento, Venta } from './types'

/**
 * Almacén único de la app. Todo se carga a memoria al abrir y se persiste en
 * IndexedDB en cada cambio. Para una tiendita (cientos de productos, miles de
 * tickets) esto es de sobra y evita cualquier costo de servidor.
 */

const K_PRODUCTOS = 'poslite.productos'
const K_VENTAS = 'poslite.ventas'
const K_MOVIMIENTOS = 'poslite.movimientos'
const K_FOLIO = 'poslite.folio'

let productos: Producto[] = []
let ventas: Venta[] = []
let movimientos: Movimiento[] = []
let folio = 0
let listo = false

const oyentes = new Set<() => void>()
function avisar() {
  for (const fn of oyentes) fn()
}
function suscribir(fn: () => void) {
  oyentes.add(fn)
  return () => {
    oyentes.delete(fn)
  }
}

export async function cargarDatos() {
  productos = (await get<Producto[]>(K_PRODUCTOS)) ?? []
  ventas = (await get<Venta[]>(K_VENTAS)) ?? []
  movimientos = (await get<Movimiento[]>(K_MOVIMIENTOS)) ?? []
  folio = (await get<number>(K_FOLIO)) ?? 0
  listo = true
  avisar()
}

// Escrituras encoladas: si se venden 3 cosas seguidas no queremos 3 writes
// compitiendo por el mismo registro.
let pendiente: Promise<void> = Promise.resolve()
function persistir() {
  pendiente = pendiente.then(async () => {
    await set(K_PRODUCTOS, productos)
    await set(K_VENTAS, ventas)
    await set(K_MOVIMIENTOS, movimientos)
    await set(K_FOLIO, folio)
  })
  return pendiente
}
/** Espera a que termine de guardar (respaldos, borrados). */
export const guardadoTerminado = () => pendiente

// ---------------------------------------------------------------- hooks

export const useListo = () => useSyncExternalStore(suscribir, () => listo)
export const useProductos = () => useSyncExternalStore(suscribir, () => productos)
export const useVentas = () => useSyncExternalStore(suscribir, () => ventas)
export const useMovimientos = () => useSyncExternalStore(suscribir, () => movimientos)

// ---------------------------------------------------------------- productos

export function buscarPorCodigo(codigo: string): Producto | undefined {
  const c = codigo.trim()
  return productos.find((p) => p.codigo && p.codigo === c && p.activo)
}

export function guardarProducto(datos: Omit<Producto, 'id' | 'vendidos'> & { id?: string }): Producto {
  const existente = datos.id ? productos.find((p) => p.id === datos.id) : undefined
  if (existente) {
    const stockAnterior = existente.stock
    Object.assign(existente, datos)
    productos = [...productos]
    if (round2(datos.stock) !== round2(stockAnterior)) {
      anotarMovimiento(existente, 'ajuste', round2(datos.stock - stockAnterior), 'Ajuste manual de existencia', null)
    }
    persistir()
    avisar()
    return existente
  }
  const nuevo: Producto = { ...datos, id: nuevoId(), vendidos: 0 }
  productos = [...productos, nuevo]
  if (nuevo.stock > 0) {
    anotarMovimiento(nuevo, 'entrada', nuevo.stock, 'Existencia inicial', null)
  }
  persistir()
  avisar()
  return nuevo
}

export function borrarProducto(id: string) {
  productos = productos.filter((p) => p.id !== id)
  persistir()
  avisar()
}

// ---------------------------------------------------------------- movimientos

/** Registra el movimiento en el kardex. NO toca el stock: eso lo hace quien llama. */
function anotarMovimiento(
  p: Producto,
  tipo: TipoMovimiento,
  cantidad: number,
  motivo: string,
  folioVenta: number | null,
) {
  movimientos = [
    {
      id: nuevoId(),
      fecha: new Date().toISOString(),
      producto_id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      tipo,
      cantidad: round2(cantidad),
      stock_resultante: round2(p.stock),
      costo_unitario: p.costo,
      motivo,
      folio: folioVenta,
    },
    ...movimientos,
  ]
}

/** Entrada / salida / merma capturada a mano. `cantidad` siempre positiva. */
export function moverExistencia(
  productoId: string,
  tipo: 'entrada' | 'salida' | 'merma',
  cantidad: number,
  motivo: string,
) {
  const p = productos.find((x) => x.id === productoId)
  if (!p || cantidad <= 0) return
  const delta = tipo === 'entrada' ? round2(cantidad) : -round2(cantidad)
  p.stock = round2(p.stock + delta)
  productos = [...productos]
  anotarMovimiento(p, tipo, delta, motivo, null)
  persistir()
  avisar()
}

// ---------------------------------------------------------------- ventas

export function siguienteFolio() {
  return folio + 1
}

export function registrarVenta(
  items: ItemVenta[],
  metodo: MetodoPago,
  recibido: number,
  whatsapp?: string,
): Venta {
  const total = round2(items.reduce((s, i) => s + i.importe, 0))
  folio += 1
  const venta: Venta = {
    folio,
    fecha: new Date().toISOString(),
    items,
    total,
    metodo,
    recibido: metodo === 'efectivo' ? round2(recibido) : total,
    cambio: metodo === 'efectivo' ? round2(Math.max(0, recibido - total)) : 0,
    whatsapp: whatsapp || undefined,
  }
  ventas = [venta, ...ventas]

  const controla = getConfig().controlarStock
  for (const it of items) {
    if (!it.producto_id) continue
    const p = productos.find((x) => x.id === it.producto_id)
    if (!p) continue
    p.vendidos = round2(p.vendidos + it.cantidad)
    if (controla) {
      p.stock = round2(p.stock - it.cantidad)
      anotarMovimiento(p, 'venta', -it.cantidad, `Venta #${venta.folio}`, venta.folio)
    }
  }
  productos = [...productos]
  persistir()
  avisar()
  return venta
}

/** Deja constancia de a qué número se le mandó el ticket (no crea cliente). */
export function anotarWhatsApp(folioVenta: number, telefono: string) {
  const v = ventas.find((x) => x.folio === folioVenta)
  if (!v) return
  v.whatsapp = telefono
  ventas = [...ventas]
  persistir()
  avisar()
}

/** Cancela una venta y devuelve la mercancía al inventario. */
export function cancelarVenta(folioVenta: number) {
  const v = ventas.find((x) => x.folio === folioVenta)
  if (!v || v.cancelada) return
  v.cancelada = true
  const controla = getConfig().controlarStock
  for (const it of v.items) {
    if (!it.producto_id) continue
    const p = productos.find((x) => x.id === it.producto_id)
    if (!p) continue
    p.vendidos = round2(Math.max(0, p.vendidos - it.cantidad))
    if (controla) {
      p.stock = round2(p.stock + it.cantidad)
      anotarMovimiento(p, 'cancelacion', it.cantidad, `Cancelación del ticket #${v.folio}`, v.folio)
    }
  }
  ventas = [...ventas]
  productos = [...productos]
  persistir()
  avisar()
}

// ---------------------------------------------------------------- respaldo

export interface Respaldo {
  app: 'pos-lite'
  version: 1
  fecha: string
  productos: Producto[]
  ventas: Venta[]
  movimientos: Movimiento[]
  folio: number
}

export function armarRespaldo(): Respaldo {
  return {
    app: 'pos-lite',
    version: 1,
    fecha: new Date().toISOString(),
    productos,
    ventas,
    movimientos,
    folio,
  }
}

export async function restaurarRespaldo(r: Respaldo) {
  if (r?.app !== 'pos-lite') throw new Error('El archivo no es un respaldo de POS Lite.')
  productos = r.productos ?? []
  ventas = r.ventas ?? []
  movimientos = r.movimientos ?? []
  folio = r.folio ?? ventas.reduce((m, v) => Math.max(m, v.folio), 0)
  await persistir()
  avisar()
}

/** Borra tickets y kardex anteriores a la fecha dada; conserva el catálogo. */
export async function limpiarHistorial(antesDe: string) {
  const corte = new Date(antesDe).getTime()
  ventas = ventas.filter((v) => new Date(v.fecha).getTime() >= corte)
  movimientos = movimientos.filter((m) => new Date(m.fecha).getTime() >= corte)
  await persistir()
  avisar()
}

export async function borrarTodo() {
  productos = []
  ventas = []
  movimientos = []
  folio = 0
  await persistir()
  avisar()
}
