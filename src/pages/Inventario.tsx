import { Suspense, lazy, useMemo, useState } from 'react'
import { Modal } from '../components/Modal'
import { moverExistencia, useMovimientos, useProductos } from '../lib/db'
import { bip, useLector } from '../lib/lector'
import { fechaHora, money, round2 } from '../lib/format'
import type { Movimiento, Producto, TipoMovimiento } from '../lib/types'

const CamaraScanner = lazy(() => import('../components/CamaraScanner'))

type TipoManual = 'entrada' | 'salida' | 'merma'

const ETIQUETA: Record<TipoMovimiento, { texto: string; clase: string }> = {
  entrada: { texto: 'Entrada', clase: 'et-entrada' },
  salida: { texto: 'Salida', clase: 'et-salida' },
  merma: { texto: 'Merma', clase: 'et-salida' },
  venta: { texto: 'Venta', clase: 'et-salida' },
  ajuste: { texto: 'Ajuste', clase: 'et-neutra' },
  cancelacion: { texto: 'Cancelación', clase: 'et-entrada' },
}

const FILTROS: { id: 'todo' | 'entra' | 'sale'; texto: string }[] = [
  { id: 'todo', texto: 'Todo' },
  { id: 'entra', texto: 'Entradas' },
  { id: 'sale', texto: 'Salidas' },
]

export default function Inventario() {
  const productos = useProductos()
  const movimientos = useMovimientos()
  const [filtro, setFiltro] = useState<'todo' | 'entra' | 'sale'>('todo')
  const [q, setQ] = useState('')
  const [captura, setCaptura] = useState<TipoManual | null>(null)

  const resumen = useMemo(() => {
    const activos = productos.filter((p) => p.activo)
    return {
      piezas: round2(activos.reduce((s, p) => s + p.stock, 0)),
      costo: round2(activos.reduce((s, p) => s + p.stock * p.costo, 0)),
      venta: round2(activos.reduce((s, p) => s + p.stock * p.precio, 0)),
    }
  }, [productos])

  const texto = q.trim().toLowerCase()
  const lista = movimientos
    .filter((m) => (filtro === 'todo' ? true : filtro === 'entra' ? m.cantidad > 0 : m.cantidad < 0))
    .filter((m) => !texto || m.nombre.toLowerCase().includes(texto) || m.codigo.includes(texto))
    .slice(0, 200)

  return (
    <>
      <div className="mosaico">
        <div className="celda">
          <div className="k">Piezas en existencia</div>
          <div className="v">{resumen.piezas}</div>
        </div>
        <div className="celda">
          <div className="k">Invertido (a costo)</div>
          <div className="v">{money(resumen.costo)}</div>
        </div>
      </div>

      <div className="fila" style={{ marginBottom: 14 }}>
        <button className="btn btn-ok btn-ancho" onClick={() => setCaptura('entrada')}>
          ⬇️ Entrada
        </button>
        <button className="btn btn-ancho" onClick={() => setCaptura('salida')}>
          ⬆️ Salida
        </button>
        <button className="btn btn-ancho" onClick={() => setCaptura('merma')}>
          🗑 Merma
        </button>
      </div>

      <div className="chips" style={{ marginBottom: 10 }}>
        {FILTROS.map((f) => (
          <button key={f.id} className={filtro === f.id ? 'on' : ''} onClick={() => setFiltro(f.id)}>
            {f.texto}
          </button>
        ))}
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar en el historial"
        style={{ marginBottom: 10 }}
      />

      <div className="lista">
        {lista.map((m) => (
          <Renglon key={m.id} m={m} />
        ))}
        {lista.length === 0 && (
          <div className="vacio">
            <span className="emoji">🔄</span>
            Sin movimientos todavía.
            <br />
            Cada venta, entrada de surtido o merma queda registrada aquí.
          </div>
        )}
      </div>
      {movimientos.length > lista.length && (
        <p className="apagado centro" style={{ marginTop: 10 }}>
          Mostrando los 200 más recientes.
        </p>
      )}

      {captura && (
        <CapturaMovimiento tipo={captura} productos={productos} onClose={() => setCaptura(null)} />
      )}
    </>
  )
}

