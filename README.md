# POS Lite

Punto de venta para una tiendita, pensado para usarse **con el teléfono** y un
**lector de código de barras Bluetooth**. Versión ligera y barata: no tiene
servidor, no tiene nube, no tiene cuentas de usuario.

Proyecto nuevo e independiente: no comparte código, cuentas ni datos con ningún
otro sistema.

## Por qué no tiene servidor

Todo vive en el teléfono (IndexedDB). Eso quita el costo recurrente de nube, que
es lo que encarece un POS chico, y hace que funcione **sin internet** — clave en
una planta, donde la señal adentro suele ser mala.

El precio de eso: los datos están en ese teléfono. Si se pierde o se formatea,
se pierden. Por eso Ajustes tiene **Descargar respaldo** (un archivo `.json`) y
**Restaurar**. La rutina recomendada es sacar respaldo al cerrar y mandarlo al
correo o al Drive.

## Qué hace

- **Vender**: escanea → suma al carrito → cobra. Efectivo con cálculo de cambio
  y botones de billete, tarjeta y transferencia.
- **Producto no registrado**: si escaneas un código desconocido, lo da de alta
  ahí mismo (nombre y precio) y sigue la venta.
- **Monto libre** para lo que no está en catálogo.
- **Productos**: catálogo con precio, costo, existencia y aviso de existencia baja.
- **Entradas y salidas** (kardex): entrada de surtido, salida, merma y ajuste.
  Cada venta y cada cancelación también quedan anotadas, con fecha, motivo y
  existencia resultante.
- **Corte del día**: venta total, efectivo en caja, tarjeta/transferencia,
  utilidad estimada, ticket promedio, y la lista de tickets. Se puede compartir.
- **Ticket por WhatsApp sin cliente registrado**: al cobrar se teclea el número
  y se manda. No hay padrón de clientes; solo queda anotado a qué número se
  envió ese ticket. También imprime en térmica de 58/80 mm.
- **Cancelar un ticket** devuelve la mercancía al inventario.

## El lector Bluetooth

Compra uno que se empareje **en modo teclado (HID)** — son los baratos, de
$400 a $900 en México. El teléfono lo ve como teclado y "teclea" el código.

1. Empareja el lector en los ajustes de Bluetooth del teléfono.
2. Abre la app. No hay que configurar nada más: detecta el disparo por la
   velocidad del tecleo, aunque el cursor no esté en la caja de código.
3. En **Ajustes → Lector** hay una prueba para confirmar que lee.

Si tu lector no manda Enter al final, apaga esa opción en Ajustes.

Sin lector también sirve: el botón 📷 escanea con la cámara (más lento, se usa
como respaldo).

## Correrlo

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # deja todo en dist/
```

## Publicarlo

Es una PWA estática: sirve cualquier hosting. **Netlify o Cloudflare Pages**
(el plan gratis de Vercel prohíbe uso comercial).

```bash
npm run build
# subir la carpeta dist/
```

En el teléfono se abre la liga una vez y se usa *Agregar a pantalla de inicio*.
A partir de ahí abre como app, a pantalla completa y sin internet.

## Límites que conviene decirle al cliente

- Es de **un solo dispositivo**: dos teléfonos no comparten catálogo ni ventas.
  Para varias cajas hace falta un backend (ese ya es otro producto).
- No factura ni timbra CFDI. El ticket es comprobante interno, no fiscal.
- No abre cajón de dinero ni se integra con la terminal bancaria: el pago con
  tarjeta se cobra en la terminal y aquí solo se registra.
- No maneja venta por peso (báscula).
- Si el navegador borra los datos del sitio, se borra la base. Por eso el
  respaldo no es opcional.

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
```

Sin router, sin librería de estado, sin backend. React + Vite + `idb-keyval`, y
`@zxing/browser` cargado aparte (solo si se abre la cámara).
