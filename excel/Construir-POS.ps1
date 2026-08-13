<#
    Construye POS-Lite.xlsm desde cero usando Excel.

    Uso:
        powershell -ExecutionPolicy Bypass -File .\Construir-POS.ps1

    Si Excel no permite escribir el codigo VBA (ajuste apagado por default),
    el libro se genera igual y el script te dice como importar los 2 archivos
    de la carpeta vba\ a mano (toma 1 minuto).
#>

[CmdletBinding()]
param(
    [string]$Salida
)

$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Salida) { $Salida = Join-Path $raiz 'POS-Lite.xlsm' }

# Constantes de Excel que se usan abajo
$xlMacroEnabled = 52
$xlExpression = 2
$xlContinuous = 1
$xlCenter = -4108
$xlLeft = -4131

function Nueva-Hoja {
    param($Libro, [string]$Nombre, [int]$Posicion)
    $h = $Libro.Worksheets.Add([System.Reflection.Missing]::Value, $Libro.Worksheets.Item($Libro.Worksheets.Count))
    $h.Name = $Nombre
    return $h
}

function Set-Encabezados {
    param($Hoja, [string[]]$Titulos, [int]$Fila = 1)
    for ($i = 0; $i -lt $Titulos.Count; $i++) {
        $c = $Hoja.Cells.Item($Fila, $i + 1)
        $c.Value2 = $Titulos[$i]
    }
    $r = $Hoja.Range($Hoja.Cells.Item($Fila, 1), $Hoja.Cells.Item($Fila, $Titulos.Count))
    $r.Font.Bold = $true
    $r.Interior.Color = 3355443      # gris oscuro (BGR)
    $r.Font.Color = 16777215         # blanco
    $r.HorizontalAlignment = $xlCenter
    $r.Borders.LineStyle = $xlContinuous
}

function Nuevo-Boton {
    param($Hoja, [string]$Texto, [string]$Macro, [double]$X, [double]$Y,
          [double]$Ancho = 150, [double]$Alto = 34, [int]$Color = 5287936)
    $s = $Hoja.Shapes.AddShape(5, $X, $Y, $Ancho, $Alto)   # 5 = rectangulo redondeado
    $s.Fill.ForeColor.RGB = $Color
    $s.Line.Visible = $false
    $s.TextFrame.Characters().Text = $Texto
    $s.TextFrame.Characters().Font.Size = 11
    $s.TextFrame.Characters().Font.Bold = $true
    $s.TextFrame.Characters().Font.Color = 16777215
    $s.TextFrame.HorizontalAlignment = $xlCenter
    $s.OnAction = $Macro
    return $s
}

