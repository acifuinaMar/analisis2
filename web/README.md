# Crédito Vecino · interfaz web (E1)

Interfaz React del Proyecto Final. **Consume la API REST existente**
(`src/api`, `npm run api` en la raíz) y nada más: no habla con
PostgreSQL, MCP ni el núcleo, y **no calcula ninguna cifra**. Montos,
saldos, mora y porcentajes llegan de la API; la interfaz solo los formatea.

Estado:

- **Fase 1** — estructura, rutas, diseño base, navegación y componentes.
- **Fase 2** — cobro en campo del asesor, conectado a la API real:
  buscar cliente, detalle del crédito, detalle de la mora y registro de
  pago con vista previa, confirmación explícita e idempotencia.

Las demás pantallas muestran su estructura y los endpoints que van a
consumir; se conectan en las fases siguientes.

## Puesta en marcha

Requiere Node.js 22 y la API corriendo.

```bash
# 1. En la raíz del proyecto (otra terminal): la API sobre la cartera cargada
npm run api                      # http://127.0.0.1:3000

# 2. En web/
cd web
npm install
npm run dev                      # http://localhost:5173
```

Vite reenvía `/api` a `http://127.0.0.1:3000`. Para cambiarlo, copie
`.env.example` como `.env`. **Ninguna variable de `web/` es secreta**: lo
que empieza con `VITE_` termina en el navegador, así que aquí nunca va una
contraseña, una clave ni `DATABASE_URL`.

| Variable | Para qué |
|---|---|
| `VITE_API_DESTINO` | A dónde reenvía Vite `/api` (por omisión `http://127.0.0.1:3000`) |
| `VITE_FECHA_CORTE_INICIAL` | Fecha de corte con la que abre la interfaz (por omisión `2026-10-31`) |

### Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Revisa tipos (`tsc`) y compila a `dist/` |
| `npm run tipos` | Solo la revisión de tipos |
| `npm test` | Pruebas con Playwright (levanta `npm run dev` solo) |
| `npm run test:instalar-navegador` | Descarga Chromium para Playwright (una vez) |

Las pruebas **no necesitan la API ni la base**: interceptan `/api` en el
navegador, así que no pueden escribir en PostgreSQL. Usan la extensión
`*.prueba.ts` para que el `npm test` de la raíz (Vitest) no las recoja.

| Archivo | Qué prueba |
|---|---|
| `pruebas/unidades.prueba.ts` | formato, fechas y cliente HTTP (sin navegador) |
| `pruebas/operacion.prueba.ts` | reglas de la operación de pago idempotente (sin navegador) |
| `pruebas/navegacion.prueba.ts` | rutas, perfiles, layouts, fecha de corte, panel del asistente |
| `pruebas/cobro.prueba.ts` | búsqueda, detalle, mora y pago: vista previa, confirmación, reintento, resultado incierto, doble clic, invalidación, permisos, privacidad y 360 px |
| `pruebas/originacion-reglas.prueba.ts` | reglas de la originación: TNA en %, clasificación de errores, verificación y almacenamiento (sin navegador) |
| `pruebas/originacion.prueba.ts` | solicitud de crédito: camino feliz, duplicados, respuestas perdidas (alta y desembolso, aplicadas o no), conflicto, doble clic, recarga, perfil y 360 px |
| `pruebas/vencimientos-plan.prueba.ts` | próximos vencimientos (inicio y pantalla, ventanas, vacío, error) y plan de amortización con el estado de cada cuota |
| `pruebas/apiSimulada.ts` | API simulada CON ESTADO, tipada con los contratos reales de `src/` |

La intercepción usa `page.route(url => url.pathname.startsWith("/api/"))`
y no el patrón `**/api/**`, que también atrapaba `/src/api/cliente.ts`
(un módulo que Vite sirve en desarrollo) y rompía la aplicación.

## Perfiles (decisión del equipo)

