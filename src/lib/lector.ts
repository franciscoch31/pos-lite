import { useEffect, useRef } from 'react'
import { getConfig } from './config'

/**
 * Lector de código de barras Bluetooth.
 *
 * Los lectores BT baratos se emparejan en modo HID: el teléfono los ve como un
 * teclado y "teclean" el código muy rápido, terminando con Enter. Aquí no hace
 * falta ninguna API de Bluetooth: se escuchan las teclas y se distingue al
 * lector de una persona por la velocidad (una persona no teclea a <60 ms por
 * carácter de forma sostenida).
 *
 * Si el foco está dentro de un campo de texto no hacemos nada: ahí el propio
 * campo recibe el código y maneja su Enter.
 */
export function useLector(onCodigo: (codigo: string) => void, activo = true) {
  const cb = useRef(onCodigo)
  cb.current = onCodigo

  useEffect(() => {
    if (!activo) return

    let buffer = ''
    let ultimo = 0
    let rapido = true
    let timer: number | undefined

    const reset = () => {
      buffer = ''
      rapido = true
      window.clearTimeout(timer)
    }

    const soltar = () => {
      const codigo = buffer
      reset()
      if (codigo) cb.current(codigo)
    }

    const onKey = (e: KeyboardEvent) => {
      const destino = e.target as HTMLElement | null
      const tag = destino?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || destino?.isContentEditable) return

      const ahora = performance.now()
      const delta = ahora - ultimo

      if (e.key === 'Enter') {
        if (buffer.length >= 3 && rapido) {
          e.preventDefault()
          soltar()
        } else {
          reset()
        }
        return
      }

      if (e.key.length !== 1) return // Shift, Tab, F5...

      if (delta > 120) {
        buffer = ''
        rapido = true
      } else if (delta > 60) {
        rapido = false
      }
      buffer += e.key
      ultimo = ahora

      // Lectores configurados sin sufijo Enter: se cierra el código por pausa.
      if (!getConfig().sufijoEnter) {
        window.clearTimeout(timer)
        timer = window.setTimeout(() => {
          if (buffer.length >= 6 && rapido) soltar()
          else reset()
        }, 160)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(timer)
    }
  }, [activo])
}

/** Confirmación de escaneo: bip corto + vibración (si están activados). */
export function bip(ok = true) {
  if (!getConfig().sonido) return
  navigator.vibrate?.(ok ? 60 : [60, 60, 60])
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = ok ? 1400 : 320
    gain.gain.value = 0.05
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + (ok ? 0.07 : 0.22))
    osc.onended = () => ctx.close()
  } catch {
    /* sin audio disponible */
  }
}
