Attribute VB_Name = "POS"
Option Explicit

' ============================================================================
'  POS Lite para Excel  -  punto de venta de un solo pago
'  El lector de codigo de barras (USB o Bluetooth en modo teclado/HID) teclea
'  el codigo en la celda VENTA!B3 y manda Enter: el evento de la hoja llama a
'  AgregarCodigo y el renglon aparece solo.
' ============================================================================

Private Const H_VENTA As String = "VENTA"
Private Const H_PROD As String = "PRODUCTOS"
Private Const H_TICK As String = "TICKETS"
Private Const H_DET As String = "DETALLE"
Private Const H_MOV As String = "MOVIMIENTOS"
Private Const H_CFG As String = "CONFIG"

Private Const FILA_ITEMS As Long = 6   ' primer renglon de la venta en curso

' Renglones de la hoja CONFIG (columna B)
Private Const C_NEGOCIO As Long = 2
Private Const C_DIRECCION As Long = 3
Private Const C_TELEFONO As Long = 4
Private Const C_MENSAJE As Long = 5
Private Const C_DESCONTAR As Long = 6
Private Const C_MINIMO As Long = 7
Private Const C_FOLIO As Long = 8
Private Const C_LADA As Long = 9

' ----------------------------------------------------------------- utilidades

Private Function Hoja(ByVal nombre As String) As Worksheet
    Set Hoja = ThisWorkbook.Worksheets(nombre)
End Function

Private Function Cfg(ByVal fila As Long) As String
    Cfg = Trim(CStr(Hoja(H_CFG).Cells(fila, 2).Value))
End Function

Private Function CfgNum(ByVal fila As Long) As Double
    CfgNum = Val(Replace(Cfg(fila), ",", ""))
End Function

Private Function DescuentaExistencias() As Boolean
    DescuentaExistencias = (UCase(Left(Cfg(C_DESCONTAR) & "S", 1)) = "S")
End Function

Private Function UltimaFila(ByVal h As Worksheet, ByVal col As Long) As Long
    UltimaFila = h.Cells(h.Rows.Count, col).End(xlUp).Row
End Function

Private Function UltimaFilaVenta() As Long
    Dim u As Long
    u = UltimaFila(Hoja(H_VENTA), 1)
    If u < FILA_ITEMS - 1 Then u = FILA_ITEMS - 1
    UltimaFilaVenta = u
End Function

Public Function TotalVenta() As Double
    Dim u As Long
    u = UltimaFilaVenta()
    If u < FILA_ITEMS Then
        TotalVenta = 0
    Else
        TotalVenta = Application.WorksheetFunction.Sum(Hoja(H_VENTA).Range("E" & FILA_ITEMS & ":E" & u))
    End If
End Function

Private Function Pesos(ByVal v As Double) As String
    Pesos = Format(v, "$#,##0.00")
End Function

Private Sub Confirmacion(ByVal ok As Boolean)
    On Error Resume Next
    If ok Then Beep
End Sub

' Devuelve el renglon del producto en PRODUCTOS, o 0 si no existe.
Private Function FilaProducto(ByVal codigo As String) As Long
    Dim r As Variant
    r = Application.Match(codigo, Hoja(H_PROD).Columns(1), 0)
    If IsError(r) Then FilaProducto = 0 Else FilaProducto = CLng(r)
End Function

Private Function FilaProductoPorNombre(ByVal nombre As String) As Long
    Dim r As Variant
    r = Application.Match(nombre, Hoja(H_PROD).Columns(2), 0)
    If IsError(r) Then FilaProductoPorNombre = 0 Else FilaProductoPorNombre = CLng(r)
End Function

' ------------------------------------------------------------------ la venta

