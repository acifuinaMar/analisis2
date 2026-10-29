# -*- coding: utf-8 -*-
"""
Genera el documento tecnico del E7 del Proyecto Final.

Solo se usan caracteres de WinAnsi: las fuentes estandar de ReportLab no
traen flechas ni palomitas, y saldrian como cuadros negros.
"""

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table,
    TableStyle
)

SALIDA = (
    r"C:\Users\ninez\OneDrive\Desktop\Analisis 2 Proyecto"
    r"\docs\proyecto-final\E7\documento-tecnico.pdf"
)

AZUL = colors.HexColor("#1F3A5F")
GRIS = colors.HexColor("#5A6472")
GRIS_CLARO = colors.HexColor("#EDEFF2")
LINEA = colors.HexColor("#C9CFD8")

base = getSampleStyleSheet()

E = {
    "titulo": ParagraphStyle(
        "titulo", parent=base["Title"], fontName="Helvetica-Bold",
        fontSize=24, leading=29, textColor=AZUL, spaceAfter=4
    ),
    "subtitulo": ParagraphStyle(
        "subtitulo", parent=base["Normal"], fontName="Helvetica",
        fontSize=13, leading=17, textColor=GRIS, alignment=TA_CENTER
    ),
    "portada": ParagraphStyle(
        "portada", parent=base["Normal"], fontName="Helvetica",
        fontSize=10.5, leading=16, alignment=TA_CENTER, textColor=GRIS
    ),
    "h1": ParagraphStyle(
        "h1", parent=base["Heading1"], fontName="Helvetica-Bold",
        fontSize=15, leading=19, textColor=AZUL,
        spaceBefore=16, spaceAfter=7
    ),
    "h2": ParagraphStyle(
        "h2", parent=base["Heading2"], fontName="Helvetica-Bold",
        fontSize=11.5, leading=15, textColor=colors.HexColor("#2C4A70"),
        spaceBefore=11, spaceAfter=4
    ),
    "p": ParagraphStyle(
        "p", parent=base["Normal"], fontName="Helvetica",
        fontSize=9.6, leading=14.2, alignment=TA_JUSTIFY, spaceAfter=6
    ),
    "li": ParagraphStyle(
        "li", parent=base["Normal"], fontName="Helvetica",
        fontSize=9.6, leading=14, leftIndent=14, bulletIndent=4,
        alignment=TA_JUSTIFY, spaceAfter=3.5
    ),
    "cita": ParagraphStyle(
        "cita", parent=base["Normal"], fontName="Helvetica-Oblique",
        fontSize=9.3, leading=13.5, leftIndent=16, rightIndent=10,
        textColor=GRIS, spaceBefore=4, spaceAfter=7
    ),
    "mono": ParagraphStyle(
        "mono", parent=base["Normal"], fontName="Courier",
        fontSize=7.9, leading=10.4, leftIndent=8, spaceBefore=3,
        spaceAfter=7
    ),
    "pie": ParagraphStyle(
        "pie", parent=base["Normal"], fontName="Helvetica",
        fontSize=7.6, textColor=GRIS, alignment=TA_CENTER
    ),
    "th": ParagraphStyle(
        "th", parent=base["Normal"], fontName="Helvetica-Bold",
        fontSize=8.2, leading=11, textColor=colors.white
    ),
    "td": ParagraphStyle(
        "td", parent=base["Normal"], fontName="Helvetica",
        fontSize=8.2, leading=11
    ),
    "tdb": ParagraphStyle(
        "tdb", parent=base["Normal"], fontName="Helvetica-Bold",
        fontSize=8.2, leading=11
    ),
}


def p(texto, estilo="p"):
    return Paragraph(texto, E[estilo])


def vinetas(elementos):
    return [Paragraph(t, E["li"], bulletText="\u2022") for t in elementos]


def bloque(texto):
    lineas = texto.strip("\n").split("\n")
    return Paragraph(
        "<br/>".join(
            l.replace(" ", "&nbsp;").replace("<", "&lt;").replace(">", "&gt;")
            for l in lineas
        ),
        E["mono"],
    )


def tabla(cabeceras, filas, anchos, negrita_primera=False):
    datos = [[Paragraph(c, E["th"]) for c in cabeceras]]
    for f in filas:
        fila = []
        for i, celda in enumerate(f):
            est = "tdb" if (negrita_primera and i == 0) else "td"
            fila.append(Paragraph(str(celda), E[est]))
        datos.append(fila)

    t = Table(datos, colWidths=anchos, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), AZUL),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.4, LINEA),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GRIS_CLARO]),
    ]))
    return t


def pie_de_pagina(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.6)
    canvas.setFillColor(GRIS)
    canvas.drawCentredString(
        A4[0] / 2.0, 1.1 * cm,
        "Credito Vecino, S.A.  -  Analisis de Sistemas II (037)  -  "
        "Proyecto Final  -  pagina %d" % doc.page
    )
    canvas.setStrokeColor(LINEA)
    canvas.setLineWidth(0.4)
    canvas.line(2.2 * cm, 1.6 * cm, A4[0] - 2.2 * cm, 1.6 * cm)
    canvas.restoreState()


A = A4[0] - 4.4 * cm   # ancho util
h = []

# ───────────────────────────────── PORTADA
h += [
    Spacer(1, 4.2 * cm),
    p("Credito Vecino, S.A.", "titulo"),
    p("Documento tecnico del asistente conversacional", "subtitulo"),
    Spacer(1, 1.6 * cm),
    Table(
        [[""]], colWidths=[6 * cm], rowHeights=[2],
        style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), AZUL)]),
        hAlign="CENTER",
    ),
    Spacer(1, 1.6 * cm),
    p(
        "Arquitectura del asistente, estrategia de RAG,<br/>"
        "decisiones de diseno y resultados de las pruebas",
        "portada",
    ),
    Spacer(1, 2.2 * cm),
    p(
        "<b>Universidad Mariano Galvez de Guatemala</b><br/>"
        "Analisis de Sistemas II (037)<br/>"
        "Segundo semestre 2026",
        "portada",
    ),
    Spacer(1, 1.4 * cm),
    p(
        "Maryori Elizabeth Acifuina Juarez<br/>"
        "Dalila Nineth Zacarias de Leon<br/>"
        "Eric Alexander Barillas Orozco<br/>"
        "Hilton Alexander Lopez Ic",
        "portada",
    ),
    Spacer(1, 1.6 * cm),
    p("28 de octubre de 2026", "portada"),
    PageBreak(),
]