La primera pantalla es una **selección de perfil para la demostración**,
no un inicio de sesión. El enunciado deja la autenticación fuera
(sección 3.1): basta con distinguir asesor y gerencia.

- El perfil viaja en el encabezado `X-Perfil`, el mecanismo que ya
  verifica el servidor (`src/api/perfiles.ts`, catálogo en
  `src/acceso/perfil.ts`).
- La interfaz usa el perfil para decidir **qué pintar**; quien decide
  **qué se puede hacer** es el servidor. Una ruta de otro perfil
  redirige, pero eso es comodidad: la API responde 403 de todos modos.
- **Limitación conocida:** cualquiera puede elegir cualquier perfil. Por
  eso la API escucha solo en `127.0.0.1`. No es apto para producción.
- La gerencia nunca ve un botón para aplicar pagos en el chat; el
  orquestador además lo rechaza en el servidor (`ErrorPerfilSinPermiso`).

## Fecha de corte

Una sola para toda la aplicación, en el encabezado. Viaja a la API en
cada consulta; la interfaz nunca usa el reloj para calcular (sección 7.3).
Se guarda en la sesión del navegador.

## Cobro en campo (Fase 2)

Flujo del asesor, en el teléfono:

1. **Buscar cliente** (`/asesor/clientes`, o desde «Pagos»):
   `GET /api/clientes?buscar=` por nombre (sin importar tildes),
   `CL-NNNN`, DPI o `CV-AAAA-NNNN`. La respuesta trae solo nombre,
   municipio, los **cuatro últimos** caracteres del DPI y los
   identificadores de sus créditos. El estado y el saldo de cada crédito
   se piden aparte a `GET /api/creditos/:id`.
2. **Detalle del crédito** (`/asesor/creditos/:id`): `GET /api/creditos/:id`,
   `/plan` y `/deuda`. La sección **«Estado de cuotas»** sale del plan:
   no es un historial de transacciones, porque la API no lo tiene.
3. **Detalle de la mora** (`/asesor/creditos/:id/mora?cuota=n`):
   `/cuotas/:n/mora` y `/cuotas/:n/deuda`, para las cuotas exigibles que
   devuelve `/deuda`. La nota de redondeo usa las dos cifras del servidor.
4. **Registro de pago** (`/asesor/pagos?credito=ID`): monto precargado de
   `/deuda` → **vista previa** (`confirmado: false`) con el desglose de la
   prelación → **confirmación explícita** (`confirmado: true`) → resultado.

### Reglas de la operación de pago (`src/cobro/operacionPago.ts`)

- Cada intento de cobro es una **operación** con datos fijos (crédito,
  monto, fecha de operación y canal) y una clave `WEB-<uuid>`.
- **Reintentar** el mismo pago reutiliza la misma clave y exactamente los
  mismos datos. La API reconoce la clave y no cobra dos veces (OP-4).
- Si cambia el crédito, el monto, la fecha o el canal, la vista previa se
  **descarta** y es una operación distinta, con clave nueva. Volver a
  escribir el monto original no recupera la vista previa vieja.
- La confirmación envía los datos **de la vista previa**, no los del
  formulario.
- Si la respuesta de una confirmación se pierde (sin conexión, error 5xx
  o 20 s sin respuesta), el resultado es **incierto**: no se asume que
  falló, el formulario se bloquea y solo se puede reintentar con la misma
  clave y los mismos datos. Nunca se genera una clave nueva para eso.
  Mientras haya un pago incierto no se abre otro cobro.
- Una operación aplicada o reconocida como duplicada queda cerrada: su
  clave no se usa para un cobro nuevo.
- El botón de confirmar no admite doble envío (barrera inmediata, además
  del botón deshabilitado).
- Nada se envía al entrar a la pantalla, al recargar ni al cambiar la
  fecha de corte: solo con un clic.

### Qué se guarda en el navegador

