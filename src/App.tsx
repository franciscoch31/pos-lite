import { useEffect, useState } from 'react'
import { cargarDatos, useListo, useProductos } from './lib/db'
import { useCarrito, piezasCarrito } from './lib/carrito'
import { getConfig } from './lib/config'
import Vender from './pages/Vender'
import Productos from './pages/Productos'
import Inventario from './pages/Inventario'
import Corte from './pages/Corte'
import Ajustes from './pages/Ajustes'

type Pestana = 'vender' | 'productos' | 'inventario' | 'corte' | 'ajustes'

const PESTANAS: { id: Pestana; icono: string; texto: string }[] = [
  { id: 'vender', icono: '🛒', texto: 'Vender' },
  { id: 'productos', icono: '📦', texto: 'Productos' },
  { id: 'inventario', icono: '🔄', texto: 'Entradas' },
  { id: 'corte', icono: '📊', texto: 'Corte' },
  { id: 'ajustes', icono: '⚙️', texto: 'Ajustes' },
]

const TITULOS: Record<Pestana, string> = {
  vender: 'Vender',
  productos: 'Productos',
  inventario: 'Entradas y salidas',
  corte: 'Corte del día',
  ajustes: 'Ajustes',
}

export default function App() {
  const [pestana, setPestana] = useState<Pestana>('vender')
  const listo = useListo()
  const carrito = useCarrito()
  const productos = useProductos()
  const [nombre, setNombre] = useState(getConfig().nombre)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cfg = getConfig()
  const bajos = cfg.controlarStock
    ? productos.filter((p) => p.activo && p.stock <= cfg.stockMinimo).length
    : 0
  const piezas = piezasCarrito(carrito)

  if (!listo) {
    return (
      <div className="app">
        <div className="vacio" style={{ marginTop: '40vh' }}>
          Abriendo…
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="encabezado">
        <h1>{nombre}</h1>
        <span className="apagado">{TITULOS[pestana]}</span>
      </header>

      <main className="contenido">
        {pestana === 'vender' && <Vender irA={setPestana} />}
        {pestana === 'productos' && <Productos />}
        {pestana === 'inventario' && <Inventario />}
        {pestana === 'corte' && <Corte />}
        {pestana === 'ajustes' && <Ajustes onNombre={setNombre} />}
      </main>

      <nav className="nav">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            className={pestana === p.id ? 'activo' : ''}
            onClick={() => setPestana(p.id)}
          >
            <span>{p.icono}</span>
            {p.texto}
            {p.id === 'vender' && piezas > 0 && <em className="globo">{piezas}</em>}
            {p.id === 'productos' && bajos > 0 && <em className="globo">{bajos}</em>}
          </button>
        ))}
      </nav>
    </div>
  )
}
