import { useState } from 'react'
import { Modal } from '../components/Modal'
import { money, round2 } from '../lib/format'
import { anotarWhatsApp, registrarVenta } from '../lib/db'
import { getConfig } from '../lib/config'
import { compartir, enviarWhatsApp, imprimirTicket, telefonoValido, ticketTexto } from '../lib/ticket'
import type { ItemVenta, MetodoPago, Venta } from '../lib/types'

const DENOMINACIONES = [20, 50, 100, 200, 500, 1000]

interface CobroProps {
  items: ItemVenta[]
  onCobrado: (v: Venta) => void
  onClose: () => void
}

/** Pantalla de cobro: método de pago y, en efectivo, el cambio. */
export function CobroModal({ items, onCobrado, onClose }: CobroProps) {
  const total = round2(items.reduce((s, i) => s + i.importe, 0))
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [recibido, setRecibido] = useState<number | ''>('')

  const efectivo = metodo === 'efectivo'
  const monto = typeof recibido === 'number' ? recibido : 0
  const cambio = round2(Math.max(0, monto - total))
  const alcanza = !efectivo || monto >= total

  // Solo billetes con los que sí se puede pagar (más el "exacto").
  const sugeridos = DENOMINACIONES.filter((d) => d > total).slice(0, 5)

  function cobrar() {
    if (!alcanza) return
    onCobrado(registrarVenta(items, metodo, efectivo ? monto : total))
  }

  return (
    <Modal titulo={`Cobrar ${money(total)}`} onClose={onClose}>
      <div className="chips">
        {(['efectivo', 'tarjeta', 'transferencia'] as MetodoPago[]).map((m) => (
          <button
            key={m}
            className={metodo === m ? 'on' : ''}
            onClick={() => setMetodo(m)}
          >
            {m === 'efectivo' ? '💵 Efectivo' : m === 'tarjeta' ? '💳 Tarjeta' : '🏦 Transfer.'}
          </button>
        ))}
      </div>

      {efectivo && (
        <>
          <label>¿Con cuánto paga?</label>
          <input
            type="number"
            inputMode="decimal"
            autoFocus
            placeholder={String(total)}
            value={recibido}
            onChange={(e) => setRecibido(e.target.value === '' ? '' : Number(e.target.value))}
          />
          <div className="billetes">
            <button className="btn" onClick={() => setRecibido(total)}>
              Exacto
            </button>
            {sugeridos.map((d) => (
              <button key={d} className="btn" onClick={() => setRecibido(d)}>
                ${d}
              </button>
            ))}
          </div>

          <div className="cambio-caja">
            <div className="apagado">Cambio</div>
            <div className="n">{money(cambio)}</div>
            {!alcanza && monto > 0 && (
              <div className="apagado">Faltan {money(round2(total - monto))}</div>
            )}
          </div>
        </>
      )}

      <button className="btn btn-ok btn-ancho btn-grande" disabled={!alcanza} onClick={cobrar}>
        Cobrar {money(total)}
      </button>
    </Modal>
  )
}

interface TicketProps {
  venta: Venta
  onCerrar: () => void
}

/** Confirmación de la venta: cambio a la vista y envío del ticket. */
export function TicketModal({ venta, onCerrar }: TicketProps) {
  const cfg = getConfig()
  const [tel, setTel] = useState('')
  const [enviado, setEnviado] = useState(false)
  const texto = ticketTexto(venta)

  function mandar() {
    if (!telefonoValido(tel)) return
    anotarWhatsApp(venta.folio, tel)
    enviarWhatsApp(tel, texto)
    setEnviado(true)
  }

  return (
    <Modal titulo={`Ticket #${venta.folio}`} onClose={onCerrar}>
      {venta.metodo === 'efectivo' && (
        <div className="cambio-caja">
          <div className="apagado">Cambio para el cliente</div>
          <div className="n">{money(venta.cambio)}</div>
          <div className="apagado">
            Total {money(venta.total)} · recibido {money(venta.recibido)}
          </div>
        </div>
      )}

      {cfg.pedirWhatsApp && (
        <>
          <label>Mandar ticket por WhatsApp (opcional)</label>
          <div className="fila">
            <input
              type="tel"
              inputMode="numeric"
              placeholder="10 dígitos"
              value={tel}
              onChange={(e) => setTel(e.target.value)}
            />
            <button
              className="btn btn-ok"
              style={{ flex: 'none' }}
              disabled={!telefonoValido(tel)}
              onClick={mandar}
            >
              Enviar
            </button>
          </div>
          <p className="apagado" style={{ marginTop: 6 }}>
            {enviado
              ? '✅ Se abrió WhatsApp con el ticket.'
              : 'No hace falta registrar al cliente: se teclea el número y ya.'}
          </p>
        </>
      )}

      <div className="fila" style={{ marginTop: 14 }}>
        <button className="btn btn-ancho" onClick={() => compartir(texto, `Ticket #${venta.folio}`)}>
          📤 Compartir
        </button>
        <button className="btn btn-ancho" onClick={() => imprimirTicket(venta)}>
          🖨️ Imprimir
        </button>
      </div>

      <button
        className="btn btn-ok btn-ancho btn-grande"
        style={{ marginTop: 10 }}
        onClick={onCerrar}
      >
        Nueva venta
      </button>
    </Modal>
  )
}
