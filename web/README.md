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

No se guarda el nombre del cliente, el DPI, el teléfono, el desglose ni
el saldo. `localStorage` no se usa. El texto de la última búsqueda vive
solo en memoria (se pierde al recargar). La interfaz no escribe nada en
la consola. `sessionStorage` desaparece al cerrar la pestaña.

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
    │   ├── cobro.ts         endpoints del cobro en campo
    │   └── useConsulta.ts   carga / error / datos, con cancelación
    ├── cobro/               búsqueda, flujo de pago y reglas de la operación
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
| Solicitud de crédito | `/asesor/solicitud` | 3 |
| Detalle del crédito | `/asesor/creditos/:id` · `/gerencia/creditos/:id` | ✅ 2 · 4 |
| Registro de pago | `/asesor/pagos?credito=ID` | ✅ 2 |
| Plan de amortización | `/asesor/creditos/:id/plan` | 3 |
| Detalle de la mora | `/asesor/creditos/:id/mora?cuota=n` | ✅ 2 |
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
