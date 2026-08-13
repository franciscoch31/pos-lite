import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { Modal } from './Modal'

interface Props {
  onCodigo: (codigo: string) => void
  onClose: () => void
}

/**
 * Escáner con la cámara del teléfono. Es el plan B: con lector Bluetooth no se
 * usa. Se carga con lazy() para que no pese en el arranque de la app.
 */
export default function CamaraScanner({ onCodigo, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controles = useRef<IScannerControls | null>(null)
  const yaLeyo = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const lector = new BrowserMultiFormatReader()
    let cancelado = false

    lector
      .decodeFromVideoDevice(undefined, videoRef.current!, (resultado) => {
        if (resultado && !yaLeyo.current) {
          yaLeyo.current = true
          onCodigo(resultado.getText())
        }
      })
      .then((c) => {
        if (cancelado) c.stop()
        else controles.current = c
      })
      .catch((e) => {
        setError(
          e?.name === 'NotAllowedError'
            ? 'Permiso de cámara denegado. Actívalo en el navegador.'
            : 'No se pudo abrir la cámara.',
        )
      })

    return () => {
      cancelado = true
      controles.current?.stop()
    }
  }, [onCodigo])

  return (
    <Modal titulo="Escanear con la cámara" onClose={onClose}>
      {error ? (
        <p className="aviso aviso-mal">{error}</p>
      ) : (
        <>
          <video ref={videoRef} className="camara" muted playsInline />
          <p className="apagado centro">Apunta al código de barras.</p>
        </>
      )}
    </Modal>
  )
}
