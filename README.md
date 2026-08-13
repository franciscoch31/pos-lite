# POS Lite

Punto de venta para una tiendita que funciona **sin internet, sin servidor y sin cuentas de usuario**. Pensado para usarse con el teléfono y un lector de código de barras Bluetooth.

**Stack:** React 19 · TypeScript · Vite · PWA (Service Worker) · IndexedDB (`idb-keyval`) · `@zxing/browser`

---

## Lo interesante técnicamente

- **Offline-first real, no "offline con caché".** No hay backend. Toda la base (productos, tickets, kardex, configuración) vive en IndexedDB del dispositivo, con un almacén único (`lib/db.ts`) al que React se suscribe. La app abre y opera igual con el avión encendido.

- **Detección del lector Bluetooth por velocidad de tecleo.** Los lectores baratos se emparejan en modo HID: el teléfono los ve como un teclado y "teclean" el código. `lib/lector.ts` distingue un disparo del lector de una persona escribiendo, midiendo el intervalo entre pulsaciones — así funciona **aunque el cursor no esté en el campo de captura**, que es lo que hace usable el flujo real de mostrador.

- **El carrito vive fuera de React.** `lib/carrito.ts` mantiene la venta en curso en un módulo aparte, para que sobreviva al cambio de pestaña o a un remount sin perder lo escaneado.

- **Carga diferida del escáner de cámara.** `@zxing/browser` pesa; solo se importa si el usuario abre la cámara, que es el camino de respaldo.

- **Sin router, sin librería de estado, sin framework de UI.** La navegación son seis pantallas y un `useState`. Es una decisión, no una carencia: el bundle chico es lo que hace que arranque instantáneo en un teléfono de gama baja.

## Por qué no tiene servidor

Todo vive en el teléfono (IndexedDB). Eso quita el costo recurrente de nube, que es lo que encarece un POS chico, y hace que funcione **sin internet** — clave en una planta, donde la señal adentro suele ser mala.

El precio de eso: los datos están en ese teléfono. Si se pierde o se formatea, se pierden. Por eso Ajustes tiene **Descargar respaldo** (un archivo `.json`) y **Restaurar**. La rutina recomendada es sacar respaldo al cerrar y mandarlo al correo o al Drive.

## Qué hace

- **Vender**: escanea → suma al carrito → cobra. Efectivo con cálculo de cambio y botones de billete, tarjeta y transferencia.
- **Producto no registrado**: si escaneas un código desconocido, lo da de alta ahí mismo (nombre y precio) y sigue la venta.
- **Monto libre** para lo que no está en catálogo.
- **Productos**: catálogo con precio, costo, existencia y aviso de existencia baja.
- **Entradas y salidas** (kardex): entrada de surtido, salida, merma y ajuste. Cada venta y cada cancelación también quedan anotadas, con fecha, motivo y existencia resultante.
- **Corte del día**: venta total, efectivo en caja, tarjeta/transferencia, utilidad estimada, ticket promedio, y la lista de tickets. Se puede compartir.
- **Ticket por WhatsApp sin cliente registrado**: al cobrar se teclea el número y se manda. No hay padrón de clientes; solo queda anotado a qué número se envió ese ticket. También imprime en térmica de 58/80 mm.
- **Cancelar un ticket** devuelve la mercancía al inventario.

## El lector Bluetooth

Compra uno que se empareje **en modo teclado (HID)** — son los baratos, de $400 a $900 en México. El teléfono lo ve como teclado y "teclea" el código.

1. Empareja el lector en los ajustes de Bluetooth del teléfono.
2. Abre la app. No hay que configurar nada más.
3. En **Ajustes → Lector** hay una prueba para confirmar que lee.

Si tu lector no manda Enter al final, apaga esa opción en Ajustes.

Sin lector también sirve: el botón 📷 escanea con la cámara (más lento, se usa como respaldo).

## Correrlo

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # deja todo en dist/
```

## Publicarlo

Es una PWA estática: sirve cualquier hosting. **Netlify o Cloudflare Pages** (el plan gratis de Vercel prohíbe uso comercial).

```bash
npm run build
# subir la carpeta dist/
```

En el teléfono se abre la liga una vez y se usa *Agregar a pantalla de inicio*. A partir de ahí abre como app, a pantalla completa y sin internet.

## Cómo está armado

```
src/
  lib/
    db.ts        almacén único (IndexedDB + suscripción a React)
    carrito.ts   venta en curso, fuera de React para que sobreviva al cambio de pestaña
    lector.ts    detección del lector Bluetooth por velocidad de tecleo
    ticket.ts    texto del ticket, WhatsApp e impresión térmica
    config.ts    configuración del negocio (localStorage, con caché)
  pages/         Vender, Cobro, Productos, Inventario, Corte, Ajustes
excel/           variante en Excel con macros (VBA), para quien no quiere app
```

## Límites conocidos

Los pongo porque un POS sin límites escritos es un POS que va a decepcionar a alguien:

- Es de **un solo dispositivo**: dos teléfonos no comparten catálogo ni ventas. Para varias cajas hace falta un backend (ese ya es otro producto).
- No factura ni timbra CFDI. El ticket es comprobante interno, no fiscal.
- No abre cajón de dinero ni se integra con la terminal bancaria: el pago con tarjeta se cobra en la terminal y aquí solo se registra.
- No maneja venta por peso (báscula).
- Si el navegador borra los datos del sitio, se borra la base. Por eso el respaldo no es opcional.
