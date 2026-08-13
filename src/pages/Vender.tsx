import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Modal } from '../components/Modal'
import { CobroModal, TicketModal } from './Cobro'
import { buscarPorCodigo, guardarProducto, useProductos } from '../lib/db'
import {
  agregarProducto,
  agregarSuelto,
  cambiarCantidad,
  limpiarCarrito,
  quitar,
  totalCarrito,
  useCarrito,
} from '../lib/carrito'
import { bip, useLector } from '../lib/lector'
import { getConfig } from '../lib/config'
import { money } from '../lib/format'
import type { Producto, Venta } from '../lib/types'

const CamaraScanner = lazy(() => import('../components/CamaraScanner'))

export default function Vender({ irA }: { irA: (p: 'productos') => void }) {
  const productos = useProductos()
  const carrito = useCarrito()
  const cajaCodigo = useRef<HTMLInputElement>(null)
  const [codigo, setCodigo] = useState('')
  const [camara, setCamara] = useState(false)
  const [buscar, setBuscar] = useState(false)
  const [suelto, setSuelto] = useState(false)
  const [alta, setAlta] = useState<string | null>(null) // código sin registrar
  const [cobrando, setCobrando] = useState(false)
  const [ticket, setTicket] = useState<Venta | null>(null)
  const [aviso, setAviso] = useState('')

  const cfg = getConfig()
  const total = totalCarrito(carrito)
  const hayModal = camara || buscar || suelto || alta !== null || cobrando || ticket !== null

  // El lector Bluetooth escribe aunque el foco no esté en la caja de código.
  useLector(procesar, !hayModal)

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(''), 3500)
    return () => clearTimeout(t)
  }, [aviso])

  function procesar(valor: string) {
    const c = valor.trim()
    setCodigo('')
    if (!c) return
    const p = buscarPorCodigo(c)
    if (!p) {
      bip(false)
      setAlta(c)
      return
    }
    if (cfg.controlarStock && p.stock <= 0) setAviso(`⚠️ ${p.nombre} está en ceros`)
    bip(true)
    agregarProducto(p)
  }

  function alCobrar(v: Venta) {
    limpiarCarrito()
    setCobrando(false)
    setTicket(v)
  }

  const masVendidos = [...productos]
    .filter((p) => p.activo)
    .sort((a, b) => b.vendidos - a.vendidos)
    .slice(0, 12)

  return (
    <>
      <div className="barra-codigo">
        <input
          ref={cajaCodigo}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              procesar(codigo)
            }
          }}
          placeholder="Escanea o teclea el código"
          autoFocus
          autoComplete="off"
          enterKeyHint="done"
        />
        <button className="btn" onClick={() => setCamara(true)} title="Escanear con la cámara">
          📷
        </button>
      </div>

      {aviso && <p className="aviso aviso-ojo">{aviso}</p>}

      <div className="fila" style={{ marginBottom: 12 }}>
        <button className="btn btn-ancho" onClick={() => setBuscar(true)}>
          🔎 Buscar
        </button>
        <button className="btn btn-ancho" onClick={() => setSuelto(true)}>
          ＄ Monto libre
        </button>
      </div>

      {carrito.length === 0 ? (
        masVendidos.length === 0 ? (
          <div className="vacio">
            <span className="emoji">📦</span>
            Todavía no hay productos.
            <br />
            <button className="btn" style={{ marginTop: 12 }} onClick={() => irA('productos')}>
              Dar de alta el primero
            </button>
          </div>
        ) : (
          <>
            <p className="apagado" style={{ margin: '0 0 8px' }}>
              Los que más se venden — toca para agregar
            </p>
            <div className="rejilla">
              {masVendidos.map((p) => (
                <button
                  key={p.id}
                  className="cuadro"
                  onClick={() => {
                    bip(true)
                    agregarProducto(p)
                  }}
                >
                  <span className="n">{p.nombre}</span>
                  <span className="p">{money(p.precio)}</span>
                </button>
              ))}
            </div>
          </>
        )
      ) : (
        <div className="lista">
          {carrito.map((it, i) => (
            <div className="reng" key={`${it.producto_id ?? 'x'}-${i}`}>
              <div className="crece">
                <div className="nom">{it.nombre}</div>
                <div className="sub">
                  {money(it.precio)} c/u · {money(it.importe)}
                </div>
              </div>
              <div className="cant">
                <button onClick={() => cambiarCantidad(i, it.cantidad - 1)}>−</button>
                <span className="num">{it.cantidad}</span>
                <button onClick={() => cambiarCantidad(i, it.cantidad + 1)}>+</button>
              </div>
              <button className="icono" onClick={() => quitar(i)} aria-label="Quitar">
                🗑
              </button>
            </div>
          ))}
        </div>
      )}

      {carrito.length > 0 && (
        <div className="pie-cobro">
          <div className="total-linea">
            <span className="apagado">Total</span>
            <span className="grande">{money(total)}</span>
          </div>
          <div className="fila">
            <button className="btn btn-mal" onClick={() => confirmarLimpiar()}>
              Cancelar
            </button>
            <button className="btn btn-ok btn-ancho btn-grande" onClick={() => setCobrando(true)}>
              Cobrar
            </button>
          </div>
        </div>
      )}

      {camara && (
        <Suspense fallback={null}>
          <CamaraScanner
            onCodigo={(c) => {
              setCamara(false)
              procesar(c)
            }}
            onClose={() => setCamara(false)}
          />
        </Suspense>
      )}

      {buscar && (
        <BuscarModal
          productos={productos}
          onClose={() => {
            setBuscar(false)
            cajaCodigo.current?.focus()
          }}
        />
      )}

      {suelto && <SueltoModal onClose={() => setSuelto(false)} />}

      {alta !== null && (
        <AltaRapidaModal
          codigo={alta}
          onClose={() => setAlta(null)}
          onListo={(p) => {
            setAlta(null)
            agregarProducto(p)
          }}
        />
      )}

      {cobrando && (
        <CobroModal items={carrito} onCobrado={alCobrar} onClose={() => setCobrando(false)} />
      )}

      {ticket && (
        <TicketModal
          venta={ticket}
          onCerrar={() => {
            setTicket(null)
            cajaCodigo.current?.focus()
          }}
        />
      )}
    </>
  )

  function confirmarLimpiar() {
    if (confirm('¿Cancelar la venta y vaciar el carrito?')) limpiarCarrito()
  }
}