' Acepta "CODIGO" o "3*CODIGO" (tres piezas del mismo producto).
Public Sub AgregarCodigo(ByVal texto As String)
    Dim codigo As String, cantidad As Double, p As Long, i As Long, fila As Long
    Dim hv As Worksheet, hp As Worksheet

    texto = Trim(texto)
    If texto = "" Then Exit Sub

    cantidad = 1
    If InStr(texto, "*") > 0 Then
        cantidad = Val(Split(texto, "*")(0))
        codigo = Trim(Split(texto, "*")(1))
        If cantidad <= 0 Then cantidad = 1
    Else
        codigo = texto
    End If

    Set hv = Hoja(H_VENTA)
    Set hp = Hoja(H_PROD)

    p = FilaProducto(codigo)
    If p = 0 Then
        Confirmacion False
        If MsgBox("El codigo " & codigo & " no esta en el catalogo." & vbCrLf & vbCrLf & _
                  "¿Darlo de alta ahora?", vbYesNo + vbQuestion, "Producto no registrado") = vbYes Then
            If AltaProducto(codigo) Then AgregarCodigo texto
        End If
        Exit Sub
    End If

    If DescuentaExistencias() And hp.Cells(p, 5).Value <= 0 Then
        MsgBox "Ojo: " & hp.Cells(p, 2).Value & " esta en ceros." & vbCrLf & _
               "Se puede vender igual, pero la existencia quedara en negativo.", vbExclamation, "Sin existencia"
    End If

    ' Si ya esta en la venta, solo sube la cantidad.
    For i = FILA_ITEMS To UltimaFilaVenta()
        If CStr(hv.Cells(i, 1).Value) = codigo Then
            hv.Cells(i, 3).Value = hv.Cells(i, 3).Value + cantidad
            Confirmacion True
            Exit Sub
        End If
    Next i

    fila = UltimaFilaVenta() + 1
    If fila < FILA_ITEMS Then fila = FILA_ITEMS
    hv.Cells(fila, 1).Value = codigo
    hv.Cells(fila, 2).Value = hp.Cells(p, 2).Value
    hv.Cells(fila, 3).Value = cantidad
    hv.Cells(fila, 4).Value = hp.Cells(p, 3).Value
    hv.Cells(fila, 5).Formula = "=C" & fila & "*D" & fila
    Confirmacion True
End Sub

' Busca por nombre cuando el producto no tiene codigo o no pega el lector.
Public Sub BuscarProducto()
    Dim q As String, hp As Worksheet, i As Long, u As Long
    Dim listado As String, encontrados As Long, primero As Long

    q = Trim(InputBox("Escribe parte del nombre del producto:", "Buscar producto"))
    If q = "" Then Exit Sub

    Set hp = Hoja(H_PROD)
    u = UltimaFila(hp, 2)
    For i = 2 To u
        If InStr(1, CStr(hp.Cells(i, 2).Value), q, vbTextCompare) > 0 Then
            encontrados = encontrados + 1
            If encontrados = 1 Then primero = i
            If encontrados <= 15 Then
                listado = listado & encontrados & ") " & hp.Cells(i, 2).Value & _
                          "   " & Pesos(hp.Cells(i, 3).Value) & vbCrLf
            End If
        End If
    Next i

    If encontrados = 0 Then
        MsgBox "No hay productos con '" & q & "'.", vbInformation, "Buscar"
        Exit Sub
    End If

    Dim elegido As String, n As Long, cuenta As Long
    elegido = InputBox("Resultados:" & vbCrLf & vbCrLf & listado & vbCrLf & _
                       "Escribe el numero del que quieres agregar:", "Buscar producto", "1")
    If elegido = "" Then Exit Sub
    n = Val(elegido)
    If n < 1 Or n > encontrados Then Exit Sub

    cuenta = 0
    For i = 2 To u
        If InStr(1, CStr(hp.Cells(i, 2).Value), q, vbTextCompare) > 0 Then
            cuenta = cuenta + 1
            If cuenta = n Then
                If CStr(hp.Cells(i, 1).Value) <> "" Then
                    AgregarCodigo CStr(hp.Cells(i, 1).Value)
                Else
                    AgregarSinCodigo i
                End If
                Exit For
            End If
        End If
    Next i
    Hoja(H_VENTA).Range("B3").Select
End Sub

Private Sub AgregarSinCodigo(ByVal filaProd As Long)
    Dim hv As Worksheet, hp As Worksheet, fila As Long
    Set hv = Hoja(H_VENTA)
    Set hp = Hoja(H_PROD)
    fila = UltimaFilaVenta() + 1
    If fila < FILA_ITEMS Then fila = FILA_ITEMS
    hv.Cells(fila, 1).Value = ""
    hv.Cells(fila, 2).Value = hp.Cells(filaProd, 2).Value
    hv.Cells(fila, 3).Value = 1
    hv.Cells(fila, 4).Value = hp.Cells(filaProd, 3).Value
    hv.Cells(fila, 5).Formula = "=C" & fila & "*D" & fila
End Sub