# ───────────────────────────────── 1. ALCANCE
h += [
    p("1. Alcance de este documento", "h1"),
    p(
        "Este documento describe el asistente conversacional de Credito "
        "Vecino: como esta construido, que decisiones de diseno lo "
        "sostienen y que resultados arrojan sus propias pruebas. No repite "
        "el manual de instalacion, que vive en el README del repositorio."
    ),
    p(
        "La regla que gobierna todo el sistema, y que conviene tener "
        "presente al leer lo que sigue, es una sola:"
    ),
    p(
        "Ninguna cifra se calcula fuera del nucleo de dominio. La base de "
        "datos guarda hechos, el servidor MCP los expone y el modelo de "
        "lenguaje redacta la respuesta, pero quien calcula es siempre el "
        "nucleo construido en el Proyecto 1 y evolucionado en el "
        "Proyecto 2.",
        "cita",
    ),
    p(
        "De esa regla se deriva el reparto de responsabilidades del "
        "asistente: el modelo decide <i>que</i> herramienta invocar y como "
        "explicar el resultado; el nucleo decide <i>cuanto</i>."
    ),

    p("2. Arquitectura del asistente", "h1"),
    p(
        "El sistema es hexagonal. El nucleo no conoce la base de datos, ni "
        "la red, ni el reloj: todo lo externo entra por un <b>puerto</b> y "
        "se satisface con un <b>adaptador</b>. El asistente se agrega como "
        "una capa mas sobre esos mismos puertos, sin tocar el dominio."
    ),
    bloque(
        """
   PREGUNTA EN LENGUAJE NATURAL
             |
   +---------v-----------------------------------------+
   |  ORQUESTADOR DEL CHAT (E5)                        |
   |  Decide si la pregunta necesita documentos,       |
   |  cifras, las dos o ninguna. Recuerda la sesion.   |
   +------+--------------------------------+-----------+
          |                                |
   +------v---------+            +---------v-----------+
   |  RAG (E4)      |            |  SERVIDOR MCP (E3)  |
   |  pgvector +    |            |  9 herramientas     |
   |  Gemini        |            |  con esquemas Zod   |
   +------+---------+            +---------+-----------+
          |                                |
   +------v---------+            +---------v-----------+
   |  Corpus        |            |  ConsultasCartera   |<--+
   |  7 documentos  |            |  (servicios)        |   |
   +----------------+            +---------+-----------+   |
                                           |         API REST
                                           |         (E1, Express)
                                           |          el frontend
                                           |
                        +------------------v------------------+
                        |   NUCLEO DE DOMINIO (P1 / P2)       |
                        |   Dinero - Cuota - Plan frances     |
                        |   Prelacion - Estados - Cartera     |
                        |   Politicas de mora versionadas     |
                        +------------------+------------------+
                                           |
                                  puerto RepositorioCartera
                              +------------+------------+
                              |                         |
                       +------v------+          +-------v------+
                       |  CSV        |          |  PostgreSQL  |
                       |  (pruebas)  |          |  (E2, real)  |
                       +-------------+          +--------------+
        """
    ),
    p(
        "Las dos ramas del asistente responden preguntas distintas. El RAG "
        "contesta <i>que dice la politica</i>; el servidor MCP contesta "
        "<i>cuanto debe este credito</i>. Mezclarlas seria el error que el "
        "enunciado busca evitar: un modelo de lenguaje estimando cifras."
    ),
    p("2.1 Una sola fuente de cifras para las dos entradas", "h2"),
    p(
        "El servidor MCP y la API REST son DOS ADAPTADORES del mismo "
        "servicio de consultas, y reutilizan los mismos esquemas Zod. No "
        "es un detalle de organizacion: es lo que impide que el tablero "
        "que ve la gerencia y la respuesta que da el chat difieran. Si "
        "cada entrada calculara por su cuenta habria dos fuentes de "
        "verdad para la misma cifra, y dos fuentes de verdad siempre "
        "divergen."
    ),
    p(
        "La API hace cumplir las mismas reglas: la fecha de corte es "
        "obligatoria en toda consulta, y un pago sin confirmacion "
        "explicita solo devuelve la vista previa. El perfil —asesor o "
        "gerencia— se verifica en el servidor y no en la interfaz, porque "
        "ocultar un boton no es un control de acceso. No es "
        "autenticacion: el enunciado la deja expresamente fuera en su "
        "seccion 3.1, y pide unicamente distinguir los dos perfiles."
    ),
    p("2.2 Los dos adaptadores del repositorio", "h2"),
    p(
        "El puerto <font name='Courier' size='9'>RepositorioCartera</font> "
        "devuelve <b>hechos registrados</b> -un desembolso y sus pagos-, "
        "no estado calculado. El saldo, el tramo y las cuotas vencidas los "
        "reconstruye el nucleo reproduciendo los eventos, tal como "
        "establece el paquete canonico. Asi cualquier cifra del cierre se "
        "puede auditar meses despues."
    ),
    p(
        "Existen dos implementaciones y son <b>intercambiables</b>. La de "
        "PostgreSQL persiste; la de archivos vive en memoria y es el doble "
        "de pruebas, lo que permite que la suite corra sin red ni "
        "credenciales. Las pruebas comprueban que ambas devuelven "
        "exactamente lo mismo para todo el paquete y que el nucleo produce "
        "identicas cifras con cualquiera de las dos."
    ),
]

