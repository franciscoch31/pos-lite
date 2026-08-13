import type { Config } from './types'

const KEY = 'poslite.config'

const DEFAULTS: Config = {
  nombre: 'Tiendita DeAcero',
  telefono: '',
  direccion: '',
  mensajeTicket: '¡Gracias por su compra!',
  moneda: 'MXN',
  sufijoEnter: true,
  sonido: true,
  controlarStock: true,
  stockMinimo: 3,
  pedirWhatsApp: true,
}

// Cache en memoria: getConfig() se llama en cada tecla del lector y en cada
// formato de moneda, no conviene pegarle a localStorage tantas veces.
let cache: Config | null = null

export function getConfig(): Config {
  if (cache) return cache
  let leido: Config
  try {
    const raw = localStorage.getItem(KEY)
    leido = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch {
    leido = { ...DEFAULTS }
  }
  cache = leido
  return leido
}

export function saveConfig(cfg: Partial<Config>): Config {
  const next = { ...getConfig(), ...cfg }
  localStorage.setItem(KEY, JSON.stringify(next))
  cache = next
  return next
}

export function resetConfigCache() {
  cache = null
}