' Algo que no esta en el catalogo: se cobra por monto.
Public Sub MontoLibre()
    Dim concepto As String, importe As Double, fila As Long, hv As Worksheet
    concepto = Trim(InputBox("¿Que se esta cobrando?", "Monto libre", "Varios"))
    If concepto = "" Then Exit Sub
    importe = Val(InputBox("Importe:", "Monto libre"))
    If importe <= 0 Then Exit Sub

    Set hv = Hoja(H_VENTA)
    fila = UltimaFilaVenta() + 1
    If fila < FILA_ITEMS Then fila = FILA_ITEMS
    hv.Cells(fila, 1).Value = ""
    hv.Cells(fila, 2).Value = concepto
    hv.Cells(fila, 3).Value = 1
    hv.Cells(fila, 4).Value = importe
    hv.Cells(fila, 5).Formula = "=C" & fila & "*D" & fila
    hv.Range("B3").Select
End Sub

Public Sub QuitarRenglon()
    Dim hv As Worksheet, f As Long
    Set hv = Hoja(H_VENTA)
    f = ActiveCell.Row
    If f < FILA_ITEMS Or f > UltimaFilaVenta() Then
        MsgBox "Primero selecciona el renglon que quieres quitar de la venta.", vbInformation, "Quitar"
        Exit Sub
    End If
    hv.Rows(f).Delete
    hv.Range("B3").Select
End Sub

Public Sub VaciarVenta()
    Dim hv As Worksheet, u As Long
    Set hv = Hoja(H_VENTA)
    u = UltimaFilaVenta()
    If u >= FILA_ITEMS Then hv.Range("A" & FILA_ITEMS & ":E" & u).ClearContents
    hv.Range("B3").Select
End Sub

' ------------------------------------------------------------------- el cobro

Public Sub Cobrar()
    Dim total As Double, u As Long, hv As Worksheet
    Set hv = Hoja(H_VENTA)
    u = UltimaFilaVenta()
    total = TotalVenta()

    If u < FILA_ITEMS Or total <= 0 Then
        MsgBox "No hay nada que cobrar.", vbInformation, "Cobrar"
        Exit Sub
    End If

    Dim op As String, metodo As String, recibido As Double, cambio As Double
    op = InputBox("Total a cobrar: " & Pesos(total) & vbCrLf & vbCrLf & _
                  "1 = Efectivo" & vbCrLf & "2 = Tarjeta" & vbCrLf & "3 = Transferencia", _
                  "Forma de pago", "1")
    If op = "" Then Exit Sub

    Select Case Val(op)
        Case 2: metodo = "Tarjeta"
        Case 3: metodo = "Transferencia"
        Case Else: metodo = "Efectivo"
    End Select

    If metodo = "Efectivo" Then
        Do
            Dim r As String
            r = InputBox("Total: " & Pesos(total) & vbCrLf & "¿Con cuanto paga?" & vbCrLf & _
                         "(deja vacio si paga justo)", "Efectivo", Format(total, "0.00"))
            If r = "" Then
                recibido = total
            Else
                recibido = Val(Replace(r, ",", ""))
            End If
            If recibido < total Then
                If MsgBox("Faltan " & Pesos(total - recibido) & ". ¿Capturar de nuevo?", _
                          vbYesNo + vbExclamation, "Efectivo") = vbNo Then Exit Sub
            End If
        Loop While recibido < total
        cambio = recibido - total
    Else
        recibido = total
        cambio = 0
    End If

    ' ---- se guarda el ticket
    Dim folio As Long, ht As Worksheet, hd As Worksheet, hp As Worksheet
    Dim i As Long, ft As Long, fd As Long, costoTotal As Double, piezas As Double

    folio = CLng(CfgNum(C_FOLIO)) + 1
    Set ht = Hoja(H_TICK)
    Set hd = Hoja(H_DET)
    Set hp = Hoja(H_PROD)

    ft = UltimaFila(ht, 1) + 1
    fd = UltimaFila(hd, 1) + 1

    For i = FILA_ITEMS To u
        If CStr(hv.Cells(i, 2).Value) <> "" Then
            Dim cod As String, cant As Double, precio As Double, costo As Double, p As Long
            cod = CStr(hv.Cells(i, 1).Value)
            cant = Val(hv.Cells(i, 3).Value)
            precio = Val(hv.Cells(i, 4).Value)
            costo = 0
            p = 0
            If cod <> "" Then p = FilaProducto(cod)
            If p > 0 Then costo = Val(hp.Cells(p, 4).Value)

            hd.Cells(fd, 1).Value = folio
            hd.Cells(fd, 2).Value = Date
            hd.Cells(fd, 3).Value = cod
            hd.Cells(fd, 4).Value = hv.Cells(i, 2).Value
            hd.Cells(fd, 5).Value = cant
            hd.Cells(fd, 6).Value = precio
            hd.Cells(fd, 7).Value = cant * precio
            hd.Cells(fd, 8).Value = costo
            fd = fd + 1

            piezas = piezas + cant
            costoTotal = costoTotal + costo * cant

            If p > 0 And DescuentaExistencias() Then
                hp.Cells(p, 5).Value = Val(hp.Cells(p, 5).Value) - cant
                hp.Cells(p, 7).Value = Val(hp.Cells(p, 7).Value) + cant
                AnotarMovimiento cod, CStr(hp.Cells(p, 2).Value), "Venta", -cant, _
                                 Val(hp.Cells(p, 5).Value), "Ticket " & folio, folio
            End If
        End If
    Next i

    ht.Cells(ft, 1).Value = folio
    ht.Cells(ft, 2).Value = Date
    ht.Cells(ft, 3).Value = Time
    ht.Cells(ft, 4).Value = piezas
    ht.Cells(ft, 5).Value = total
    ht.Cells(ft, 6).Value = metodo
    ht.Cells(ft, 7).Value = recibido
    ht.Cells(ft, 8).Value = cambio
    ht.Cells(ft, 10).Value = "OK"
    ht.Cells(ft, 11).Value = costoTotal

    Hoja(H_CFG).Cells(C_FOLIO, 2).Value = folio

    VaciarVenta
    ThisWorkbook.Save

    Dim msg As String
    msg = "Ticket #" & folio & " cobrado." & vbCrLf & "Total: " & Pesos(total)
    If metodo = "Efectivo" Then
        msg = msg & vbCrLf & vbCrLf & "CAMBIO:  " & Pesos(cambio)
    End If
    MsgBox msg, vbInformation, "Venta registrada"

    Dim tel As String
    tel = Trim(InputBox("¿Mandar el ticket por WhatsApp?" & vbCrLf & vbCrLf & _
                        "Escribe el numero a 10 digitos (o deja vacio para saltarlo)." & vbCrLf & _
                        "No hace falta tener registrado al cliente.", "Ticket #" & folio))
    If tel <> "" Then
        ht.Cells(ft, 9).Value = "'" & tel
        EnviarWhatsApp tel, TicketTexto(folio)
    End If

    Hoja(H_VENTA).Range("B3").Select
