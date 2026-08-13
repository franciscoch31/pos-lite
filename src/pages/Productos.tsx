import { Suspense, lazy, useState } from 'react'
import { Modal } from '../components/Modal'
import { borrarProducto, guardarProducto, useProductos } from '../lib/db'
import { bip, useLector } from '../lib/lector'
import { getConfig } from '../lib/config'
import { money } from '../lib/format'
import type { Producto } from '../lib/types'

const CamaraScanner = lazy(() => import('../components/CamaraScanner'))

const VACIO: Producto = {
  id: '',
  codigo: '',
  nombre: '',
  precio: 0,
  costo: 0,
  stock: 0,
  activo: true,
  vendidos: 0,
}

export default function Productos() {
  const productos = useProductos()
  const [q, setQ] = useState('')
  const [soloBajos, setSoloBajos] = useState(false)
  const [editando, setEditando] = useState<Producto | null>(null)
  const cfg = getConfig()

  // Escanear en esta pantalla abre el producto para editarlo (o lo da de alta).
  useLector((codigo) => {
    if (editando) return
    const p = productos.find((x) => x.codigo === codigo)
    bip(!!p)
    setEditando(p ?? { ...VACIO, codigo })
  }, !editando)

  const texto = q.trim().toLowerCase()
  const lista = productos
    .filter((p) => !texto || p.nombre.toLowerCase().includes(texto) || p.codigo.includes(texto))
    .filter((p) => !soloBajos || p.stock <= cfg.stockMinimo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  const bajos = productos.filter((p) => p.activo && p.stock <= cfg.stockMinimo).length

  return (
    <>
      <div className="fila" style={{ marginBottom: 10 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto" />
        <button
          className="btn btn-ok"
          style={{ flex: 'none' }}
          onClick={() => setEditando({ ...VACIO })}
        >
          ＋
        </button>
      </div>

      {cfg.controlarStock && bajos > 0 && (
        <button
          className={soloBajos ? 'aviso aviso-ojo' : 'aviso aviso-ojo'}
          style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
          onClick={() => setSoloBajos((v) => !v)}
        >
          ⚠️ {bajos} producto(s) con existencia baja — {soloBajos ? 'ver todos' : 'ver cuáles'}
        </button>
      )}

      <p className="apagado" style={{ margin: '0 0 8px' }}>
        {lista.length} producto(s)
      </p>

      <div className="lista">
        {lista.map((p) => (
          <button key={p.id} className="reng" onClick={() => setEditando(p)}>
            <div className="crece">
              <div className="nom">
                {p.nombre} {!p.activo && <span className="etiqueta">inactivo</span>}
              </div>
              <div className="sub">
                {p.codigo || 'sin código'}
                {cfg.controlarStock && (
                  <>
                    {' · '}
                    <span style={{ color: p.stock <= cfg.stockMinimo ? '#fcd34d' : undefined }}>
                      {p.stock} en existencia
                    </span>
                  </>
                )}
              </div>
            </div>
            <span className="monto">{money(p.precio)}</span>
          </button>
        ))}
        {lista.length === 0 && (
          <div className="vacio">
            <span className="emoji">📦</span>
            {productos.length === 0
              ? 'Aún no hay productos. Toca ＋ o escanea un código para dar de alta el primero.'
              : 'Nada con ese nombre.'}
          </div>
        )}
      </div>

      {editando && <EditorProducto producto={editando} onClose={() => setEditando(null)} />}
    </>
  )
}

function EditorProducto({ producto, onClose }: { producto: Producto; onClose: () => void }) {
  const [f, setF] = useState<Producto>(producto)
  const [camara, setCamara] = useState(false)
  const nuevo = !f.id

  // Con el editor abierto, el lector llena el campo de código.
  useLector((codigo) => {
    bip(true)
    setF((x) => ({ ...x, codigo }))
  }, !camara)

  const set = <K extends keyof Producto>(k: K, v: Producto[K]) => setF((x) => ({ ...x, [k]: v }))

  function guardar() {
    guardarProducto({
      id: f.id || undefined,
      codigo: f.codigo.trim(),
      nombre: f.nombre.trim(),
      precio: Number(f.precio) || 0,
      costo: Number(f.costo) || 0,
      stock: Number(f.stock) || 0,
      activo: f.activo,
    })
    onClose()
  }

  function eliminar() {
    if (confirm(`¿Borrar "${f.nombre}"? El historial de ventas no se toca.`)) {
      borrarProducto(f.id)
      onClose()
    }
  }

  const margen = f.costo > 0 ? Math.round(((f.precio - f.costo) / f.costo) * 100) : null

  return (
    <>
      <Modal titulo={nuevo ? 'Nuevo producto' : 'Editar producto'} onClose={onClose}>
        <label>Código de barras</label>
        <div className="fila">
          <input
            value={f.codigo}
            onChange={(e) => set('codigo', e.target.value)}
            placeholder="Escanéalo o déjalo vacío"
            inputMode="numeric"
          />
          <button className="btn" style={{ flex: 'none' }} onClick={() => setCamara(true)}>
            📷
          </button>
        </div>

        <label>Nombre</label>
        <input autoFocus={!f.nombre} value={f.nombre} onChange={(e) => set('nombre', e.target.value)} />

        <div className="fila">
          <div style={{ flex: 1 }}>
            <label>Precio de venta</label>
            <input
              type="number"
              inputMode="decimal"
              value={f.precio || ''}
              onChange={(e) => set('precio', Number(e.target.value))}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label>Costo</label>
            <input
              type="number"
              inputMode="decimal"
              value={f.costo || ''}
              onChange={(e) => set('costo', Number(e.target.value))}
            />
          </div>
        </div>
        {margen !== null && (
          <p className="apagado">
            Ganas {money(f.precio - f.costo)} por pieza ({margen}%).
          </p>
        )}

        <label>Existencia</label>
        <input
          type="number"
          inputMode="numeric"
          value={f.stock || ''}
          onChange={(e) => set('stock', Number(e.target.value))}
        />
        <p className="apagado">
          Cambiarla aquí queda anotado como ajuste. Para surtido usa Entradas y salidas.
        </p>

        <div className="check">
          <input
            id="activo"
            type="checkbox"
            checked={f.activo}
            onChange={(e) => set('activo', e.target.checked)}
          />
          <label htmlFor="activo" style={{ margin: 0 }}>
            Se puede vender
          </label>
        </div>

        <button
          className="btn btn-ok btn-ancho btn-grande"
          style={{ marginTop: 8 }}
          disabled={!f.nombre.trim()}
          onClick={guardar}
        >
          Guardar
        </button>
        {!nuevo && (
          <button className="btn btn-mal btn-ancho" style={{ marginTop: 8 }} onClick={eliminar}>
            Borrar producto
          </button>
        )}
      </Modal>

      {camara && (
        <Suspense fallback={null}>
          <CamaraScanner
            onCodigo={(c) => {
              set('codigo', c)
              setCamara(false)
            }}
            onClose={() => setCamara(false)}
          />
        </Suspense>
      )}
    </>
  )
}