# ───────────────────────────────── 3. CAPACIDADES
h += [
    p("3. Las capacidades del asistente", "h1"),
    p(
        "Las ocho capacidades minimas del enunciado se exponen como nueve "
        "herramientas MCP, descritas con esquemas Zod. El mismo esquema "
        "valida la entrada y genera el contrato OpenAPI."
    ),
    tabla(
        ["Herramienta", "Capacidad", "Se ejercita en"],
        [
            ["consultar_credito", "Consultar un credito", "G-5"],
            ["calcular_deuda_de_cuota", "Calcular la deuda de una cuota",
             "OP-1, OP-2"],
            ["explicar_mora", "Explicar una mora", "G-5, G-7"],
            ["listar_creditos_en_mora", "Listar creditos en mora", "G-4"],
            ["proximos_vencimientos", "Ver proximos vencimientos", "G-6"],
            ["consultar_cartera", "Consultar la cartera", "G-1"],
            ["consultar_cierre_diario", "Consultar un cierre", "G-3"],
            ["consultar_cierre_mensual", "Consultar un cierre", "G-2"],
            ["<b>registrar_pago</b> (sensible)", "Registrar un pago",
             "OP-1, OP-2, OP-4 a OP-6"],
        ],
        [A * 0.34, A * 0.42, A * 0.24],
        negrita_primera=True,
    ),
    Spacer(1, 8),
    p(
        "El cierre son dos herramientas en lugar de una con un parametro "
        "de tipo: cada una recibe algo distinto -una fecha o un mes-, y un "
        "unico campo que cambia de formato segun otro campo es la clase de "
        "firma que el asistente llena mal."
    ),
    p("3.1 Tres reglas que gobiernan todas las herramientas", "h2"),
    *vinetas([
        "<b>Solo lectura por defecto.</b> Las ocho consultas se declaran "
        "en el protocolo con <font name='Courier' size='9'>readOnlyHint"
        "</font>, de modo que el cliente puede aprobarlas sin preguntar. "
        "Una sola escribe, y se declara <font name='Courier' size='9'>"
        "destructiveHint</font>.",

        "<b>La fecha de corte llega como parametro.</b> Ninguna "
        "herramienta lee el reloj del sistema: es el puerto Reloj del "
        "Proyecto 1. Con mora escalonada pesa mas que nunca, porque el "
        "tramo depende de la fecha.",

        "<b>Errores con convencion uniforme.</b> Cada rechazo trae un "
        "codigo estable contra el que el cliente puede programar, y un "
        "campo con los datos necesarios para reaccionar: el rechazo por "
        "monto no exacto informa cual es el monto correcto.",
    ]),
    Spacer(1, 6),
    tabla(
        ["Codigo de error", "Cuando se produce"],
        [
            ["CREDITO_INEXISTENTE", "El credito no existe"],
            ["CUOTA_INEXISTENTE", "La cuota no existe en el plan"],
            ["CUOTA_YA_PAGADA", "No hay deuda exigible que pagar"],
            ["CREDITO_INCOBRABLE",
             "Supera los 120 dias, o ya se dio de baja contable"],
            ["MONTO_NO_EXACTO",
             "Incluye el monto correcto, la diferencia y el desglose"],
            ["FECHA_INVALIDA", "La fecha no existe en el calendario"],
            ["VENTANA_INVALIDA",
             "La ventana de dias no es un entero positivo"],
        ],
        [A * 0.34, A * 0.66],
        negrita_primera=True,
    ),
]

# ───────────────────────────────── 4. RAG
h += [
    p("4. Estrategia de RAG", "h1"),
    p(
        "El modulo RAG responde preguntas sobre las politicas "
        "institucionales usando los siete documentos del corpus canonico, "
        "y cita la fuente de cada afirmacion."
    ),
    p("4.1 Recorrido de una consulta", "h2"),
    *vinetas([
        "El usuario formula una pregunta.",
        "Gemini genera un embedding de la pregunta.",
        "PostgreSQL con pgvector recupera los fragmentos mas similares "
        "por distancia coseno.",
        "Gemini Flash redacta una respuesta usando esos fragmentos como "
        "contexto documental.",
        "El sistema valida que los identificadores citados pertenezcan "
        "efectivamente a los fragmentos recuperados.",
        "Se entrega la respuesta, o un aviso de que no fue posible "
        "validar las referencias.",
    ]),
    p("4.2 Fragmentacion", "h2"),
    tabla(
        ["Parametro", "Valor y razon"],
        [
            ["Tamano maximo", "1000 caracteres"],
            ["Solapamiento", "150 caracteres al dividir bloques largos"],
            ["Criterio de corte",
             "Parrafos Markdown primero; division adicional solo si el "
             "bloque excede el tamano"],
            ["Identificadores",
             "Estables por documento y posicion, p. ej. "
             "POL-2024-01-chunk-1"],
        ],
        [A * 0.26, A * 0.74],
        negrita_primera=True,
    ),
    Spacer(1, 6),
    p(
        "<b>Por que asi.</b> Cortar por parrafos respeta la unidad "
        "semantica de un documento normativo, donde cada parrafo suele ser "
        "una regla completa. El limite de 1000 caracteres evita enviar "
        "documentos enteros al modelo generativo, y el solapamiento "
        "protege las reglas que quedan partidas a la mitad de un bloque "
        "largo. Los identificadores estables son lo que hace verificable "
        "la citacion: sin ellos no se podria comprobar que lo citado "
        "exista."
    ),
    p(
        "El solapamiento se aplica al dividir bloques largos; no se "
        "garantiza entre todos los fragmentos separados por parrafos. Se "
        "documenta la limitacion en lugar de presentarla como una garantia "
        "que no se cumple."
    ),
    p("4.3 Embeddings y almacenamiento", "h2"),
    tabla(
        ["Componente", "Eleccion"],
        [
            ["Proveedor", "Google Gemini"],
            ["Modelo de embeddings", "gemini-embedding-001, 768 dimensiones"],
            ["Tipos de tarea",
             "RETRIEVAL_DOCUMENT al indexar, RETRIEVAL_QUERY al buscar"],
            ["Modelo generativo", "gemini-3.8-flash"],
            ["Almacenamiento",
             "PostgreSQL con pgvector, tabla public.rag_fragmentos"],
            ["Busqueda", "Distancia coseno, hasta cinco fragmentos"],
        ],
        [A * 0.28, A * 0.72],
        negrita_primera=True,
    ),
    Spacer(1, 6),
    p(
        "<b>Por que un servicio y no un modelo local.</b> Genera "
        "representaciones semanticas de calidad sin exigir hardware para "
        "ejecutar un modelo pesado, lo que mantiene el proyecto "
        "reproducible en las maquinas del equipo. Distinguir el tipo de "
        "tarea entre indexar y consultar mejora la recuperacion, porque el "
        "modelo optimiza vectores asimetricos para cada papel."
    ),
    p("4.4 Citacion y su limite", "h2"),
    p(
        "El asistente debe citar el identificador completo del fragmento. "
        "La validacion comprueba que cada identificador citado pertenezca "
        "al conjunto recuperado, y descarta la respuesta si no es asi."
    ),
    p(
        "Conviene ser preciso sobre lo que esa comprobacion demuestra: "
        "verifica la <b>trazabilidad</b> de la cita, no que cada "
        "afirmacion este respaldada por el contenido citado. Es una "
        "garantia real y acotada, y se declara como tal."
    ),
]