| Dónde | Qué | Cuándo |
|---|---|---|
| `sessionStorage` · `cv.perfil` | perfil elegido (`asesor` / `gerencia`) | siempre |
| `sessionStorage` · `cv.fechaCorte` | fecha de corte (`AAAA-MM-DD`) | siempre |
| `sessionStorage` · `cv.asistenteAbierto` | si el panel del asistente está abierto | gerencia |
| `sessionStorage` · `cv.cobro.operacionPendiente` | `clave`, `idCredito`, `monto`, `fechaOperacion`, `canal`, `estado` | **solo** mientras una confirmación está pendiente o es incierta; se borra al cerrarse |
| `sessionStorage` · `cv.originacion.pendiente` | `paso`, `estado`, `idCliente`, `idCredito`, `idAsesor`, `capital`, `plazoMeses`, `tnaAnual`, `fechaDesembolso` | **solo** mientras un alta o un desembolso está enviándose o es incierto; se borra al resolverse o descartarse |

No se guarda el nombre del cliente, el DPI, el teléfono, el municipio,
el desglose ni el saldo (tampoco en la originación: los datos personales
del alta viven solo en memoria). `localStorage` no se usa. El texto de la última búsqueda vive
solo en memoria (se pierde al recargar). La interfaz no escribe nada en
la consola. `sessionStorage` desaparece al cerrar la pestaña.

## Fase 3: perfil asesor completo

### Próximos vencimientos (decisión D1)

Complemento de G-6 **solo para el asesor**; el alcance del chat no cambia.
`GET /api/vencimientos?fechaCorte=&ventanaDias=` (ambos perfiles en la API).

- **Inicio** (`/asesor`): «Próximos 7 días» con la cantidad y el monto
  que da el servidor y las tres primeras cuotas. «Ver todos» abre la
  pantalla completa.
- **Pantalla** (`/asesor/vencimientos?dias=7|15|30`): la ventana vive en la
  URL. La ventana es (corte, corte + días]: la cuota que vence el mismo
  día del corte ya es exigible y está en el cobro.
- No hay botón «Cobrar»: una cuota que todavía no vence no es exigible. Se
  ofrece «Ver crédito» para preparar la visita.

### Plan de amortización

`/asesor/creditos/:id/plan` (desde el detalle del crédito):
`GET /api/creditos/:id/plan` con la fecha de corte. Cada cuota muestra el
estado que da el servidor: **Pagada**, **Parcial**, **Pendiente** y
**Vencida** (con los días de atraso). La interfaz no recalcula saldos ni
suma totales; el plan de un crédito existente no trae totales.

### Solicitud de crédito = originación (decisión D2)

`/asesor/solicitud`. Solo originación (OP-3): no hay seguimiento de
solicitudes ni estados que el backend no tenga.

1. **Cliente**: nuevo (el alta es el primer paso) o existente (búsqueda).
2. **Datos**: identificador del crédito, monto, plazo, **TNA en %** (D3:
   «36» se envía como `0.36`, corriendo el punto sobre el texto) y asesor
   (`GET /api/asesores`). La fecha de desembolso es la fecha de corte.
3. **Revisión**: `POST /api/creditos/simulacion` (no guarda nada). Si
   cambia un dato, la simulación anterior deja de valer.
4. **Resultado**: con un clic, `POST /api/clientes` (si es nuevo) y
   **después** `POST /api/creditos` con los datos simulados.

### Reglas de la operación incierta (`src/originacion/operacionOriginacion.ts`)

El backend tiene **dos escrituras independientes**, sin transacción común
ni clave de idempotencia; solo los identificadores únicos (`CL-NNNN`,
`CV-AAAA-NNNN`) impiden duplicar. Por eso:

- **Solo un 201 confirma.** Sin respuesta (red, 5xx o 20 s) la escritura es
  **«Resultado incierto»**: el formulario se bloquea y no se envía nada más.
- **Con el alta incierta nunca se desembolsa.** Ni en ese momento ni
  después de verificarla.
