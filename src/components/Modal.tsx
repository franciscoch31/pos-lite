import { useEffect, type ReactNode } from 'react'

interface Props {
  titulo: string
  onClose: () => void
  children: ReactNode
  /** Ocupa toda la pantalla (cobro, escáner). */
  completa?: boolean
}

export function Modal({ titulo, onClose, children, completa }: Props) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [onClose])

  return (
    <div className="modal-fondo" onClick={onClose}>
      <div
        className={completa ? 'modal modal-completa' : 'modal'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-cab">
          <h2>{titulo}</h2>
          <button className="icono" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="modal-cuerpo">{children}</div>
      </div>
    </div>
  )
}