# ───────────────────────────────── 5. DECISIONES
h += [
    p("5. El orquestador del chat", "h1"),
    p(
        "El asistente tiene dos ramas y una pregunta puede necesitar las "
        "dos. El orquestador decide cual usar, mantiene la memoria de la "
        "sesion para que las preguntas encadenadas tengan contexto, y "
        "detiene la unica accion sensible hasta que una persona la "
        "aprueba."
    ),
    p(
        "No depende de la interfaz. La pantalla del E1 consumira el mismo "
        "objeto —preguntar, aprobarPago, rechazarPago, historial—, asi que "
        "la logica del chat se prueba sin navegador."
    ),
    p("5.1 El modelo de lenguaje entra por un puerto", "h2"),
    p(
        "ModeloLenguaje se inyecta, igual que el repositorio de cartera. "
        "Importa por dos razones concretas. La primera es que las pruebas "
        "corren sin red ni clave de API: toda la orquestacion se ejercita "
        "con un modelo guionizado, de forma determinista. Sin eso, probar "
        "el chat exigiria llamar a un modelo real, que ni es gratis ni "
        "devuelve lo mismo dos veces. La segunda es que el puerto no "
        "expone el formato del proveedor: usa un vocabulario propio y el "
        "adaptador traduce."
    ),
    p(
        "Las pruebas corren contra el servidor MCP REAL, atravesando el "
        "protocolo, con el adaptador del paquete canonico detras. Solo se "
        "sustituye el modelo, de modo que las cifras que se afirman son "
        "las del nucleo."
    ),
    p("5.2 La aprobacion la concede el orquestador, no el modelo", "h2"),
    p(
        "Cuando el modelo propone un pago, el orquestador fija el campo de "
        "confirmacion en falso VENGA COMO VENGA en los argumentos, "
        "ejecuta la vista previa y se detiene devolviendo el desglose de "
        "la prelacion. La confirmacion solo la pone el metodo que llama "
        "una persona."
    ),
    p(
        "Es la tercera barrera, sobre las dos que ya tenia la herramienta. "
        "Hay una prueba dedicada: aunque el modelo pida explicitamente la "
        "confirmacion, no se aplica nada. Un rechazo del nucleo, en "
        "cambio, no pide aprobacion porque no hay nada que aprobar: el "
        "monto no exacto y el credito incobrable vuelven al modelo para "
        "que los explique."
    ),
    p("5.3 Aprobar y poder aprobar son dos cosas distintas", "h2"),
    p(
        "La aprobacion humana y el perfil responden preguntas diferentes, "
        "y el pago necesita las dos respuestas. La aprobacion responde si "
        "una persona dijo que si a ESTE monto, y la concede el metodo que "
        "llama la interfaz. El perfil responde si esa persona tiene "
        "permiso de mover dinero, y lo decide la sesion."
    ),
    p(
        "Hacen falta las dos. Un gerente que aprueba pasa el primer "
        "control y falla el segundo: si el chat exigiera solo la "
        "aprobacion, seria la puerta de atras del modelo de permisos, "
        "porque registrar un pago esta reservado al perfil asesor en la "
        "API y lo que la gerencia no puede hacer por REST lo conseguiria "
        "pidiendoselo al asistente. El chat verifica los dos, y el metodo "
        "de aprobacion es el unico punto donde se cruzan."
    ),
    p(
        "La vista previa si corre para cualquier perfil, y no es un "
        "descuido: no escribe nada, y revisar el desglose de la prelacion "
        "antes de que el pago ocurra es justo lo que la gerencia necesita "
        "poder hacer. Lo que el perfil decide es quien puede aplicarlo "
        "despues."
    ),
    p(
        "El perfil se verifica ANTES de mirar si hay un pago pendiente. "
        "Un control de acceso no debe depender del estado que protege, ni "
        "delatar en su mensaje de error si habia una operacion en curso. "
        "Y la lista de perfiles vive en un modulo que COMPARTEN la API y "
        "el chat: dos listas que deberian ser iguales acaban divergiendo, "
        "y el dia que divergieran el chat permitiria algo que la API "
        "prohibe. Una prueba compara las dos."
    ),
    p("5.4 Las instrucciones heredan las del modulo documental", "h2"),
    p(
        "Las reglas del asistente se construyen SOBRE las del modulo RAG "
        "en vez de repetirlas. Dos juegos de reglas para el mismo "
        "asistente acabarian contradiciendose, y entonces no se sabria "
        "cual rige. Las del E4 gobiernan como tratar los documentos; las "
        "del chat agregan como usar las herramientas: toda cifra viene de "
        "una herramienta, toda consulta necesita su fecha de corte, y el "
        "pago jamas se propone por iniciativa propia."
    ),

    p("6. Decisiones de diseno", "h1"),
    p(
        "Se recogen las decisiones que cambiaron cifras o que estuvieron en "
        "duda. Las que fueron evidentes no se documentan."
    ),

    p("6.1 El dinero se representa en centavos enteros", "h2"),
    p(
        "Un importe es un numero entero de centavos, nunca un decimal de "
        "punto flotante. Es la decision mas antigua del proyecto y la que "
        "mas se nota: permite comparar montos con igualdad exacta, que es "
        "lo que exige rechazar un pago por no ser el monto preciso. El "
        "redondeo es medio hacia arriba y ocurre en un unico lugar."
    ),

    p("6.2 La mora escalonada suma tramos recorridos", "h2"),
    p(
        "Una cuota con 45 dias de atraso no estuvo 45 dias en Mora 2: "
        "estuvo 30 en Mora 1 y lleva 15 en Mora 2. El interes es la suma "
        "sobre los tramos recorridos, y <b>el redondeo ocurre una sola "
        "vez</b>, al cerrar el calculo."
    ),
    p(
        "Esa decision produce una diferencia visible que el sistema "
        "explica en lugar de esconder. Sobre un capital en mora de "
        "Q725.76 con 45 dias:"
    ),
    bloque(
        """
  Mora 1    30 dias   18 %   Q 10.89
  Mora 2    15 dias   24 %   Q  7.26
  ---------------------------------------------
  Suma de los tramos ya redondeados   Q 18.15
  Total, con un unico redondeo        Q 18.14
        """
    ),
    p(
        "La herramienta devuelve las dos cifras y una marca de que "
        "difieren, para que la pantalla pueda justificar el centavo. "
        "Redondear tramo por tramo seria un descuadre contable por cuota."
    ),

    p("6.3 El gasto de gestion solo aplica a una politica", "h2"),
    p(
        "El enunciado del Proyecto 2 no aclaraba si el gasto de Q25 "
        "alcanzaba a los creditos con politica plana. El paquete canonico "
        "lo resuelve: solo aplica a POL-2026-10. Se modelo como "
        "<b>dato</b> de la politica y no como constante de codigo, de modo "
        "que el nucleo no tenga que elegir por su cuenta. Sin esa "
        "correccion, los creditos de politica plana mostraban Q25 de mas."
    ),

    p("6.4 Dos correcciones del nucleo que el paquete canonico revelo", "h2"),
    p(
        "Al recorrer la cartera completa aparecieron los 75 creditos en "
        "mora, lo que era imposible. El diagnostico encontro dos errores, "
        "y ninguno estaba en una formula: los dos eran condiciones."
    ),
    p(
        "<b>La primera cuota vencia el dia del desembolso.</b> El plan "
        "quedaba corrido un mes. En una amortizacion francesa el primer "
        "pago cierra el primer periodo de devengo: la cuota n vence n "
        "meses despues del desembolso. Lo confirman dos caminos "
        "independientes: de los 228 pagos del paquete, 200 caen "
        "exactamente en la fecha de desembolso mas k meses con k mayor o "
        "igual a 1, y ninguno el dia del desembolso; y con el plan "
        "corregido la consulta G-7 reproduce el caso M-2 del enunciado del "
        "Proyecto 2 -45 dias sobre Q725.76 igual a Q18.14-, mientras que "
        "con el plan corrido daba 75 dias y Q34.47, cifra que no "
        "corresponde a ningun oraculo."
    ),
    p(
        "<b>Un pago puntual no saldaba su cuota.</b> La lista de cuotas "
        "cobrables exigia al menos un dia de atraso, asi que un pago hecho "
        "el mismo dia del vencimiento no encontraba nada que saldar y se "
        "desviaba entero por la via del excedente, que por diseno abona "
        "solo a capital y nunca al interes. El cliente pagaba completo y a "
        "tiempo, y su cuota quedaba parcial debiendo justamente el "
        "interes. Se separaron dos nociones que difieren en un dia: "
        "<i>vencida</i> -ya acumula atraso, devenga mora y clasifica el "
        "tramo- y <i>exigible</i> -ya llego su vencimiento y se puede "
        "cobrar-."
    ),
    p(
        "Efecto conjunto: la cartera paso de 75 creditos en mora a 16 en "
        "mora y 59 al dia. El reparto por tramo coincide exactamente con "
        "contar, directamente sobre los archivos del paquete, cuantas "
        "cuotas llevaba vencidas cada credito frente a cuantos pagos "
        "recibio. Los oraculos del enunciado se cumplen ahora sin haber "
        "sido modificados."
    ),

    p("6.5 La accion sensible tiene doble barrera", "h2"),
    p(
        "Registrar un pago es la unica operacion que escribe. Exige dos "
        "cosas independientes:"
    ),
    *vinetas([
        "La herramienta se declara destructiva en el protocolo, para que "
        "el cliente MCP pida confirmacion.",
        "El servidor exige un campo de confirmacion explicito. Sin el, la "
        "llamada devuelve solo la vista previa con el desglose de la "
        "prelacion y no modifica nada.",
    ]),
    p(
        "La duplicidad es deliberada: la anotacion es una pista que el "
        "cliente puede ignorar, mientras que el campo lo comprueba el "
        "servidor, que es quien no debe confiar en nadie."
    ),
    p(
        "El monto debe ser exactamente la deuda exigible al corte, porque "
        "es sobre ese total que opera la cadena de prelacion. Pagarlo "
        "exacto deja el credito sin cuotas vencidas y lo regulariza a "
        "vigente. No se aceptan pagos parciales por esta via: el nucleo "
        "sabe aplicarlos, pero un parcial es una decision de negocio que "
        "el asesor toma en ventanilla con el cliente delante, no algo que "
        "convenga delegar a un chat."
    ),

    p("6.6 La idempotencia se resuelve antes de validar", "h2"),
    p(
        "Una clave de idempotencia repetida significa que esa operacion ya "
        "se registro, y el reintento debe devolver el mismo desenlace sin "
        "importar como haya cambiado la cartera. Por eso la comprobacion "
        "ocurre <b>antes</b> de cualquier regla de negocio."
    ),
    p(
        "El orden no es cosmetico. Cuando llega el reintento, el pago "
        "original ya dejo el credito al dia y sin cuotas vencidas, asi que "
        "validar primero hacia que el reintento muriera con un \u201cno hay "
        "deuda exigible\u201d en lugar del \u201cya estaba registrado, no se "
        "volvio a cobrar\u201d que el reintento necesita oir."
    ),

    p("6.7 Se rechaza el cobro de un credito con mas de 120 dias", "h2"),
    p(
        "Declarar un credito incobrable es una decision contable, y el "
        "nucleo nunca la toma solo. Por eso un credito con 130 dias de "
        "atraso sigue en estado de mora y tecnicamente admitiria pagos."
    ),
    p(
        "La herramienta lo rechaza igual. Cobrarlo por la via normal lo "
        "mantendria en la cartera cuando las reglas obligan a darlo de "
        "baja, y clasificaria el dinero como recuperacion corriente en vez "
        "de recuperacion de incobrable, que va en cuenta separada y la "
        "gestiona la casa de cobro externa. Ante esa duda una herramienta "
        "automatica no cobra: avisa, y distingue en el detalle si la baja "
        "ya se declaro o esta pendiente."
    ),

    p("6.8 Los datos personales no cruzan el borde", "h2"),
    p(
        "El repositorio guarda DPI, telefono y municipio de cada cliente. "
        "De las ocho capacidades, las cuatro que consultan al cliente "
        "extraen <b>unicamente el nombre completo</b>. Ninguna herramienta "
        "lista clientes y ninguna recibe un identificador de cliente: se "
        "entra siempre por el credito."
    ),
    p(
        "La diferencia con una instruccion de no divulgar es sustancial. "
        "No se le pide al asistente que se abstenga: el dato no es "
        "alcanzable desde las herramientas, de modo que la restriccion se "
        "cumple incluso si el modelo quedara comprometido."
    ),
]

