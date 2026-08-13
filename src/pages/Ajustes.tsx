import { useRef, useState } from 'react'
import { getConfig, saveConfig } from '../lib/config'
import {
  armarRespaldo,
  borrarTodo,
  guardadoTerminado,
  limpiarHistorial,
  restaurarRespaldo,
  useMovimientos,
  useProductos,
  useVentas,
} from '../lib/db'
import { bip, useLector } from '../lib/lector'
import { claveDia, fechaHora } from '../lib/format'
import type { Config } from '../lib/types'

export default function Ajustes({ onNombre }: { onNombre: (n: string) => void }) {
  const [cfg, setCfg] = useState<Config>(getConfig())
  const productos = useProductos()
  const ventas = useVentas()
  const movimientos = useMovimientos()
  const archivo = useRef<HTMLInputElement>(null)
  const [ultimoCodigo, setUltimoCodigo] = useState('')
  const [msg, setMsg] = useState('')

  function set<K extends keyof Config>(k: K, v: Config[K]) {
    const next = saveConfig({ [k]: v } as Partial<Config>)
    setCfg({ ...next })
    if (k === 'nombre') onNombre(next.nombre)
  }

  useLector((c) => {
    bip(true)
    setUltimoCodigo(c)
  })

  async function exportar() {
    await guardadoTerminado()
    const datos = JSON.stringify(armarRespaldo(), null, 2)
    const url = URL.createObjectURL(new Blob([datos], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `respaldo-pos-${claveDia()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMsg('Respaldo descargado. Mándalo a tu correo o al Drive.')
  }

  async function importar(f: File) {
    try {
      const r = JSON.parse(await f.text())
      if (
        !confirm(
          `El respaldo trae ${r.productos?.length ?? 0} productos y ${r.ventas?.length ?? 0} tickets.\n` +
            'Se REEMPLAZA todo lo que hay ahora. ¿Continuar?',
        )
      )
        return
      await restaurarRespaldo(r)
      setMsg('Respaldo restaurado.')
    } catch (e) {
      setMsg(`No se pudo leer el archivo: ${(e as Error).message}`)
    }
  }

  return (
    <>
      {msg && <p className="aviso aviso-ojo">{msg}</p>}

      <div className="tarjeta">
        <h3>El negocio</h3>
        <label>Nombre (sale en el ticket)</label>
        <input value={cfg.nombre} onChange={(e) => set('nombre', e.target.value)} />
        <label>Dirección o ubicación</label>
        <input
          value={cfg.direccion}
          onChange={(e) => set('direccion', e.target.value)}
          placeholder="Planta, área, etc."
        />
        <label>Teléfono</label>
        <input
          value={cfg.telefono}
          onChange={(e) => set('telefono', e.target.value)}
          inputMode="tel"
        />
        <label>Mensaje al pie del ticket</label>
        <input value={cfg.mensajeTicket} onChange={(e) => set('mensajeTicket', e.target.value)} />
      </div>

      <div className="tarjeta">
        <h3>Lector de código de barras</h3>
        <p className="apagado">
          Empareja el lector por Bluetooth como <b>teclado (HID)</b> en los ajustes del teléfono. No
          hace falta configurar nada más aquí: la app lo detecta solo.
        </p>
        <div className="check">
          <input
            id="enter"
            type="checkbox"
            checked={cfg.sufijoEnter}
            onChange={(e) => set('sufijoEnter', e.target.checked)}
          />
          <label htmlFor="enter" style={{ margin: 0 }}>
            El lector manda Enter al final (lo normal)
          </label>
        </div>
        <div className="check">
          <input
            id="sonido"
            type="checkbox"
            checked={cfg.sonido}
            onChange={(e) => set('sonido', e.target.checked)}
          />
          <label htmlFor="sonido" style={{ margin: 0 }}>
            Bip y vibración al escanear
          </label>
        </div>
        <p className="apagado" style={{ marginTop: 10 }}>
          Prueba: dispara el lector aquí (sin tocar ningún campo).
        </p>
        <div className="tarjeta" style={{ margin: 0, background: 'var(--panel2)' }}>
          {ultimoCodigo ? (
            <b>✅ Leí: {ultimoCodigo}</b>
          ) : (
            <span className="apagado">Esperando un disparo…</span>
          )}
        </div>
      </div>

      <div className="tarjeta">
        <h3>Inventario</h3>
        <div className="check">
          <input
            id="stock"
            type="checkbox"
            checked={cfg.controlarStock}
            onChange={(e) => set('controlarStock', e.target.checked)}
          />
          <label htmlFor="stock" style={{ margin: 0 }}>
            Descontar existencias con cada venta
          </label>
        </div>
        <label>Avisar cuando queden menos de</label>
        <input
          type="number"
          inputMode="numeric"
          value={cfg.stockMinimo}
          onChange={(e) => set('stockMinimo', Number(e.target.value))}
        />
      </div>

      <div className="tarjeta">
        <h3>Ticket por WhatsApp</h3>
        <div className="check">
          <input
            id="wa"
            type="checkbox"
            checked={cfg.pedirWhatsApp}
            onChange={(e) => set('pedirWhatsApp', e.target.checked)}
          />
          <label htmlFor="wa" style={{ margin: 0 }}>
            Preguntar el número al terminar la venta
          </label>
        </div>
        <p className="apagado">
          El cliente no queda registrado: se teclea el número, se manda el ticket y ya. Solo se
          guarda en el ticket a qué número se envió.
        </p>
      </div>

      <div className="tarjeta">
        <h3>Respaldo</h3>
        <p className="apagado">
          Todo vive en este teléfono. Si se pierde o se formatea, se pierden los datos: saca respaldo
          seguido.
        </p>
        <p className="apagado">
          {productos.length} productos · {ventas.length} tickets · {movimientos.length} movimientos
        </p>
        <button className="btn btn-ok btn-ancho" onClick={exportar}>
          ⬇️ Descargar respaldo
        </button>
        <button
          className="btn btn-ancho"
          style={{ marginTop: 8 }}
          onClick={() => archivo.current?.click()}
        >
          ⬆️ Restaurar de un archivo
        </button>
        <input
          ref={archivo}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) importar(f)
            e.target.value = ''
          }}
        />
      </div>

      <div className="tarjeta">
        <h3>Limpieza</h3>
        <button
          className="btn btn-ancho"
          onClick={async () => {
            const d = new Date()
            d.setMonth(d.getMonth() - 6)
            if (confirm(`¿Borrar tickets y movimientos anteriores a ${fechaHora(d)}?`)) {
              await limpiarHistorial(d.toISOString())
              setMsg('Historial viejo borrado. El catálogo y las existencias no se tocaron.')
            }
          }}
        >
          Borrar historial de más de 6 meses
        </button>
        <button
          className="btn btn-mal btn-ancho"
          style={{ marginTop: 8 }}
          onClick={async () => {
            if (!confirm('Esto borra TODO: productos, tickets y movimientos. ¿Seguro?')) return
            if (!confirm('Última llamada. ¿Ya sacaste respaldo?')) return
            await borrarTodo()
            setMsg('Se borró todo.')
          }}
        >
          Borrar todos los datos
        </button>
      </div>

      <p className="apagado centro" style={{ marginBottom: 20 }}>
        POS Lite v{__APP_VERSION__} · funciona sin internet
      </p>
    </>
  )
}
