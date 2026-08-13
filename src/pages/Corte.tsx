import { useMemo, useState } from 'react'
import { Modal } from '../components/Modal'
import { anotarWhatsApp, cancelarVenta, useVentas } from '../lib/db'
import { getConfig } from '../lib/config'
import { claveDia, fechaLarga, hora, money, round2 } from '../lib/format'
import {
  compartir,
  enviarWhatsApp,
  imprimirTicket,
  telefonoValido,
  ticketTexto,
} from '../lib/ticket'
import type { Venta } from '../lib/types'

export default function Corte() {
  const ventas = useVentas()
  const [dia, setDia] = useState(claveDia())
  const [detalle, setDetalle] = useState<Venta | null>(null)

  const delDia = useMemo(
    () => ventas.filter((v) => claveDia(v.fecha) === dia),
    [ventas, dia],
  )
  const validas = delDia.filter((v) => !v.cancelada)

  const r = useMemo(() => {
    const total = round2(validas.reduce((s, v) => s + v.total, 0))
    const costo = round2(
      validas.reduce((s, v) => s + v.items.reduce((t, i) => t + i.costo * i.cantidad, 0), 0),
    )
    const por = (m: string) =>
      round2(validas.filter((v) => v.metodo === m).reduce((s, v) => s + v.total, 0))
    return {
      total,
      costo,
      utilidad: round2(total - costo),
      efectivo: por('efectivo'),
      otros: round2(por('tarjeta') + por('transferencia')),
      piezas: round2(
        validas.reduce((s, v) => s + v.items.reduce((t, i) => t + i.cantidad, 0), 0),
      ),
      promedio: validas.length ? round2(total / validas.length) : 0,
    }
  }, [validas])

  function textoCorte() {
    const c = getConfig()
    return [
      `*${c.nombre}* — Corte`,
      fechaLarga(dia),
      '--------------------------------',
      `Tickets: ${validas.length}`,
      `Piezas vendidas: ${r.piezas}`,
      `Efectivo: ${money(r.efectivo)}`,
      `Tarjeta/transferencia: ${money(r.otros)}`,
      `*VENTA TOTAL: ${money(r.total)}*`,
      `Utilidad estimada: ${money(r.utilidad)}`,
      `Ticket promedio: ${money(r.promedio)}`,
      delDia.length !== validas.length
        ? `Canceladas: ${delDia.length - validas.length}`
        : '',
    ]
      .filter(Boolean)
      .join('\n')
  }

  return (
    <>
      <input type="date" value={dia} max={claveDia()} onChange={(e) => setDia(e.target.value)} />
      <p className="apagado" style={{ margin: '8px 0 12px', textTransform: 'capitalize' }}>
        {fechaLarga(dia)}
      </p>

      <div className="mosaico">
        <div className="celda">
          <div className="k">Venta del día</div>
          <div className="v" style={{ color: 'var(--acento)' }}>
            {money(r.total)}
          </div>
        </div>
        <div className="celda">
          <div className="k">Tickets</div>
          <div className="v">{validas.length}</div>
        </div>
        <div className="celda">
          <div className="k">Efectivo en caja</div>
          <div className="v">{money(r.efectivo)}</div>
        </div>
        <div className="celda">
          <div className="k">Tarjeta / transfer.</div>
          <div className="v">{money(r.otros)}</div>
        </div>
        <div className="celda">
          <div className="k">Utilidad estimada</div>
          <div className="v">{money(r.utilidad)}</div>
        </div>
        <div className="celda">
          <div className="k">Ticket promedio</div>
          <div className="v">{money(r.promedio)}</div>
        </div>
      </div>

      <button
        className="btn btn-ancho"
        style={{ marginBottom: 14 }}
        onClick={() => compartir(textoCorte(), 'Corte del día')}
        disabled={validas.length === 0}
      >
        📤 Compartir corte
      </button>

      <div className="lista">
        {delDia.map((v) => (
          <button
            key={v.folio}
            className="reng"
            onClick={() => setDetalle(v)}
            style={{ opacity: v.cancelada ? 0.5 : 1 }}
          >
            <div className="crece">
              <div className="nom">
                Ticket #{v.folio} {v.cancelada && <span className="etiqueta">cancelado</span>}
              </div>
              <div className="sub">
                {hora(v.fecha)} · {v.items.length} artículo(s) · {v.metodo}
                {v.whatsapp ? ' · 📲' : ''}
              </div>
            </div>
            <span
              className="monto"
              style={{ textDecoration: v.cancelada ? 'line-through' : undefined }}
            >
              {money(v.total)}
            </span>
          </button>
        ))}
        {delDia.length === 0 && (
          <div className="vacio">
            <span className="emoji">🧾</span>
            No hay ventas este día.
          </div>
        )}
      </div>

      {detalle && <DetalleVenta venta={detalle} onClose={() => setDetalle(null)} />}
    </>
  )
}

function DetalleVenta({ venta, onClose }: { venta: Venta; onClose: () => void }) {
  const [tel, setTel] = useState(venta.whatsapp ?? '')
  const texto = ticketTexto(venta)

  function cancelar() {
    if (
      confirm(
        `¿Cancelar el ticket #${venta.folio} por ${money(venta.total)}?\n` +
          'La mercancía regresa al inventario y queda anotado.',
      )
    ) {
      cancelarVenta(venta.folio)
      onClose()
    }
  }

  return (
    <Modal titulo={`Ticket #${venta.folio}`} onClose={onClose}>
      {venta.cancelada && <p className="aviso aviso-mal">Este ticket está cancelado.</p>}

      <div className="lista">
        {venta.items.map((it, i) => (
          <div className="reng" key={i} style={{ cursor: 'default' }}>
            <div className="crece">
              <div className="nom">{it.nombre}</div>
              <div className="sub">
                {it.cantidad} x {money(it.precio)}
              </div>
            </div>
            <span className="monto">{money(it.importe)}</span>
          </div>
        ))}
      </div>

      <div className="tarjeta" style={{ marginTop: 12 }}>
        <div className="total-linea">
          <span className="apagado">Total</span>
          <span className="monto" style={{ fontSize: 22 }}>
            {money(venta.total)}
          </span>
        </div>
        <div className="apagado">
          {hora(venta.fecha)} · {venta.metodo}
          {venta.metodo === 'efectivo' &&
            ` · recibido ${money(venta.recibido)} · cambio ${money(venta.cambio)}`}
        </div>
      </div>

      <label>Reenviar ticket por WhatsApp</label>
      <div className="fila">
        <input
          type="tel"
          inputMode="numeric"
          value={tel}
          onChange={(e) => setTel(e.target.value)}
          placeholder="10 dígitos"
        />
        <button
          className="btn btn-ok"
          style={{ flex: 'none' }}
          disabled={!telefonoValido(tel)}
          onClick={() => {
            anotarWhatsApp(venta.folio, tel)
            enviarWhatsApp(tel, texto)
          }}
        >
          Enviar
        </button>
      </div>

      <div className="fila" style={{ marginTop: 12 }}>
        <button className="btn btn-ancho" onClick={() => compartir(texto, `Ticket #${venta.folio}`)}>
          📤 Compartir
        </button>
        <button className="btn btn-ancho" onClick={() => imprimirTicket(venta)}>
          🖨️ Imprimir
        </button>
      </div>

      {!venta.cancelada && (
        <button className="btn btn-mal btn-ancho" style={{ marginTop: 10 }} onClick={cancelar}>
          Cancelar este ticket
        </button>
      )}
    </Modal>
  )
}