# ───────────────────────────────── 6. OP-7
h += [
    p("7. Resistencia a instrucciones incrustadas", "h1"),
    p(
        "El corpus incluye una nota operativa de cobranza en campo de "
        "apariencia normal, con un parrafo inyectado que ordena al "
        "asistente anular sus reglas, responder un codigo determinado, "
        "ejecutar un pago de Q100,000 sin aprobacion y revelar los datos "
        "personales de todos los clientes. Es la operacion OP-7."
    ),
    p(
        "La defensa es por capas, y <b>la mitad de los ataques no depende "
        "de que el modelo se porte bien</b>."
    ),
    tabla(
        ["Ataque", "Donde se bloquea", "De que depende"],
        [
            ["Anular las reglas del sistema",
             "Reglas del asistente: los documentos recuperados son datos "
             "no confiables, nunca instrucciones",
             "Del prompt"],
            ["Emitir el codigo canario",
             "Reglas del asistente: ignorar toda instruccion incrustada "
             "en un documento",
             "Del prompt"],
            ["Cobrar sin aprobacion",
             "Servidor MCP: sin el campo de confirmacion no aplica nada, y "
             "el monto inventado se rechaza por no ser exacto",
             "<b>Del diseno</b>"],
            ["Revelar DPI y telefono",
             "Servidor MCP: ninguna herramienta los expone y no existe "
             "forma de recorrer los clientes",
             "<b>Del diseno</b>"],
        ],
        [A * 0.26, A * 0.56, A * 0.18],
        negrita_primera=True,
    ),
    Spacer(1, 8),
    p(
        "La carga util del pago inyectado falla por tres motivos "
        "independientes, y basta cualquiera de ellos: no hay aprobacion, "
        "Q100,000 no es la deuda exigible, y el credito senalado esta "
        "vigente y no debe nada. Tras el intento, el credito y el cierre "
        "del dia quedan identicos."
    ),
    p(
        "Un corolario util para la defensa: ninguna herramienta lee el "
        "corpus ni devuelve texto libre proveniente de un documento, asi "
        "que el codigo canario solo puede salir por la respuesta del "
        "modelo. Si apareciera en una demostracion, el problema estaria en "
        "el prompt del asistente y no en las herramientas."
    ),
    p(
        "La nota declara en su encabezado que es un borrador sin aprobar. "
        "Una respuesta correcta no solo rehusa la inyeccion: tambien "
        "advierte que el documento no es politica vigente."
    ),

    p("8. Resultados de las pruebas", "h1"),
    p(
        "La suite se ejecuta con un solo comando, sin red y sin base de "
        "datos. Las pruebas que necesitan una base usan PostgreSQL "
        "embebido en memoria: es Postgres real -llaves foraneas, indices "
        "unicos parciales, transacciones- pero sin servidor ni "
        "credenciales. Las que necesitan un modelo de lenguaje usan "
        "un modelo guionizado."
    ),
    bloque(
        """
  npm test

  Test Files   44 passed (44)
       Tests  639 passed (639)
        """
    ),
    tabla(
        ["Grupo", "Pruebas", "Que cubre"],
        [
            ["Nucleo del dominio (P1 y P2)", "254",
             "Dinero, plan frances, prelacion, estados, cartera en riesgo, "
             "politicas de mora y los oraculos del enunciado"],
            ["Servidor MCP y consultas (E3)", "132",
             "Que devuelva lo mismo que el nucleo y que rechace lo que "
             "debe rechazar"],
            ["Persistencia y adaptadores (E2)", "61",
             "Conteos, idempotencia, huella SHA-256 y paridad entre los "
             "dos adaptadores"],
            ["Modulo RAG (E4)", "61",
             "Fragmentacion, citacion, validacion y reglas de seguridad"],
            ["API REST (E1)", "43",
             "Rutas, perfiles verificados en el servidor, validacion de "
             "entrada y originacion de creditos"],
            ["Chat y evaluacion (E5 y E6)", "76",
             "Orquestacion, memoria de la sesion, la barrera de "
             "aprobacion, el perfil que puede aplicar el pago y los "
             "catorce casos de evaluacion"],
            ["Resistencia a inyeccion (OP-7)", "12",
             "Que los datos personales no sean alcanzables y que el pago "
             "inyectado no se aplique"],
        ],
        [A * 0.30, A * 0.12, A * 0.58],
        negrita_primera=True,
    ),
    Spacer(1, 8),
    p("8.1 Oraculos del enunciado reproducidos", "h2"),
    p(
        "Son las cifras que el enunciado fija de antemano. Se cumplen sin "
        "que las pruebas hayan sido ajustadas para que coincidan, lo que "
        "las vuelve utiles como deteccion de regresiones."
    ),
    tabla(
        ["Caso", "Cifra", "Que comprueba"],
        [
            ["P1 6.6.3", "Q1,011.88",
             "Pago exacto de una cuota vencida hace 15 dias"],
            ["P2 M-2", "Q18.14",
             "Mora escalonada a 45 dias, con un unico redondeo"],
            ["P2 M-3", "Q50.80", "Mora escalonada a 100 dias"],
            ["P2 M-5", "Q1,047.76",
             "Total adeudado con gasto de gestion incluido"],
            ["P2 CP-03", "Q21.77",
             "Un credito anterior a octubre conserva la mora plana"],
            ["P1 6.8.1", "7.00 %",
             "Cartera en riesgo sobre la cartera de referencia"],
            ["P2 7.8", "21.75 %",
             "Cartera en mora, distinta del riesgo, sobre la misma cartera"],
        ],
        [A * 0.16, A * 0.17, A * 0.67],
        negrita_primera=True,
    ),
    Spacer(1, 8),
    p("8.2 Evaluacion del asistente", "h2"),
    p(
        "Catorce casos: las siete consultas de gerencia del Anexo B, tres "
        "operaciones, dos de seguridad y dos de limite. Cada caso declara "
        "que herramientas deben invocarse, que cifras deben aparecer y que "
        "texto no debe aparecer."
    ),
    p(
        "Se mide, sobre todo, el fallo que mas importa atrapar: que el "
        "asistente invoque la herramienta correcta y luego diga una cifra "
        "DISTINTA a la que recibio. Tambien que se detenga a pedir "
        "aprobacion donde corresponde y solo ahi, y que ante una consulta "
        "sin fecha de corte la pregunte en vez de suponer la de hoy."
    ),
    p(
        "EL CONJUNTO NO PUEDE DESFASARSE EN SILENCIO. Un conjunto de "
        "evaluacion con cifras escritas a mano acaba midiendo nada: el "
        "nucleo cambia, las cifras esperadas se quedan viejas y la "
        "evaluacion sigue dando verde contra una expectativa equivocada. "
        "Por eso una prueba comprueba que cada cifra esperada siga "
        "apareciendo en la salida real de su herramienta, y que lo "
        "prohibido no aparezca: Q6.01 y Q34.47 son las cifras que daba el "
        "nucleo con el plan de amortizacion corrido un mes."
    ),
    p(
        "Las cifras se comparan por VALOR y no como texto. Comparar "
        "cadenas falla por los dos lados: sobra lo que no deberia, porque "
        "«130» aparece dentro de «1300»; y falta lo que si deberia, porque "
        "JSON serializa 36554.50 como «36554.5» mientras el asistente "
        "escribe «Q36,554.50», que es la misma cifra."
    ),
]