End Sub

' -------------------------------------------------------------- ticket / WA

Public Function TicketTexto(ByVal folio As Long) As String
    Dim ht As Worksheet, hd As Worksheet, i As Long, u As Long, ft As Long
    Dim t As String, r As Variant

    Set ht = Hoja(H_TICK)
    Set hd = Hoja(H_DET)
    r = Application.Match(folio, ht.Columns(1), 0)
    If IsError(r) Then Exit Function
    ft = CLng(r)

    t = Cfg(C_NEGOCIO) & vbLf
    If Cfg(C_DIRECCION) <> "" Then t = t & Cfg(C_DIRECCION) & vbLf
    If Cfg(C_TELEFONO) <> "" Then t = t & "Tel: " & Cfg(C_TELEFONO) & vbLf
    t = t & "--------------------------------" & vbLf
    t = t & "Ticket #" & folio & vbLf
    t = t & Format(ht.Cells(ft, 2).Value, "dd/mm/yyyy") & " " & Format(ht.Cells(ft, 3).Value, "hh:mm") & vbLf
    t = t & "--------------------------------" & vbLf

    u = UltimaFila(hd, 1)
    For i = 2 To u
        If Val(hd.Cells(i, 1).Value) = folio Then
            t = t & hd.Cells(i, 5).Value & " x " & hd.Cells(i, 4).Value & vbLf
            t = t & "     " & Pesos(hd.Cells(i, 6).Value) & "     " & Pesos(hd.Cells(i, 7).Value) & vbLf
        End If
    Next i

    t = t & "--------------------------------" & vbLf
    t = t & "TOTAL: " & Pesos(ht.Cells(ft, 5).Value) & vbLf
    t = t & "Pago: " & ht.Cells(ft, 6).Value & vbLf
    If ht.Cells(ft, 6).Value = "Efectivo" Then
        t = t & "Recibido: " & Pesos(ht.Cells(ft, 7).Value) & vbLf
        t = t & "Cambio: " & Pesos(ht.Cells(ft, 8).Value) & vbLf
    End If
    t = t & "--------------------------------" & vbLf
    t = t & Cfg(C_MENSAJE)
    TicketTexto = t
