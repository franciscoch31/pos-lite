import { useSyncExternalStore } from 'react'
import { round2 } from './format'
import type { ItemVenta, Producto } from './types'

/**
 * Carrito de la venta en curso. Vive fuera de React para que no se pierda al
 * cambiar de pestaña (pasa seguido: el encargado va a Inventario a media venta).
 */

let items: ItemVenta[] = []
const oyentes = new Set<() => void>()

function avisar() {
  items = [...items]
  for (const fn of oyentes) fn()
}

export const useCarrito = () =>
  useSyncExternalStore(
    (fn) => {
      oyentes.add(fn)
      return () => {
        oyentes.delete(fn)
      }
    },
    () => items,
  )

export const carritoActual = () => items

export function totalCarrito(lista: ItemVenta[] = items): number {
  return round2(lista.reduce((s, i) => s + i.importe, 0))
}

export function piezasCarrito(lista: ItemVenta[] = items): number {
  return round2(lista.reduce((s, i) => s + i.cantidad, 0))
}

export function agregarProducto(p: Producto, cantidad = 1) {
  const i = items.findIndex((x) => x.producto_id === p.id)
  if (i >= 0) {
    items[i] = { ...items[i], cantidad: round2(items[i].cantidad + cantidad) }
    items[i].importe = round2(items[i].cantidad * items[i].precio)
  } else {
    items = [
      ...items,
      {
        producto_id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        cantidad,
        precio: p.precio,
        costo: p.costo,
        importe: round2(cantidad * p.precio),
      },
    ]
  }
  avisar()
}

/** Venta suelta: algo que no está en el catálogo, se cobra por monto. */
export function agregarSuelto(nombre: string, precio: number) {
  items = [
    ...items,
    {
      producto_id: null,
      codigo: '',
      nombre: nombre || 'Varios',
      cantidad: 1,
      precio: round2(precio),
      costo: 0,
      importe: round2(precio),
    },
  ]
  avisar()
}

export function cambiarCantidad(indice: number, cantidad: number) {
  const n = round2(cantidad)
  if (n <= 0) return quitar(indice)
  const it = items[indice]
  if (!it) return
  items[indice] = { ...it, cantidad: n, importe: round2(n * it.precio) }
  avisar()
}

export function cambiarPrecio(indice: number, precio: number) {
  const it = items[indice]
  if (!it) return
  const p = round2(precio)
  items[indice] = { ...it, precio: p, importe: round2(it.cantidad * p) }
  avisar()
}

export function quitar(indice: number) {
  items = items.filter((_, i) => i !== indice)
  avisar()
}

export function limpiarCarrito() {
  items = []
  avisar()
}