# ───────────────────────────────── 8. CIFRAS
h += [
    p("9. Cifras del asistente sobre el paquete canonico", "h1"),
    p(
        "Todas al 31 de octubre de 2026, la fecha en que el paquete deja "
        "la cartera congelada. Son las respuestas que el chat y las "
        "pantallas deben coincidir en mostrar."
    ),
    p("9.1 Estado de la cartera (G-1)", "h2"),
    tabla(
        ["Indicador", "Monto", "Sobre la cartera activa"],
        [
            ["Creditos activos", "66 de 75", ""],
            ["Cartera activa", "Q299,939.82", "denominador"],
            ["Cartera en mora", "Q48,715.17", "16.24 %"],
            ["Cartera en riesgo", "Q37,841.71", "12.62 %"],
            ["Dado por incobrable", "Q0.00", ""],
        ],
        [A * 0.34, A * 0.33, A * 0.33],
        negrita_primera=True,
    ),
    Spacer(1, 6),
    p(
        "La mora y el riesgo son indicadores <b>distintos</b> y se "
        "reportan por separado: la mora es operativa -quien no pago a "
        "tiempo- y el riesgo es estrategico -quien probablemente no "
        "pague-. Rotularlos igual llevaria al comite a decidir sobre el "
        "numero equivocado."
    ),
    Spacer(1, 4),
    tabla(
        ["Desglose del riesgo por tramo", "Creditos", "Saldo", "%"],
        [
            ["Mora 1 (1 a 30 dias)", "0", "Q0.00", "0.00 %"],
            ["Mora 2 (31 a 60)", "3", "Q7,000.00", "2.33 %"],
            ["Mora 3 (61 a 90)", "2", "Q1,954.26", "0.65 %"],
            ["Vencido (mas de 90)", "4", "Q6,638.30", "2.21 %"],
            ["Reestructurado al dia", "3", "Q22,249.15", "7.42 %"],
        ],
        [A * 0.36, A * 0.16, A * 0.26, A * 0.22],
        negrita_primera=True,
    ),
    Spacer(1, 6),
    p(
        "Dos lecturas que el tablero debe poder explicar. Mora 1 aporta "
        "cero porque el umbral del riesgo es <b>superar</b> los 30 dias. Y "
        "los tres creditos reestructurados estan al dia, pero entran igual "
        "y son el componente mas grande del indicador: la "
        "reestructuracion no borra el pasado. Sin ellos el riesgo seria "
        "Q15,592.56."
    ),
    p(
        "El reporte incluye ademas los dos creditos que ya superan los 120 "
        "dias y siguen en la cartera, por Q2,333.48. Van ahi porque "
        "declararlos incobrables <b>mejoraria</b> el porcentaje en riesgo "
        "sin haber cobrado un centavo, y ese porcentaje nunca debe "
        "reportarse solo."
    ),
    p("9.2 Cierre mensual de octubre (G-2)", "h2"),
    tabla(
        ["Concepto", "Monto"],
        [
            ["Desembolsos (10 creditos)", "Q41,000.00"],
            ["Pagos recibidos (42)", "Q36,554.50"],
            ["   Gastos de gestion", "Q0.00"],
            ["   Interes moratorio", "Q16.93"],
            ["   Interes corriente", "Q7,162.89"],
            ["   Capital", "Q29,374.68"],
            ["<b>Flujo neto</b>", "<b>Q -4,445.50</b>"],
        ],
        [A * 0.6, A * 0.4],
    ),
    Spacer(1, 6),
    p(
        "El gasto de gestion en cero es correcto: solo aplica a la "
        "politica escalonada, que rige los creditos otorgados desde "
        "octubre, y ninguno de esos alcanzo 31 dias de atraso antes del "
        "corte del paquete. El flujo neto es la unica cifra que puede ser "
        "negativa, y por eso no se modela como importe: un importe nunca "
        "es negativo, pero un flujo si."
    ),
    p(
        "El cierre del 31 de octubre viene en ceros, y es la respuesta "
        "correcta: el ultimo pago del paquete es del 30 y el ultimo "
        "desembolso del 28. Por eso el cierre reporta tambien la "
        "<b>cantidad</b> de movimientos, para que el asistente pueda "
        "distinguir \u201cno hubo movimiento\u201d de un fallo."
    ),
    p("9.3 Operaciones del guion", "h2"),
    tabla(
        ["Op.", "Credito", "Resultado"],
        [
            ["OP-1", "CV-2026-0043",
             "Q1,114.54 saldan las cuotas 1 y 2. Pasa de mora a vigente; "
             "el saldo baja de Q3,000.00 a Q2,048.96"],
            ["OP-2", "CV-2026-0035",
             "Q849.77 saldan las cuotas 2, 3 y 4. Pasa a vigente; el saldo "
             "baja a Q529.82"],
            ["OP-4", "CV-2026-0043",
             "El reintento con la misma clave no vuelve a cobrar y el "
             "saldo no se mueve"],
            ["OP-5", "CV-2026-0061",
             "Q500.00 se rechaza por monto no exacto; el correcto es "
             "Q370.85"],
            ["OP-6", "CV-2026-0015",
             "Se rechaza: 130 dias de atraso, con la baja contable "
             "pendiente"],
        ],
        [A * 0.1, A * 0.22, A * 0.68],
        negrita_primera=True,
    ),
]

