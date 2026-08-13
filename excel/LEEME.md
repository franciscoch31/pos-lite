# POS Lite para Excel — versión de un solo pago

Mismo punto de venta, pero en un libro de Excel con macros. Es la opción más
barata: se entrega una vez, no tiene mensualidad y el cliente ya tiene Excel.

## ⚠️ Lo que hay que decirle al cliente antes de venderlo

- **No corre en el teléfono.** Excel para Android/iPhone **no ejecuta macros**.
  Esta versión es para una **PC o laptop en el mostrador**, con el lector
  conectado por USB o por Bluetooth.
- Necesita **Excel de escritorio** (Microsoft 365 o Excel 2016+). No funciona en
  Excel Online ni en LibreOffice sin adaptarlo.
- Es **un solo archivo**: si dos personas lo abren a la vez, se estorban.
- Cualquiera que sepa Excel puede editar los precios o borrar tickets. No hay
  usuarios ni permisos. Si el cliente necesita control de quién hizo qué, esta
  versión no le sirve.

Si el cliente quiere usarlo **en el teléfono**, esa es la versión web (carpeta
de arriba), no ésta.

## Qué hace

- Escanear → agregar → cobrar, con cálculo de cambio.
- Alta de productos (y alta al vuelo cuando escaneas un código desconocido).
- Entradas, salidas y mermas, con historial en la hoja `MOVIMIENTOS`.
- Corte por día con venta, efectivo, utilidad estimada y ticket promedio.
- Ticket por WhatsApp escribiendo el número al momento (sin registrar clientes).
- Imprimir ticket, cancelar ticket (devuelve la mercancía) y respaldar.

## Cómo se genera el archivo

```powershell
powershell -ExecutionPolicy Bypass -File .\Construir-POS.ps1
```

Deja `POS-Lite.xlsm` con todas las hojas, formatos y botones.

### Pegar las macros

Excel bloquea por default que un script escriba código VBA, así que hay dos
caminos:

**A) Que el script lo haga solo** (recomendado si vas a generar varios):
Excel → Archivo → Opciones → Centro de confianza → Configuración del Centro de
confianza → Configuración de macros → palomea **"Confiar en el acceso al modelo
de objetos de proyectos de VBA"**. Cierra Excel y vuelve a correr el script.

**B) A mano** (1 minuto, sin cambiar nada de seguridad):

1. Abre `POS-Lite.xlsm` y presiona **Alt + F11**.
2. Menú **Archivo → Importar archivo…** y elige `vba\POS.bas`.
3. En el panel izquierdo, doble clic en la hoja **VENTA** y pega ahí el
   contenido de `vba\HojaVenta.txt`.
4. **Ctrl + S** y cierra el editor.

Al abrir el libro, Excel pide *Habilitar contenido*. Hay que aceptar.

## Cómo se usa

1. Hoja **CONFIG**: nombre del negocio, teléfono, mensaje del ticket.
2. Hoja **PRODUCTOS**: botón *Nuevo producto*, o escribir directo en la tabla
   (código, nombre, precio, costo, existencia).
3. Hoja **VENTA**: el cursor se para solo en la celda amarilla. Escanea. Cada
   disparo agrega un renglón; si escaneas dos veces el mismo, sube la cantidad.
4. Botón **COBRAR**: pregunta forma de pago, calcula el cambio, guarda el ticket
   y ofrece mandarlo por WhatsApp.

Truco: para vender 3 piezas de un jalón, escribe `3*CODIGO` en la celda amarilla.

## Hojas del libro

| Hoja | Para qué |
|---|---|
| `INICIO` | instrucciones |
| `VENTA` | la venta en curso |
| `PRODUCTOS` | catálogo y existencias (rojo = existencia baja) |
| `TICKETS` | un renglón por venta |
| `DETALLE` | los artículos de cada venta |
| `MOVIMIENTOS` | kardex: entradas, salidas, mermas, ventas, cancelaciones |
| `CORTE` | resumen por día (cambia la fecha en la celda amarilla) |
| `CONFIG` | datos del negocio — **no cambies el orden de los renglones**, las macros los leen por posición |

## Respaldo

Botón *Respaldar* en la hoja `CORTE`: deja una copia con fecha en la subcarpeta
`Respaldos`. El libro además se guarda solo después de cada venta.