function Renglon({ m }: { m: Movimiento }) {
  const et = ETIQUETA[m.tipo]
  return (
    <div className="reng" style={{ cursor: 'default' }}>
      <div className="crece">
        <div className="nom">{m.nombre}</div>
        <div className="sub">
          <span className={`etiqueta ${et.clase}`}>{et.texto}</span> {fechaHora(m.fecha)}
          {m.motivo ? ` · ${m.motivo}` : ''}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="monto" style={{ color: m.cantidad > 0 ? '#86efac' : '#fca5a5' }}>
          {m.cantidad > 0 ? '+' : ''}
          {m.cantidad}
        </div>
        <div className="sub">quedan {m.stock_resultante}</div>
      </div>
    </div>
  )
}

function CapturaMovimiento({
  tipo,
  productos,
  onClose,
}: {
  tipo: TipoManual
  productos: Producto[]
  onClose: () => void
}) {
  const [elegido, setElegido] = useState<Producto | null>(null)
  const [q, setQ] = useState('')
  const [cantidad, setCantidad] = useState<number | ''>('')
  const [motivo, setMotivo] = useState('')
  const [camara, setCamara] = useState(false)

  const titulo = tipo === 'entrada' ? 'Entrada de mercancía' : tipo === 'salida' ? 'Salida' : 'Merma'

  function porCodigo(codigo: string) {
    const p = productos.find((x) => x.codigo === codigo)
    bip(!!p)
    if (p) setElegido(p)
    else alert(`El código ${codigo} no está en el catálogo. Da de alta el producto primero.`)
  }

  useLector(porCodigo, !elegido && !camara)

  const texto = q.trim().toLowerCase()
  const lista = productos
    .filter((p) => !texto || p.nombre.toLowerCase().includes(texto) || p.codigo.includes(texto))
    .slice(0, 40)

  function guardar() {
    if (!elegido || !cantidad) return
    moverExistencia(elegido.id, tipo, Number(cantidad), motivo.trim())
    onClose()
  }

  return (
    <>
      <Modal titulo={titulo} onClose={onClose} completa>
        {!elegido ? (
          <>
            <p className="apagado">Escanea el producto o búscalo por nombre.</p>
            <div className="fila">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nombre o código"
              />
              <button className="btn" style={{ flex: 'none' }} onClick={() => setCamara(true)}>
                📷
              </button>
            </div>
            <div className="lista" style={{ marginTop: 12 }}>
              {lista.map((p) => (
                <button key={p.id} className="reng" onClick={() => setElegido(p)}>
                  <div className="crece">
                    <div className="nom">{p.nombre}</div>
                    <div className="sub">
                      {p.codigo || 'sin código'} · {p.stock} en existencia
                    </div>
                  </div>
                  <span className="monto">{money(p.precio)}</span>
                </button>
              ))}
              {lista.length === 0 && <p className="vacio">Nada con ese nombre.</p>}
            </div>
          </>
        ) : (
          <>
            <div className="tarjeta">
              <div className="nom">{elegido.nombre}</div>
              <div className="sub apagado">
                {elegido.codigo || 'sin código'} · hoy hay {elegido.stock}
              </div>
              <button className="btn" style={{ marginTop: 10 }} onClick={() => setElegido(null)}>
                Cambiar producto
              </button>
            </div>

            <label>¿Cuántas piezas {tipo === 'entrada' ? 'entran' : 'salen'}?</label>
            <input
              type="number"
              inputMode="decimal"
              autoFocus
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value === '' ? '' : Number(e.target.value))}
            />

            <label>Motivo</label>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={
                tipo === 'entrada'
                  ? 'Surtido, compra, devolución…'
                  : tipo === 'merma'
                    ? 'Caducado, dañado…'
                    : 'Traspaso, consumo interno…'
              }
            />

            {cantidad !== '' && (
              <p className="apagado" style={{ marginTop: 10 }}>
                Queda en{' '}
                <b>
                  {round2(
                    elegido.stock + (tipo === 'entrada' ? Number(cantidad) : -Number(cantidad)),
                  )}
                </b>{' '}
                piezas.
              </p>
            )}

            <button
              className="btn btn-ok btn-ancho btn-grande"
              style={{ marginTop: 12 }}
              disabled={!cantidad || Number(cantidad) <= 0}
              onClick={guardar}
            >
              Registrar {titulo.toLowerCase()}
            </button>
          </>
        )}
      </Modal>

      {camara && (
        <Suspense fallback={null}>
          <CamaraScanner
            onCodigo={(c) => {
              setCamara(false)
              porCodigo(c)
            }}
            onClose={() => setCamara(false)}
          />
        </Suspense>
      )}
    </>
  )
}