- **Nada se reintenta solo.** El reintento es un clic, con los mismos datos,
  y solo cuando la verificación dice que **no consta**. Un alta reintentada
  y confirmada no encadena el desembolso: se pide otra confirmación.
- **`CLIENTE_DUPLICADO`, `DPI_DUPLICADO` y `CREDITO_DUPLICADO` no son
  éxitos.** En el primer envío son un rechazo (el identificador ya estaba
  ocupado). Después de un envío incierto, el mismo 409 no prueba nada y la
  escritura sigue incierta.
- **Verificar es solo lectura** (`GET /api/clientes?buscar=`,
  `GET /api/creditos/:id` y `/plan`), con tres desenlaces:
  - *no consta*: se permite el reintento manual;
  - *conflicto*: existe con otros datos visibles, así que no lo creó este
    envío → rechazo, y se vuelve a corregir los datos;
  - *coincidencia*: coinciden los datos visibles, pero **sigue incierto**.
    Coincidir el nombre o el titular no basta.
- Doble clic: barrera inmediata (`useRef`) además del bloqueo visual.
- Al recargar, la operación pendiente se restaura como incierta y bloquea
  una solicitud nueva hasta verificarla o descartarla (con confirmación).

**Limitación del backend (documentada, sin cambios en el backend).** La API
no devuelve un identificador de operación, ni el DPI completo, el teléfono
o el asesor en las lecturas. Por eso la interfaz **no puede atribuir
inequívocamente** un registro existente a un envío cuya respuesta se
perdió, y usa el flujo conservador descrito: lo deja como incierto y no
continúa con escrituras dependientes. Una mejora posible, que **requiere
autorización** porque cambia el backend, sería aceptar una clave de
idempotencia en `POST /api/clientes` y `POST /api/creditos` (como ya
hace el registro de pagos) o devolver esos datos en las lecturas.

### Trazabilidad pantalla ↔ caso de uso (decisión D4)

Requisitos R1–R19 y casos de uso de `docs/proyecto1`; consultas G y
operaciones OP del enunciado.

| Pantalla | Ruta | Requisito / caso de uso | Enunciado | Endpoints |
|---|---|---|---|---|
| Inicio y próximos vencimientos | `/asesor` · `/asesor/vencimientos` | apoyo al cobro (planificar visitas) | G-6 (complemento, D1) | `GET /api/vencimientos` |
| Buscar cliente | `/asesor/clientes` | apoyo a R8 y a R2 (cliente existente) | OP-1, OP-2 | `GET /api/clientes?buscar=` |
| Solicitud de crédito | `/asesor/solicitud` | R1 Registrar clientes · R2 Solicitar crédito · R5 Desembolsar crédito · R6/R7 Generar plan y cuotas | OP-3 | `GET /api/asesores` · `POST /api/clientes` · `POST /api/creditos/simulacion` · `POST /api/creditos` |
| Detalle del crédito | `/asesor/creditos/:id` | Consultar estado del crédito (R10) | G-5 | `GET /api/creditos/:id`, `/plan`, `/deuda` |
| Plan de amortización | `/asesor/creditos/:id/plan` | R6 Generar plan de amortización · R7 cuotas | G-5 | `GET /api/creditos/:id/plan` |
| Detalle de la mora | `/asesor/creditos/:id/mora` | Consultar estado del crédito | G-7 | `/cuotas/:n/mora`, `/cuotas/:n/deuda` |
| Registro de pago | `/asesor/pagos?credito=ID` | R8 Registrar pago · R9 Prelación · R10 Estado · R11 Evento | OP-1, OP-2, OP-4, OP-5, OP-6 | `POST /api/creditos/:id/pagos` |

R3 (evaluar) y R4 (aprobar o rechazar una solicitud) **no tienen pantalla**:
el backend no guarda solicitudes ni sus estados, y la decisión D2 fue no
inventarlos.

## Estructura