End Function

Private Function NormalizaTelefono(ByVal tel As String) As String
    Dim i As Long, d As String, ch As String
    For i = 1 To Len(tel)
        ch = Mid(tel, i, 1)
        If ch >= "0" And ch <= "9" Then d = d & ch
    Next i
    If Left(d, 3) = "044" Or Left(d, 3) = "045" Then d = Mid(d, 4)
    If Len(d) = 10 Then d = Cfg(C_LADA) & d
    NormalizaTelefono = d
End Function

Public Sub EnviarWhatsApp(ByVal tel As String, ByVal texto As String)
    Dim url As String
    url = "https://wa.me/" & NormalizaTelefono(tel) & "?text=" & _
          Application.WorksheetFunction.EncodeURL(texto)
    On Error Resume Next
    ThisWorkbook.FollowHyperlink url
    If Err.Number <> 0 Then
        Err.Clear
        MsgBox "No se pudo abrir WhatsApp automaticamente." & vbCrLf & _
               "Copia esta liga en el navegador:" & vbCrLf & vbCrLf & url, vbExclamation, "WhatsApp"
    End If
End Sub

' Reenviar un ticket anterior: se para en el renglon del ticket y corre esto.
Public Sub ReenviarWhatsApp()
    Dim folio As Long, tel As String, ht As Worksheet
    Set ht = Hoja(H_TICK)
    folio = FolioSeleccionado()
    If folio = 0 Then Exit Sub
    tel = Trim(InputBox("Numero de WhatsApp para el ticket #" & folio & ":", "Reenviar ticket"))
    If tel = "" Then Exit Sub
    ht.Cells(ActiveCell.Row, 9).Value = "'" & tel
    EnviarWhatsApp tel, TicketTexto(folio)
End Sub

Private Function FolioSeleccionado() As Long
    Dim ht As Worksheet
    Set ht = Hoja(H_TICK)
    If ActiveSheet.Name <> H_TICK Or ActiveCell.Row < 2 Or ht.Cells(ActiveCell.Row, 1).Value = "" Then
        MsgBox "Ve a la hoja TICKETS y selecciona el renglon del ticket.", vbInformation, "Ticket"
        FolioSeleccionado = 0
    Else
        FolioSeleccionado = CLng(ht.Cells(ActiveCell.Row, 1).Value)
    End If
End Function

Public Sub ImprimirTicket()
    Dim folio As Long, h As Worksheet, lineas As Variant, i As Long
    folio = FolioSeleccionado()
    If folio = 0 Then Exit Sub

    On Error Resume Next
    Application.DisplayAlerts = False
    ThisWorkbook.Worksheets("IMPRESION").Delete
    Application.DisplayAlerts = True
    On Error GoTo 0

    Set h = ThisWorkbook.Worksheets.Add
    h.Name = "IMPRESION"
    lineas = Split(TicketTexto(folio), vbLf)
    For i = 0 To UBound(lineas)
        h.Cells(i + 1, 1).Value = lineas(i)
    Next i
    h.Columns(1).ColumnWidth = 34
    h.Columns(1).Font.Name = "Consolas"
    h.Columns(1).Font.Size = 9
    With h.PageSetup
        .LeftMargin = Application.InchesToPoints(0.15)
        .RightMargin = Application.InchesToPoints(0.15)
        .TopMargin = Application.InchesToPoints(0.15)
        .BottomMargin = Application.InchesToPoints(0.15)
    End With
    h.PrintPreview
End Sub