// ------------------------------------------------------------------ modales

function BuscarModal({ productos, onClose }: { productos: Producto[]; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [agregados, setAgregados] = useState(0)
  const texto = q.trim().toLowerCase()
  const lista = productos
    .filter((p) => p.activo)
    .filter((p) => !texto || p.nombre.toLowerCase().includes(texto) || p.codigo.includes(texto))
    .slice(0, 60)

  return (
    <Modal titulo="Buscar producto" onClose={onClose} completa>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Nombre o código"
      />
      <div className="lista" style={{ marginTop: 12 }}>
        {lista.map((p) => (
          <button
            key={p.id}
            className="reng"
            onClick={() => {
              bip(true)
              agregarProducto(p)
              setAgregados((n) => n + 1)
            }}
          >
            <div className="crece">
              <div className="nom">{p.nombre}</div>
              <div className="sub">
                {p.codigo || 'sin código'} · existencia {p.stock}
              </div>
            </div>
            <span className="monto">{money(p.precio)}</span>
          </button>
        ))}
        {lista.length === 0 && <p className="vacio">Nada con ese nombre.</p>}
      </div>
      <button className="btn btn-ok btn-ancho btn-grande" style={{ marginTop: 12 }} onClick={onClose}>
        Listo{agregados > 0 ? ` (${agregados})` : ''}
      </button>
    </Modal>
  )
}

function SueltoModal({ onClose }: { onClose: () => void }) {
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState<number | ''>('')

  return (
    <Modal titulo="Cobrar un monto libre" onClose={onClose}>
      <p className="apagado">Para algo que no está en el catálogo.</p>
      <label>Concepto</label>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Varios" />
      <label>Importe</label>
      <input
        type="number"
        inputMode="decimal"
        autoFocus
        value={precio}
        onChange={(e) => setPrecio(e.target.value === '' ? '' : Number(e.target.value))}
      />
      <button
        className="btn btn-ok btn-ancho btn-grande"
        style={{ marginTop: 14 }}
        disabled={!precio || precio <= 0}
        onClick={() => {
          agregarSuelto(nombre, Number(precio))
          onClose()
        }}
      >
        Agregar
      </button>
    </Modal>
  )
}

function AltaRapidaModal({
  codigo,
  onListo,
  onClose,
}: {
  codigo: string
  onListo: (p: Producto) => void
  onClose: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState<number | ''>('')
  const [costo, setCosto] = useState<number | ''>('')
  const [stock, setStock] = useState<number | ''>('')

  return (
    <Modal titulo="Producto no registrado" onClose={onClose}>
      <p className="aviso aviso-ojo">
        El código <b>{codigo}</b> no está en el catálogo. Dalo de alta aquí mismo y sigue vendiendo.
      </p>
      <label>Nombre</label>
      <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <div className="fila">
        <div style={{ flex: 1 }}>
          <label>Precio de venta</label>
          <input
            type="number"
            inputMode="decimal"
            value={precio}
            onChange={(e) => setPrecio(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label>Costo (opcional)</label>
          <input
            type="number"
            inputMode="decimal"
            value={costo}
            onChange={(e) => setCosto(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>
      </div>
      <label>Existencia inicial</label>
      <input
        type="number"
        inputMode="numeric"
        value={stock}
        onChange={(e) => setStock(e.target.value === '' ? '' : Number(e.target.value))}
        placeholder="0"
      />
      <button
        className="btn btn-ok btn-ancho btn-grande"
        style={{ marginTop: 14 }}
        disabled={!nombre.trim() || !precio || precio <= 0}
        onClick={() =>
          onListo(
            guardarProducto({
              codigo,
              nombre: nombre.trim(),
              precio: Number(precio),
              costo: Number(costo) || 0,
              stock: Number(stock) || 0,
              activo: true,
            }),
          )
        }
      >
        Guardar y agregar
      </button>
    </Modal>
  )
}
