import { getConfig } from './config'
import { fechaHora, money } from './format'
import type { Venta } from './types'

const metodoLabel: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
}

/** Ticket en texto plano, para WhatsApp o para compartir. */
export function ticketTexto(v: Venta): string {
  const c = getConfig()
  const L: string[] = []
  L.push(`*${c.nombre}*`)
  if (c.direccion) L.push(c.direccion)
  if (c.telefono) L.push(`Tel: ${c.telefono}`)
  L.push('--------------------------------')
  L.push(`Ticket #${v.folio}`)
  L.push(fechaHora(v.fecha))
  L.push('--------------------------------')
  for (const it of v.items) {
    L.push(`${it.cantidad} x ${it.nombre}`)
    L.push(`     ${money(it.precio)}     ${money(it.importe)}`)
  }
  L.push('--------------------------------')
  L.push(`*TOTAL: ${money(v.total)}*`)
  L.push(`Pago: ${metodoLabel[v.metodo] ?? v.metodo}`)
  if (v.metodo === 'efectivo') {
    L.push(`Recibido: ${money(v.recibido)}`)
    L.push(`Cambio: ${money(v.cambio)}`)
  }
  L.push('--------------------------------')
  L.push(c.mensajeTicket || '¡Gracias por su compra!')
  return L.join('\n')
}

/**
 * Normaliza a formato wa.me. Acepta lo que sea que teclee el encargado:
 * "5512345678", "55 1234 5678", "+52 55...", "044...".
 */
export function normalizarTelefono(tel: string): string {
  let d = tel.replace(/\D/g, '')
  if (d.startsWith('044') || d.startsWith('045')) d = d.slice(3)
  if (d.length === 10) d = '52' + d // México por defecto
  return d
}

export function telefonoValido(tel: string): boolean {
  const d = normalizarTelefono(tel)
  return d.length >= 10 && d.length <= 15
}

/**
 * Abre WhatsApp con el ticket ya escrito. No requiere que el cliente esté
 * registrado: el número se captura en el momento y no se guarda como cliente.
 */
export function enviarWhatsApp(telefono: string, texto: string) {
  const t = normalizarTelefono(telefono)
  window.open(`https://wa.me/${t}?text=${encodeURIComponent(texto)}`, '_blank')
}

/** Hoja de compartir del teléfono (WhatsApp, correo, lo que tenga instalado). */
export async function compartir(texto: string, titulo = 'Ticket') {
  if (navigator.share) {
    try {
      await navigator.share({ title: titulo, text: texto })
      return true
    } catch {
      return false // el usuario canceló
    }
  }
  await navigator.clipboard?.writeText(texto)
  return true
}

/** Ventana lista para imprimir en térmica de 58/80 mm. */
export function imprimirTicket(v: Venta) {
  const c = getConfig()
  const filas = v.items
    .map(
      (it) =>
        `<tr><td>${it.cantidad} x ${esc(it.nombre)}</td><td class="r">${money(it.importe)}</td></tr>`,
    )
    .join('')

  const html = `<!doctype html><html><head><meta charset="utf-8">
  <title>Ticket #${v.folio}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { font-family: 'Courier New', monospace; }
    body { width: 72mm; font-size: 12px; color:#000; }
    h1 { font-size: 14px; text-align:center; margin: 0 0 2px; }
    .c { text-align:center; } .r { text-align:right; }
    hr { border:none; border-top:1px dashed #000; }
    table { width:100%; border-collapse:collapse; }
    td { vertical-align:top; padding:1px 0; }
    .tot { font-weight:bold; font-size:13px; }
  </style></head><body>
    <h1>${esc(c.nombre)}</h1>
    ${c.direccion ? `<div class="c">${esc(c.direccion)}</div>` : ''}
    ${c.telefono ? `<div class="c">Tel: ${esc(c.telefono)}</div>` : ''}
    <hr>
    <div>Ticket #${v.folio}</div>
    <div>${fechaHora(v.fecha)}</div>
    <hr>
    <table>${filas}</table>
    <hr>
    <table>
      <tr class="tot"><td>TOTAL</td><td class="r">${money(v.total)}</td></tr>
      <tr><td>${metodoLabel[v.metodo]}</td><td class="r"></td></tr>
      ${
        v.metodo === 'efectivo'
          ? `<tr><td>Recibido</td><td class="r">${money(v.recibido)}</td></tr>
             <tr><td>Cambio</td><td class="r">${money(v.cambio)}</td></tr>`
          : ''
      }
    </table>
    <hr>
    <div class="c">${esc(c.mensajeTicket || '¡Gracias por su compra!')}</div>
    <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 300) }<\/script>
  </body></html>`

  const w = window.open('', '_blank', 'width=380,height=600')
  if (!w) {
    alert('Permite las ventanas emergentes para imprimir el ticket.')
    return
  }
  w.document.write(html)
  w.document.close()
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (ch) =>
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&quot;',
  )
}