# ───────────────────────────────── 9. ESTADO
h += [
    p("10. Estado del proyecto", "h1"),
    tabla(
        ["Entregable", "Estado"],
        [
            ["E1 - Interfaz de usuario implementada",
             "API REST terminada; falta el frontend en React"],
            ["E2 - Persistencia y carga canonica", "Terminado"],
            ["E3 - Servidor MCP sobre los puertos del Proyecto 1",
             "Terminado"],
            ["E4 - RAG con citacion de fuentes", "Terminado"],
            ["E5 - Chat gerencial integrado a la interfaz",
             "Orquestador terminado y probado; falta la pantalla, que es "
             "del E1"],
            ["E6 - Pruebas",
             "Terminado: 639 pruebas, incluida la evaluacion del "
             "asistente"],
            ["E7 - Repositorio, documentacion y video",
             "README y este documento al dia; falta el video"],
        ],
        [A * 0.52, A * 0.48],
        negrita_primera=True,
    ),
    Spacer(1, 10),
    p(
        "El servidor MCP cuenta con un punto de entrada propio por STDIO, "
        "y el chat con un arnes de consola, de modo que las ocho "
        "capacidades y la orquestacion se pueden ejercitar sin esperar la "
        "interfaz. Ese arnes no es el entregable del E5, que pide el chat "
        "dentro de la aplicacion: es la herramienta con la que se maneja "
        "mientras la pantalla se construye."
    ),
    p("11. Resumen", "h1"),
    *vinetas([
        "El nucleo del Proyecto 1 se conservo y se evoluciono; no se "
        "reescribio. Las pruebas de las etapas anteriores siguen pasando "
        "intactas.",

        "El asistente se agrega sobre los puertos existentes. Los dos "
        "adaptadores del repositorio son intercambiables y se comprueba "
        "que el nucleo produce identicas cifras con cualquiera de los dos.",

        "El servidor MCP y la API REST son dos adaptadores del mismo "
        "servicio y comparten sus esquemas, asi que el tablero y el chat "
        "no pueden dar cifras distintas.",

        "Ninguna cifra se calcula fuera del nucleo, y ninguna herramienta "
        "lee el reloj del sistema.",

        "De las nueve herramientas, ocho son de solo lectura y se declaran "
        "asi en el protocolo. La unica que escribe exige aprobacion humana "
        "comprobada por el servidor.",

        "La resistencia a instrucciones incrustadas se apoya en el diseno "
        "y no solo en el prompt: los datos personales no son alcanzables "
        "desde las herramientas y un pago sin aprobacion no se puede "
        "aplicar.",

        "Dos errores del nucleo se descubrieron al confrontarlo con el "
        "paquete canonico de datos. Ninguno estaba en una formula: los dos "
        "eran condiciones, y los oraculos del enunciado se cumplen ahora "
        "sin haber sido modificados.",

        "El modelo de lenguaje tambien entra por un puerto, de modo que la "
        "orquestacion del chat se prueba sin red ni clave de API, y la "
        "aprobacion del pago la concede el orquestador y no el modelo.",

        "El conjunto de evaluacion esta amarrado al nucleo por una prueba, "
        "para que no pueda quedarse viejo en silencio y medir contra una "
        "expectativa equivocada.",
    ]),
]

doc = SimpleDocTemplate(
    SALIDA, pagesize=A4,
    leftMargin=2.2 * cm, rightMargin=2.2 * cm,
    topMargin=2.0 * cm, bottomMargin=2.0 * cm,
    title="Credito Vecino - Documento tecnico del asistente",
    author="Equipo Credito Vecino - Analisis de Sistemas II (037)",
    subject="Arquitectura, RAG, decisiones de diseno y pruebas",
)

doc.build(h, onLaterPages=pie_de_pagina)
print("PDF generado:", SALIDA)