Write-Host "Abriendo Excel..." -ForegroundColor Cyan
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    $libro = $excel.Workbooks.Add()
    # deja una sola hoja para empezar
    while ($libro.Worksheets.Count -gt 1) { $libro.Worksheets.Item($libro.Worksheets.Count).Delete() }

    # ----------------------------------------------------------------- VENTA
    $venta = $libro.Worksheets.Item(1)
    $venta.Name = 'VENTA'
    $venta.Range('A1').Value2 = 'PUNTO DE VENTA'
    $venta.Range('A1').Font.Size = 20
    $venta.Range('A1').Font.Bold = $true
    $venta.Range('A3').Value2 = 'ESCANEA AQUI:'
    $venta.Range('A3').Font.Bold = $true
    $venta.Range('B3').Interior.Color = 65535          # amarillo
    $venta.Range('B3').Borders.LineStyle = $xlContinuous
    $venta.Range('B3').NumberFormat = '@'
    $venta.Range('B3').Font.Size = 14
    $venta.Range('D3').Value2 = 'TOTAL'
    $venta.Range('D3').Font.Bold = $true
    $venta.Range('D3').Font.Size = 16
    $venta.Range('E3').Formula = '=SUM(E6:E1000)'
    $venta.Range('E3').Font.Bold = $true
    $venta.Range('E3').Font.Size = 20
    $venta.Range('E3').NumberFormat = '$#,##0.00'
    Set-Encabezados -Hoja $venta -Titulos @('Codigo', 'Producto', 'Cant.', 'Precio', 'Importe') -Fila 5
    $venta.Columns.Item(1).ColumnWidth = 18
    $venta.Columns.Item(1).NumberFormat = '@'
    $venta.Columns.Item(2).ColumnWidth = 38
    $venta.Columns.Item(3).ColumnWidth = 8
    $venta.Columns.Item(4).ColumnWidth = 12
    $venta.Columns.Item(5).ColumnWidth = 14
    $venta.Range('D6:E1000').NumberFormat = '$#,##0.00'

    Nuevo-Boton -Hoja $venta -Texto 'COBRAR (F5)' -Macro 'POS.Cobrar' -X 430 -Y 20 -Ancho 170 -Alto 48 -Color 5287936 | Out-Null
    Nuevo-Boton -Hoja $venta -Texto 'Buscar producto' -Macro 'POS.BuscarProducto' -X 430 -Y 78 -Color 12419407 | Out-Null
    Nuevo-Boton -Hoja $venta -Texto 'Monto libre' -Macro 'POS.MontoLibre' -X 430 -Y 118 -Color 12419407 | Out-Null
    Nuevo-Boton -Hoja $venta -Texto 'Quitar renglon' -Macro 'POS.QuitarRenglon' -X 430 -Y 158 -Color 12419407 | Out-Null
    Nuevo-Boton -Hoja $venta -Texto 'Vaciar venta' -Macro 'POS.VaciarVenta' -X 430 -Y 198 -Color 3243501 | Out-Null

    # ------------------------------------------------------------- PRODUCTOS
    $prod = Nueva-Hoja -Libro $libro -Nombre 'PRODUCTOS'
    Set-Encabezados -Hoja $prod -Titulos @('Codigo', 'Producto', 'Precio', 'Costo', 'Existencia', 'Minimo', 'Vendidos')
    $prod.Columns.Item(1).ColumnWidth = 18
    $prod.Columns.Item(1).NumberFormat = '@'
    $prod.Columns.Item(2).ColumnWidth = 38
    $prod.Range('C:D').NumberFormat = '$#,##0.00'
    $prod.Columns.Item(5).ColumnWidth = 12
    $prod.Columns.Item(6).ColumnWidth = 10
    $prod.Columns.Item(7).ColumnWidth = 10
    # existencia baja = fondo rojo
    $fc = $prod.Range('E2:E5000').FormatConditions.Add($xlExpression, 0, '=AND($B2<>"",$E2<=$F2)')
    $fc.Interior.Color = 13551615
    $fc.Font.Color = 393372
    Nuevo-Boton -Hoja $prod -Texto 'Nuevo producto' -Macro 'POS.NuevoProducto' -X 620 -Y 20 | Out-Null
    Nuevo-Boton -Hoja $prod -Texto 'Entrada de mercancia' -Macro 'POS.Entrada' -X 620 -Y 60 | Out-Null
    Nuevo-Boton -Hoja $prod -Texto 'Salida' -Macro 'POS.Salida' -X 620 -Y 100 -Color 12419407 | Out-Null
    Nuevo-Boton -Hoja $prod -Texto 'Merma' -Macro 'POS.Merma' -X 620 -Y 140 -Color 3243501 | Out-Null

    # --------------------------------------------------------------- TICKETS
    $tick = Nueva-Hoja -Libro $libro -Nombre 'TICKETS'
    Set-Encabezados -Hoja $tick -Titulos @('Folio', 'Fecha', 'Hora', 'Piezas', 'Total', 'Metodo', 'Recibido', 'Cambio', 'WhatsApp', 'Estado', 'Costo')
    $tick.Columns.Item(2).NumberFormat = 'dd/mm/yyyy'
    $tick.Columns.Item(3).NumberFormat = 'hh:mm'
    $tick.Range('E:E').NumberFormat = '$#,##0.00'
    $tick.Range('G:H').NumberFormat = '$#,##0.00'
    $tick.Range('K:K').NumberFormat = '$#,##0.00'
    $tick.Columns.Item(9).NumberFormat = '@'
    Nuevo-Boton -Hoja $tick -Texto 'Reenviar por WhatsApp' -Macro 'POS.ReenviarWhatsApp' -X 760 -Y 20 | Out-Null
    Nuevo-Boton -Hoja $tick -Texto 'Imprimir ticket' -Macro 'POS.ImprimirTicket' -X 760 -Y 60 -Color 12419407 | Out-Null
    Nuevo-Boton -Hoja $tick -Texto 'Cancelar ticket' -Macro 'POS.CancelarTicket' -X 760 -Y 100 -Color 3243501 | Out-Null

    # --------------------------------------------------------------- DETALLE
    $det = Nueva-Hoja -Libro $libro -Nombre 'DETALLE'
    Set-Encabezados -Hoja $det -Titulos @('Folio', 'Fecha', 'Codigo', 'Producto', 'Cantidad', 'Precio', 'Importe', 'Costo')
    $det.Columns.Item(2).NumberFormat = 'dd/mm/yyyy'
    $det.Columns.Item(3).NumberFormat = '@'
    $det.Columns.Item(4).ColumnWidth = 38
    $det.Range('F:H').NumberFormat = '$#,##0.00'

    # ---------------------------------------------------------- MOVIMIENTOS
    $mov = Nueva-Hoja -Libro $libro -Nombre 'MOVIMIENTOS'
    Set-Encabezados -Hoja $mov -Titulos @('Fecha y hora', 'Codigo', 'Producto', 'Tipo', 'Cantidad', 'Existencia', 'Motivo', 'Ticket')
    $mov.Columns.Item(1).ColumnWidth = 18
    $mov.Columns.Item(1).NumberFormat = 'dd/mm/yyyy hh:mm'
    $mov.Columns.Item(2).NumberFormat = '@'
    $mov.Columns.Item(3).ColumnWidth = 32
    $mov.Columns.Item(7).ColumnWidth = 28

    # ----------------------------------------------------------------- CORTE
    $corte = Nueva-Hoja -Libro $libro -Nombre 'CORTE'
    $corte.Range('A1').Value2 = 'CORTE DEL DIA'
    $corte.Range('A1').Font.Size = 18
    $corte.Range('A1').Font.Bold = $true
    $corte.Range('A2').Value2 = 'Fecha'
    $corte.Range('B2').Formula = '=TODAY()'
    $corte.Range('B2').NumberFormat = 'dd/mm/yyyy'
    $corte.Range('B2').Interior.Color = 65535
    $corte.Range('A4').Value2 = 'Tickets'
    $corte.Range('B4').Formula = '=COUNTIFS(TICKETS!B:B,$B$2,TICKETS!J:J,"OK")'
    $corte.Range('A5').Value2 = 'Piezas vendidas'
    $corte.Range('B5').Formula = '=SUMIFS(TICKETS!D:D,TICKETS!B:B,$B$2,TICKETS!J:J,"OK")'
    $corte.Range('A6').Value2 = 'VENTA TOTAL'
    $corte.Range('B6').Formula = '=SUMIFS(TICKETS!E:E,TICKETS!B:B,$B$2,TICKETS!J:J,"OK")'
    $corte.Range('A7').Value2 = 'Efectivo en caja'
    $corte.Range('B7').Formula = '=SUMIFS(TICKETS!E:E,TICKETS!B:B,$B$2,TICKETS!J:J,"OK",TICKETS!F:F,"Efectivo")'
    $corte.Range('A8').Value2 = 'Tarjeta / transferencia'
    $corte.Range('B8').Formula = '=B6-B7'
    $corte.Range('A9').Value2 = 'Utilidad estimada'
    $corte.Range('B9').Formula = '=B6-SUMIFS(TICKETS!K:K,TICKETS!B:B,$B$2,TICKETS!J:J,"OK")'
    $corte.Range('A10').Value2 = 'Ticket promedio'
    $corte.Range('B10').Formula = '=IFERROR(B6/B4,0)'
    $corte.Range('A12').Value2 = 'Productos con existencia baja'
    $corte.Range('B12').Formula = '=SUMPRODUCT((PRODUCTOS!B2:B5000<>"")*(PRODUCTOS!E2:E5000<=PRODUCTOS!F2:F5000))'
    $corte.Range('A4:A12').Font.Bold = $true
    $corte.Range('B6:B9').NumberFormat = '$#,##0.00'
    $corte.Range('B10').NumberFormat = '$#,##0.00'
    $corte.Range('B6').Font.Size = 16
    $corte.Range('B6').Font.Bold = $true
    $corte.Columns.Item(1).ColumnWidth = 30
    $corte.Columns.Item(2).ColumnWidth = 18
    Nuevo-Boton -Hoja $corte -Texto 'Corte de hoy' -Macro 'POS.CorteDeHoy' -X 330 -Y 20 | Out-Null
    Nuevo-Boton -Hoja $corte -Texto 'Mandar por WhatsApp' -Macro 'POS.MandarCorte' -X 330 -Y 60 | Out-Null
    Nuevo-Boton -Hoja $corte -Texto 'Respaldar' -Macro 'POS.Respaldar' -X 330 -Y 100 -Color 12419407 | Out-Null

    # ---------------------------------------------------------------- CONFIG
    $cfg = Nueva-Hoja -Libro $libro -Nombre 'CONFIG'
    Set-Encabezados -Hoja $cfg -Titulos @('Concepto', 'Valor')
    # El orden de estos renglones lo leen las macros por posicion (ver POS.bas).
    $conceptos = @(
        'Nombre del negocio',
        'Direccion / ubicacion',
        'Telefono',
        'Mensaje al pie del ticket',
        'Descontar existencias (SI/NO)',
        'Avisar cuando queden menos de',
        'Ultimo folio usado',
        'Lada del pais (Mexico = 52)'
    )
    for ($i = 0; $i -lt $conceptos.Count; $i++) {
        $cfg.Cells.Item($i + 2, 1).Value2 = [string]$conceptos[$i]
    }
    $cfg.Range('B2').Value2 = 'Tiendita DeAcero'
    $cfg.Range('B3').Value2 = ''
    $cfg.Range('B4').Value2 = ''
    $cfg.Range('B5').Value2 = 'Gracias por su compra'
    $cfg.Range('B6').Value2 = 'SI'
    $cfg.Range('B7').Value2 = [double]3
    $cfg.Range('B8').Value2 = [double]0
    $cfg.Range('B9').Value2 = '52'
    $cfg.Columns.Item(1).ColumnWidth = 34
    $cfg.Columns.Item(2).ColumnWidth = 30
    $cfg.Range('B2:B9').Interior.Color = 65535
    $cfg.Range('A11').Value2 = 'No cambies el orden de estos renglones: las macros los leen por posicion.'
    $cfg.Range('A11').Font.Italic = $true

    # ---------------------------------------------------------------- INICIO
    $inicio = Nueva-Hoja -Libro $libro -Nombre 'INICIO'
    $inicio.Move($libro.Worksheets.Item(1))
    $inicio = $libro.Worksheets.Item(1)
    $inicio.Range('A1').Value2 = 'POS LITE  -  punto de venta'
    $inicio.Range('A1').Font.Size = 22
    $inicio.Range('A1').Font.Bold = $true
    $pasos = @(
        '',
        'COMO SE USA',
        '1. Conecta el lector de codigo de barras (USB, o Bluetooth emparejado como teclado).',
        '2. Ve a la hoja VENTA. El cursor se para solo en la celda amarilla.',
        '3. Escanea. Cada disparo agrega el producto. Si escaneas el mismo, sube la cantidad.',
        '4. Boton COBRAR: pregunta forma de pago, calcula el cambio y guarda el ticket.',
        '5. Al final pregunta el WhatsApp del cliente (opcional) y manda el ticket.',
        '',
        'PARA DAR DE ALTA PRODUCTOS: hoja PRODUCTOS, boton Nuevo producto.',
        'Tambien puedes escribirlos directo en la tabla (codigo, nombre, precio, costo, existencia).',
        '',
        'ENTRADAS Y SALIDAS: hoja PRODUCTOS, botones Entrada / Salida / Merma.',
        'Todo queda anotado en la hoja MOVIMIENTOS con fecha, motivo y existencia resultante.',
        '',
        'CORTE: hoja CORTE, cambia la fecha para ver cualquier dia.',
        '',
        'TRUCOS',
        '- Para vender 3 piezas de un golpe, escribe  3*CODIGO  en la celda amarilla.',
        '- El libro se guarda solo despues de cada venta.',
        '- Saca respaldo seguido (boton Respaldar en la hoja CORTE).'
    )
    for ($i = 0; $i -lt $pasos.Count; $i++) {
        $inicio.Cells.Item($i + 3, 1).Value2 = $pasos[$i]
    }
    $inicio.Range('A4').Font.Bold = $true
    $inicio.Range('A11').Font.Bold = $true
    $inicio.Range('A14').Font.Bold = $true
    $inicio.Range('A17').Font.Bold = $true
    $inicio.Range('A19').Font.Bold = $true
    $inicio.Columns.Item(1).ColumnWidth = 95
    Nuevo-Boton -Hoja $inicio -Texto 'IR A VENDER' -Macro 'POS.IrAVender' -X 620 -Y 20 -Ancho 180 -Alto 50 | Out-Null

    $libro.Worksheets.Item('VENTA').Activate()

    # ------------------------------------------------------------ macros VBA
    $vbaOk = $false
    $rutaBas = Join-Path $raiz 'vba\POS.bas'
    $rutaHoja = Join-Path $raiz 'vba\HojaVenta.txt'
    try {
        $proyecto = $libro.VBProject   # falla si el ajuste de seguridad esta apagado

        # VBA lee los .bas en ANSI: se reescribe con esa codificacion para que
        # los acentos no se rompan.
        $tmp = Join-Path $env:TEMP 'POS_1252.bas'
        $texto = [System.IO.File]::ReadAllText($rutaBas, [System.Text.Encoding]::UTF8)
        [System.IO.File]::WriteAllText($tmp, $texto, [System.Text.Encoding]::GetEncoding(1252))
        $proyecto.VBComponents.Import($tmp) | Out-Null
        Remove-Item $tmp -Force

        $codigoHoja = [System.IO.File]::ReadAllText($rutaHoja, [System.Text.Encoding]::UTF8)
        foreach ($c in $proyecto.VBComponents) {
            if ($c.Type -eq 100 -and $c.Properties.Item('Name').Value -eq 'VENTA') {
                $c.CodeModule.AddFromString($codigoHoja)
            }
        }
        $vbaOk = $true
    } catch {
        Write-Warning "No se pudo escribir el codigo VBA: $($_.Exception.Message)"
    }

    if (Test-Path $Salida) { Remove-Item $Salida -Force }
    $libro.SaveAs($Salida, $xlMacroEnabled)
    $libro.Close($false)

    Write-Host ""
    Write-Host "Listo: $Salida" -ForegroundColor Green
    if ($vbaOk) {
        Write-Host "Las macros quedaron dentro del libro. Abrelo y habilita el contenido." -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "FALTA PEGAR LAS MACROS (1 minuto):" -ForegroundColor Yellow
        Write-Host "  Opcion A - permitir que el script lo haga:"
        Write-Host "     Excel > Archivo > Opciones > Centro de confianza > Configuracion del Centro de"
        Write-Host "     confianza > Configuracion de macros > palomea 'Confiar en el acceso al modelo de"
        Write-Host "     objetos de proyectos de VBA'. Cierra Excel y vuelve a correr este script."
        Write-Host "  Opcion B - a mano:"
        Write-Host "     1) Abre POS-Lite.xlsm y presiona Alt+F11."
        Write-Host "     2) Menu Archivo > Importar archivo... y elige vba\POS.bas"
        Write-Host "     3) En el panel izquierdo doble clic en la hoja VENTA y pega el contenido de"
        Write-Host "        vba\HojaVenta.txt"
        Write-Host "     4) Guarda con Ctrl+S."
    }
} catch {
    Write-Host "Fallo en la linea $($_.InvocationInfo.ScriptLineNumber): $($_.InvocationInfo.Line.Trim())" -ForegroundColor Red
    throw
} finally {
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}