Public Sub CancelarTicket()
    Dim folio As Long, ht As Worksheet, hd As Worksheet, hp As Worksheet
    Dim ft As Long, i As Long, u As Long, p As Long

    folio = FolioSeleccionado()
    If folio = 0 Then Exit Sub
    Set ht = Hoja(H_TICK)
    ft = ActiveCell.Row

    If UCase(CStr(ht.Cells(ft, 10).Value)) = "CANCELADO" Then
        MsgBox "Ese ticket ya estaba cancelado.", vbInformation, "Cancelar"
        Exit Sub
    End If
    If MsgBox("¿Cancelar el ticket #" & folio & " por " & Pesos(ht.Cells(ft, 5).Value) & "?" & vbCrLf & _
              "La mercancia regresa al inventario.", vbYesNo + vbExclamation, "Cancelar ticket") = vbNo Then Exit Sub

    Set hd = Hoja(H_DET)
    Set hp = Hoja(H_PROD)
    u = UltimaFila(hd, 1)
    For i = 2 To u
        If Val(hd.Cells(i, 1).Value) = folio Then
            p = 0
            If CStr(hd.Cells(i, 3).Value) <> "" Then p = FilaProducto(CStr(hd.Cells(i, 3).Value))
            If p > 0 And DescuentaExistencias() Then
                hp.Cells(p, 5).Value = Val(hp.Cells(p, 5).Value) + Val(hd.Cells(i, 5).Value)
                hp.Cells(p, 7).Value = Val(hp.Cells(p, 7).Value) - Val(hd.Cells(i, 5).Value)
                AnotarMovimiento CStr(hd.Cells(i, 3).Value), CStr(hd.Cells(i, 4).Value), "Cancelacion", _
                                 Val(hd.Cells(i, 5).Value), Val(hp.Cells(p, 5).Value), _
                                 "Cancelacion del ticket " & folio, folio
            End If
        End If
    Next i

    ht.Cells(ft, 10).Value = "CANCELADO"
    ht.Rows(ft).Font.Strikethrough = True
    ThisWorkbook.Save
    MsgBox "Ticket #" & folio & " cancelado.", vbInformation, "Listo"
End Sub

' -------------------------------------------------------- entradas y salidas

Private Sub AnotarMovimiento(ByVal codigo As String, ByVal nombre As String, ByVal tipo As String, _
                             ByVal cantidad As Double, ByVal resultante As Double, _
                             ByVal motivo As String, ByVal folio As Long)
    Dim hm As Worksheet, f As Long
    Set hm = Hoja(H_MOV)
    f = UltimaFila(hm, 1) + 1
    hm.Cells(f, 1).Value = Now
    hm.Cells(f, 2).Value = codigo
    hm.Cells(f, 3).Value = nombre
    hm.Cells(f, 4).Value = tipo
    hm.Cells(f, 5).Value = cantidad
    hm.Cells(f, 6).Value = resultante
    hm.Cells(f, 7).Value = motivo
    If folio > 0 Then hm.Cells(f, 8).Value = folio
End Sub

Public Sub Entrada()
    MoverExistencia "Entrada"
End Sub

Public Sub Salida()
    MoverExistencia "Salida"
End Sub

Public Sub Merma()
    MoverExistencia "Merma"
End Sub

Private Sub MoverExistencia(ByVal tipo As String)
    Dim codigo As String, p As Long, cantidad As Double, motivo As String, hp As Worksheet
    Dim delta As Double, resultante As Double

    codigo = Trim(InputBox("Escanea o escribe el codigo del producto:", tipo & " de mercancia"))
    If codigo = "" Then Exit Sub

    Set hp = Hoja(H_PROD)
    p = FilaProducto(codigo)
    If p = 0 Then
        If MsgBox("El codigo " & codigo & " no esta en el catalogo." & vbCrLf & "¿Darlo de alta?", _
                  vbYesNo + vbQuestion, "Producto no registrado") = vbYes Then
            If AltaProducto(codigo) Then p = FilaProducto(codigo)
        End If
        If p = 0 Then Exit Sub
    End If

    cantidad = Val(InputBox(hp.Cells(p, 2).Value & vbCrLf & _
                            "Hoy hay " & hp.Cells(p, 5).Value & " piezas." & vbCrLf & vbCrLf & _
                            "¿Cuantas piezas " & IIf(tipo = "Entrada", "entran", "salen") & "?", tipo))
    If cantidad <= 0 Then Exit Sub

    motivo = Trim(InputBox("Motivo:", tipo, IIf(tipo = "Entrada", "Surtido", IIf(tipo = "Merma", "Producto dañado", "Consumo interno"))))

    delta = IIf(tipo = "Entrada", cantidad, -cantidad)
    hp.Cells(p, 5).Value = Val(hp.Cells(p, 5).Value) + delta
    resultante = Val(hp.Cells(p, 5).Value)
    AnotarMovimiento codigo, CStr(hp.Cells(p, 2).Value), tipo, delta, resultante, motivo, 0

    ThisWorkbook.Save
    MsgBox tipo & " registrada." & vbCrLf & hp.Cells(p, 2).Value & " queda en " & resultante & " piezas.", _
           vbInformation, "Listo"