```text
web/
├── index.html
├── vite.config.ts           proxy /api → npm run api
├── playwright.config.ts
├── pruebas/                 *.prueba.ts (Playwright)
└── src/
    ├── main.tsx
    ├── estilos.css          tokens del prototipo (Tailwind v4, @theme)
    ├── app/
    │   ├── App.tsx          sesión + enrutador + guarda de perfil
    │   ├── enrutador.tsx    enrutador mínimo (History API)
    │   └── rutas.tsx        tabla de rutas y las 7 pantallas obligatorias
    ├── api/
    │   ├── cliente.ts       única puerta a la API: X-Perfil y errores uniformes
    │   ├── contratos.ts     tipos de respuesta, importados de src/ (import type)
    │   ├── cobro.ts         endpoints del cobro en campo y vencimientos
    │   ├── originacion.ts   asesores, alta, simulación y desembolso
    │   └── useConsulta.ts   carga / error / datos, con cancelación
    ├── cobro/               búsqueda, flujo de pago, vencimientos y reglas de la operación
    ├── originacion/         solicitud de crédito y reglas de la operación incierta
    ├── plan/                tabla del plan de amortización
    ├── estado/              perfil y fecha de corte de la sesión
    ├── layouts/             LayoutAsesor (teléfono), LayoutGerencia (escritorio)
    ├── chat/                panel del asistente (E5) y tarjeta de aprobación
    ├── ui/                  componentes visuales reutilizables
    ├── paginas/             pantallas por perfil
    └── utilidades/          formato, fechas y etiquetas (solo presentación)
```

## Rutas y pantallas obligatorias

| Pantalla (E1) | Ruta | Fase |
|---|---|---|
| Buscar cliente | `/asesor/clientes` | ✅ 2 |
| Solicitud de crédito | `/asesor/solicitud` | ✅ 3 |
| Detalle del crédito | `/asesor/creditos/:id` · `/gerencia/creditos/:id` | ✅ 2 · 4 |
| Registro de pago | `/asesor/pagos?credito=ID` | ✅ 2 |
| Plan de amortización | `/asesor/creditos/:id/plan` | ✅ 3 |
| Detalle de la mora | `/asesor/creditos/:id/mora?cuota=n` | ✅ 2 |
| Próximos vencimientos (complemento, D1) | `/asesor` · `/asesor/vencimientos?dias=` | ✅ 3 |
| Tablero gerencial | `/gerencia` · `/gerencia/mora/:tramo` | 4 |
| Cierre diario / mensual | `/gerencia/cierre` | 4 |
| Chat gerencial (E5) | panel lateral en todo el layout de gerencia | 5 |

En desarrollo existe además `/gerencia/componentes`: una galería para
revisar el diseño. Sus valores son de ejemplo y la ruta **no existe** en
`npm run build`.

## Diseño

Sigue el prototipo de alta fidelidad (`docs/proyecto2/E5/img`): azul
marino `#1e3a8a` para la marca y las acciones, fondo `#f8fafc`, tarjetas
blancas con borde suave, rojo para la mora, ámbar para los estados de
seguimiento, tipografía Inter e íconos de línea. Los colores se definen
una sola vez, por su papel, en `src/estilos.css`.

Diferencias deliberadas con el prototipo, para cumplir el enunciado:

- La fecha de corte se elige por **día**, no por mes (todas las consultas
  son "al 31 de octubre"; G-7 pide otra fecha).
- El menú de gerencia muestra solo lo que existe (Inicio, Cartera en
  mora, Cierres, Asistente).
- Los tramos usan el nombre del núcleo (`Vencido`, no "Mora 4") con su
  explicación ("Mora 2 · lleva más de un mes de atraso").

## Dependencias

Solo React en producción. El enrutador y los íconos son propios (unas
150 líneas y un juego de trazos estilo Lucide, licencia ISC) para no
sumar dependencias que el proyecto no necesita.