End Sub

' ------------------------------------------------------------------ catalogo

Public Sub NuevoProducto()
    Dim codigo As String
    codigo = Trim(InputBox("Escanea o escribe el codigo de barras." & vbCrLf & _
                           "(dejalo vacio si el producto no tiene codigo)", "Nuevo producto"))
    AltaProducto codigo
End Sub

Private Function AltaProducto(ByVal codigo As String) As Boolean
    Dim hp As Worksheet, f As Long, nombre As String, precio As Double, costo As Double, existencia As Double

    Set hp = Hoja(H_PROD)
    If codigo <> "" Then
        If FilaProducto(codigo) > 0 Then
            MsgBox "Ese codigo ya esta registrado.", vbInformation, "Nuevo producto"
            Exit Function
        End If
    End If

    nombre = Trim(InputBox("Nombre del producto:", "Nuevo producto"))
    If nombre = "" Then Exit Function
    precio = Val(InputBox("Precio de venta:", "Nuevo producto"))
    If precio <= 0 Then Exit Function
    costo = Val(InputBox("Costo (opcional, sirve para calcular la ganancia):", "Nuevo producto", "0"))
    existencia = Val(InputBox("Existencia inicial:", "Nuevo producto", "0"))

    f = UltimaFila(hp, 2) + 1
    hp.Cells(f, 1).NumberFormat = "@"
    hp.Cells(f, 1).Value = codigo
    hp.Cells(f, 2).Value = nombre
    hp.Cells(f, 3).Value = precio
    hp.Cells(f, 4).Value = costo
    hp.Cells(f, 5).Value = existencia
    hp.Cells(f, 6).Value = CfgNum(C_MINIMO)
    hp.Cells(f, 7).Value = 0

    If existencia > 0 Then
        AnotarMovimiento codigo, nombre, "Entrada", existencia, existencia, "Existencia inicial", 0
    End If

    ThisWorkbook.Save
    AltaProducto = True
End Function

' --------------------------------------------------------------------- corte

Public Sub CorteDeHoy()
    Hoja("CORTE").Range("B2").Value = Date
    Hoja("CORTE").Activate
End Sub

Public Sub MandarCorte()
    Dim hc As Worksheet, tel As String, t As String
    Set hc = Hoja("CORTE")
    t = Cfg(C_NEGOCIO) & vbLf & _
        "Corte del " & Format(hc.Range("B2").Value, "dd/mm/yyyy") & vbLf & _
        "--------------------------------" & vbLf & _
        "Tickets: " & hc.Range("B4").Value & vbLf & _
        "Piezas: " & hc.Range("B5").Value & vbLf & _
        "Efectivo: " & Pesos(hc.Range("B7").Value) & vbLf & _
        "Tarjeta/transferencia: " & Pesos(hc.Range("B8").Value) & vbLf & _
        "VENTA TOTAL: " & Pesos(hc.Range("B6").Value) & vbLf & _
        "Utilidad estimada: " & Pesos(hc.Range("B9").Value)

    tel = Trim(InputBox("¿A que WhatsApp mando el corte?" & vbCrLf & "(10 digitos)", "Mandar corte"))
    If tel = "" Then Exit Sub
    EnviarWhatsApp tel, t
End Sub

' ------------------------------------------------------------------ respaldo

Public Sub Respaldar()
    Dim destino As String, carpeta As String
    carpeta = ThisWorkbook.Path & Application.PathSeparator & "Respaldos"
    If Dir(carpeta, vbDirectory) = "" Then MkDir carpeta
    destino = carpeta & Application.PathSeparator & "POS-" & Format(Now, "yyyy-mm-dd_hhmm") & ".xlsm"
    ThisWorkbook.Save
    ThisWorkbook.SaveCopyAs destino
    MsgBox "Respaldo guardado en:" & vbCrLf & destino & vbCrLf & vbCrLf & _
           "Copialo a una USB o subelo a tu correo.", vbInformation, "Respaldo"
End Sub

Public Sub IrAVender()
    Hoja(H_VENTA).Activate
    Hoja(H_VENTA).Range("B3").Select
End Sub
