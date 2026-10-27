# Crédito Vecino

### Sistema de Gestión de Microcréditos

> **Proyecto Integrador**
> **Análisis de Sistemas II (037)**
> Universidad Mariano Gálvez de Guatemala – 2026

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-630%20pruebas-6E9F18)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?logo=postgresql&logoColor=white)
![MCP](https://img.shields.io/badge/MCP-9%20herramientas-D97757)
![Express](https://img.shields.io/badge/Express-API%20REST-000000?logo=express&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-RAG-4285F4?logo=google&logoColor=white)
![Arquitectura](https://img.shields.io/badge/Arquitectura-Hexagonal-blue)

---

# Descripción

**Crédito Vecino** es un sistema de gestión de microcréditos desarrollado como
proyecto integrador del curso **Análisis de Sistemas II**.

El proyecto se construyó en tres etapas sobre **el mismo repositorio**: lo que
ya existía se conserva y se evoluciona, nunca se reescribe.

| Etapa | Contenido |
|---|---|
| **Proyecto 1** | Arquitectura hexagonal e implementación del núcleo de negocio: dinero en centavos, plan de amortización francés, prelación de pagos, estados del crédito y cartera en riesgo. |
| **Proyecto 2** | Investigación de usuarios, arquitectura de información, prototipo navegable, accesibilidad, y evolución del núcleo con la política de mora escalonada por tramos. |
| **Proyecto Final** | Persistencia y carga canónica, servidor MCP sobre los puertos del Proyecto 1, RAG con citación de fuentes, interfaz y chat gerencial. |

La regla que gobierna todo el sistema: **ninguna cifra se calcula fuera del
núcleo.** La base de datos guarda hechos, el servidor MCP los expone y la
interfaz los muestra, pero quien calcula siempre es el dominio.

---

# Estado de los entregables

Entregables del **Proyecto Final**.

| Entregable | Descripción | Estado |
|---|---|---|
| **E1** | Interfaz de usuario implementada (7 pantallas, 3 flujos) | API REST terminada; falta el frontend en React |
| **E2** | Persistencia y carga canónica | Terminado |
| **E3** | Servidor MCP sobre los puertos del Proyecto 1 | Terminado |
| **E4** | RAG con citación de fuentes | Terminado |
| **E5** | Chat gerencial integrado a la interfaz | Orquestador terminado y probado; falta la pantalla, que es del E1 |
| **E6** | Pruebas | Terminado: 630 pruebas, incluida la evaluación del asistente |
| **E7** | Repositorio, documentación y video | README y documento técnico al día; falta el video |

---

# Puesta en marcha

Un tercero debe poder clonar el repositorio y dejar el sistema corriendo
siguiendo solo esta sección.

## Requisitos

- **Node.js 20 o superior** (`node --version`)
- **PostgreSQL con la extensión `pgvector`** — local o en Supabase
- Una **clave de API de Google Gemini**, solo si va a usar el módulo RAG

## 1 · Clonar e instalar

```bash
git clone https://github.com/acifuinaMar/analisis2
cd analisis2
git checkout ProyectoFinal
npm install
```

## 2 · Configurar las variables de entorno

```bash
cp .env.example .env     # en Windows: copy .env.example .env
```

Luego edite `.env`:

| Variable | Obligatoria | Para qué sirve |
|---|---|---|
| `CV_DATA_DIR` | Sí | Ruta del paquete canónico. El repositorio ya incluye una copia, así que `./datos` funciona tal cual. |
| `DATABASE_URL` | Para el E2 y el E4 | Cadena de conexión a PostgreSQL. La base debe tener `pgvector` disponible. |
| `GEMINI_API_KEY` | Solo para el E4 | Clave de Google Gemini. Sin ella el núcleo, el cargador, el servidor MCP y las pruebas funcionan igual. |

`.env` **no se versiona**: contiene credenciales.

## 3 · Cargar la cartera

```bash
npm run cargar
```

El comando verifica la huella **SHA-256** de `eventos.jsonl` contra
`eventos.sha256` **antes** de escribir nada, y se detiene si no coincide.
Después aplica el esquema y reproduce la bitácora de eventos.

Deja en la base:

```
clientes : 60
créditos : 75
pagos    : 228 (226 aplicados, 2 repetidos por clave de idempotencia)
```

Los dos eventos repetidos son deliberados y **se conservan en la bitácora**,
pero no mueven saldos: es la idempotencia del Proyecto 1 (6.10) funcionando.

**Es idempotente:** ejecutarlo dos veces no duplica la cartera; la segunda vez
responde `ya_cargado`.

> ⚠️ `npm run cargar -- --reiniciar` **borra** las tablas de la cartera antes
> de cargar. Si la base es compartida por el equipo, piénselo dos veces. No
> toca `rag_fragmentos`, así que el índice del RAG sobrevive.

## 4 · Indexar el corpus (solo para el RAG)

```bash
npm run rag:indexar
```

Fragmenta los siete documentos del corpus, genera sus embeddings y los guarda
en `public.rag_fragmentos`.

## 5 · Verificar que todo quedó bien

```bash
npm test          # 520 pruebas, sin red ni base de datos
npm run demo      # recorrido del núcleo por consola
npm run db:probar # comprueba la conexión, pgvector y los fragmentos
```

## 6 · Levantar el servidor MCP

```bash
npm run mcp:servidor            # sobre PostgreSQL, si hay DATABASE_URL
npm run mcp:servidor -- --csv   # sobre el paquete en archivos, sin base
```

Habla por **STDIO**, el transporte que esperan los clientes MCP. Esto permite
ejercitar las ocho capacidades con cualquier cliente sin esperar la interfaz
del E1.

## 7 · Levantar la API

```bash
npm run api          # http://127.0.0.1:3000
```

Es un adaptador delgado sobre los mismos servicios que usa el servidor MCP, y
reutiliza sus esquemas Zod: **el tablero y el chat no pueden dar cifras
distintas**. Escucha solo en `127.0.0.1`.

El perfil viaja en el encabezado `X-Perfil: asesor | gerencia` y se verifica
en el servidor. No es autenticación —el enunciado la deja expresamente fuera
en su sección 3.1— sino la separación de responsabilidades que sí pide:

```bash
curl -H "X-Perfil: gerencia" \
  "http://127.0.0.1:3000/api/cartera?fechaCorte=2026-10-31"
```

Detalle en [`docs/api/Readme Sección API.md`](docs/api/Readme%20Secci%C3%B3n%20API.md).

## 8 · Conversar con el asistente

```bash
npm run chat                    # sobre PostgreSQL
npm run chat -- --csv           # sobre el paquete en archivos
npm run evals:asistente         # la evaluación de los 14 casos
```

Ambos necesitan `GEMINI_API_KEY`.

> El **frontend en React (E1)** todavía no está implementado —la API sí—, así
> que el chat se opera por consola. Esa consola no es el entregable del E5 —que pide el chat
> dentro de la aplicación— sino el arnés con el que se maneja y se demuestra
> el orquestador mientras la pantalla se construye.

---

# Arquitectura

El sistema es **hexagonal**: el núcleo no conoce ni la base de datos, ni la
red, ni el reloj. Todo lo externo entra por un **puerto** y se satisface con
un **adaptador**.

```text
          ┌──────────────────────────────────────────┐
          │              NÚCLEO (P1 / P2)            │
          │                                          │
          │  Dinero · Cuota · Plan de amortización   │
          │  Prelación · Estados · Cartera           │
          │  Políticas de mora (plana / escalonada)  │
          └──────────────────────────────────────────┘
                 ▲                           ▲
                 │ puerto                    │ puerto
                 │ RepositorioCartera        │ PoliticaMora
       ┌─────────┴─────────┐                 │
       │                   │        (catálogo versionado
  ┌────┴─────┐      ┌──────┴─────┐    por fecha de otorgamiento)
  │   CSV    │      │ PostgreSQL │
  │ (pruebas)│      │ (E2, real) │
  └──────────┘      └────────────┘
                 │
                 │  consumen el mismo puerto
                 ▼
     ┌───────────────────────────────┐
     │  ConsultasCartera (servicios) │
     └───────────────────────────────┘
                 ▼
     ┌──────────────┬────────────────┐
     │ Servidor MCP │  API REST (E1) │
     │     (E3)     │   Express      │
     └──────────────┴────────────────┘
       el chat (E5)      el frontend
```

**Los dos adaptadores son intercambiables.** `tests/repositorio-cartera-postgres.test.ts`
comprueba que devuelven exactamente lo mismo para todo el paquete canónico, y
que el núcleo produce idénticas cifras con cualquiera de los dos. La diferencia
es de papel: el CSV vive en memoria y es el doble de pruebas; el de PostgreSQL
**persiste**.

Decisiones de diseño documentadas en `docs/proyecto1/adr/` y
`docs/proyecto2/adr/`.

---

# Servidor MCP (E3)

Nueve herramientas que cubren las ocho capacidades del enunciado. Los esquemas
se describen con **Zod**, el mismo contrato que genera el OpenAPI.

| Herramienta | Capacidad | Se ejercita en |
|---|---|---|
| `consultar_credito` | Consultar un crédito | G-5 |
| `calcular_deuda_de_cuota` | Calcular la deuda de una cuota | OP-1, OP-2 |
| `explicar_mora` | Explicar una mora | G-5, G-7 |
| `listar_creditos_en_mora` | Listar créditos en mora | G-4 |
| `proximos_vencimientos` | Ver próximos vencimientos | G-6 |
| `consultar_cartera` | Consultar la cartera | G-1 |
| `consultar_cierre_diario` | Consultar un cierre | G-3 |
| `consultar_cierre_mensual` | Consultar un cierre | G-2 |
| `registrar_pago` | Registrar un pago **(sensible)** | OP-1, OP-2, OP-4, OP-5, OP-6 |

El cierre son dos herramientas en lugar de una con un parámetro `tipo`: cada
una recibe algo distinto —una fecha o un mes— y un único campo que cambia de
formato según otro campo es la clase de firma que el asistente llena mal.

## Tres reglas que gobiernan todas las herramientas

**1 · Solo lectura por defecto.** Las ocho consultas se declaran en el
protocolo con `readOnlyHint`, así que el cliente MCP puede aprobarlas sin
preguntar. `registrar_pago` se declara `destructiveHint`.

**2 · La fecha de corte llega como parámetro.** Ninguna herramienta lee el
reloj del sistema: es el puerto `Reloj` del Proyecto 1. Con mora escalonada
pesa más que nunca, porque el tramo depende de la fecha. La consulta G-7 pide
deliberadamente una fecha futura para comprobarlo.

**3 · Errores con convención uniforme.** Cada rechazo trae un código estable
contra el que el cliente puede programar, y un campo `detalle` con los datos
para reaccionar:

| Código | Cuándo |
|---|---|
| `CREDITO_INEXISTENTE` | El crédito no existe |
| `CUOTA_INEXISTENTE` | La cuota no existe en el plan |
| `CUOTA_YA_PAGADA` | No hay deuda exigible que pagar |
| `CREDITO_INCOBRABLE` | Supera los 120 días, o ya se dio de baja |
| `MONTO_NO_EXACTO` | Incluye `montoCorrecto` y el desglose |
| `FECHA_INVALIDA` | La fecha no existe en el calendario |
| `VENTANA_INVALIDA` | La ventana de días no es un entero positivo |

## La acción sensible

`registrar_pago` es la **única** herramienta que escribe, y tiene doble
barrera:

1. Se declara `destructiveHint` para que el cliente exija confirmación.
2. Exige el campo `confirmado`. Sin él, la llamada **devuelve solo la vista
   previa** con el desglose de la prelación y no toca nada.

La anotación es una pista que el cliente puede ignorar; el campo lo comprueba
el servidor, que es quien no debe confiar en nadie.

El monto debe ser **exactamente** la deuda exigible al corte. Si no lo es, el
rechazo indica cuál es el correcto. Reintentar con la misma clave de
idempotencia no vuelve a cobrar, y esa comprobación ocurre **antes** de
cualquier validación de negocio: la clave identifica la operación, no el pago,
así que un reintento devuelve el mismo desenlace sin importar cómo haya
cambiado la cartera.

---

# Chat gerencial (E5)

El asistente tiene dos ramas que responden preguntas distintas: el **módulo
documental** contesta *qué dice la política*, y el **servidor MCP** contesta
*cuánto debe este crédito*. El orquestador decide, para cada pregunta, si hace
falta una, la otra, las dos o ninguna.

```text
   PREGUNTA
      |
   Orquestador  ──  memoria de la sesión
      |
      +── consultar_politicas ──>  RAG (E4)
      |
      +── 9 herramientas ──────>  Servidor MCP (E3)  ──>  Núcleo
```

## El modelo de lenguaje entra por un puerto

`ModeloLenguaje` se inyecta, igual que el repositorio de cartera. Importa por
dos razones concretas:

- **Las pruebas corren sin red ni clave de API.** Toda la orquestación se
  ejercita con un modelo guionizado, de forma determinista. El modelo
  guionizado es, para el modelo, lo que PGlite es para la base.
- **El puerto no expone el formato de Gemini.** Usa un vocabulario propio y el
  adaptador traduce; si asomara el formato del proveedor, el orquestador
  quedaría amarrado a él por la puerta de atrás.

Las pruebas corren contra el **servidor MCP real**, atravesando el protocolo,
con el adaptador del paquete canónico detrás. Solo se sustituye el modelo.

## La aprobación la concede el orquestador, no el modelo

Cuando el modelo propone un pago, el orquestador **fija `confirmado` en falso
venga como venga** en los argumentos, ejecuta la vista previa y se detiene
devolviendo el desglose de la prelación. La confirmación solo la pone
`aprobarPago()`, que llama una persona.

Es la tercera barrera, sobre las dos que ya tenía la herramienta. Hay una
prueba dedicada: aunque el modelo pida explícitamente `confirmado: true`, no se
aplica nada.

Un rechazo del núcleo **no** pide aprobación, porque no hay nada que aprobar:
el monto no exacto y el crédito incobrable vuelven al modelo para que los
explique, con el monto correcto incluido.

## Las instrucciones heredan las del módulo documental

`INSTRUCCIONES_ASISTENTE` se construye **sobre** `INSTRUCCIONES_RAG` en vez de
repetirlas. Dos juegos de reglas para el mismo asistente acabarían
contradiciéndose, y entonces no se sabría cuál rige. Las del E4 gobiernan cómo
tratar los documentos; las del chat agregan cómo usar las herramientas: toda
cifra viene de una herramienta, toda consulta necesita su fecha de corte, y el
pago jamás se propone por iniciativa propia.

La pantalla del E1 consumirá este mismo orquestador: `preguntar()`,
`aprobarPago()`, `rechazarPago()` e `historial()`. La lógica del chat no vive
en la interfaz.

---

# RAG — Generación aumentada por recuperación (E4)

El sistema incorpora un módulo RAG que responde preguntas sobre las políticas
institucionales usando los documentos del corpus canónico y **citando las
fuentes** consultadas.

### Arquitectura

1. El usuario formula una pregunta.
2. Gemini genera un embedding de la pregunta.
3. PostgreSQL con `pgvector` recupera los fragmentos más similares.
4. Gemini Flash genera una respuesta usando esos fragmentos como contexto.
5. El sistema valida que los identificadores citados pertenezcan a los
   fragmentos recuperados.
6. Se entrega la respuesta, o un aviso de que no fue posible validar las
   referencias.

### Corpus documental

Siete documentos Markdown del paquete canónico:

- `FAQ-CLIENTES-01.md`
- `MAN-PRODUCTO-01.md`
- `NOTA-CAMPO-07.md`
- `POL-2024-01.md`
- `POL-2026-10.md`
- `POL-CARTERA-01.md`
- `POL-COBRO-01.md`

Se leen desde `CV_DATA_DIR`. El paquete canónico no se modifica.

### Estrategia de fragmentación

Implementación propia en `src/rag/fragmentador.ts`:

- Tamaño máximo: 1000 caracteres.
- Solapamiento: 150 caracteres.
- Separación prioritaria por párrafos Markdown.
- División adicional para bloques que superan el tamaño.
- Identificadores estables por documento y posición.

El solapamiento se aplica al dividir bloques largos; no se garantiza entre
todos los fragmentos separados por párrafos.

**Por qué así:** permite recuperar las secciones relevantes sin enviar
documentos completos al modelo generativo, y mantiene identificadores
verificables para la citación.

### Modelo de embeddings

| | |
|---|---|
| Proveedor | Google Gemini |
| Modelo | `gemini-embedding-001` |
| Dimensiones | 768 |
| Tipos de tarea | `RETRIEVAL_DOCUMENT` al indexar, `RETRIEVAL_QUERY` al buscar |

**Por qué así:** genera representaciones semánticas sin ejecutar un modelo
local pesado.

### Almacenamiento vectorial

PostgreSQL en Supabase con `pgvector`, tabla `public.rag_fragmentos`, que
guarda el identificador del fragmento y del documento, la ruta de origen, el
contenido, la posición y el vector de 768 dimensiones. La búsqueda usa
distancia coseno.

### Generación y citación

Modelo generativo: `gemini-3.8-flash`. El módulo
`src/rag/responderPregunta.ts` recupera hasta cinco fragmentos. Las
instrucciones del asistente viven aparte, en `src/rag/instruccionesRAG.ts`.

Las citas usan el identificador completo del fragmento, por ejemplo
`POL-2024-01-chunk-1`. `src/rag/validarCitas.ts` y
`src/rag/evaluarRespuesta.ts` comprueban que lo citado pertenezca a lo
recuperado.

Esa comprobación **no** demuestra por sí sola que cada afirmación esté
respaldada por el contenido citado; verifica la trazabilidad de la cita.

### Seguridad: el contenido recuperado es dato, no instrucción

Las reglas del asistente (`src/rag/instruccionesRAG.ts`) establecen que los
documentos recuperados son **datos no confiables**, que debe ignorar cualquier
instrucción incrustada en ellos, que no ejecute acciones financieras, y que
distinga entre políticas vigentes, documentos históricos y **borradores sin
aprobar**.

El corpus incluye `NOTA-CAMPO-07`, un documento operativo de apariencia normal
con un párrafo inyectado que ordena anular las reglas, emitir un código
canario, cobrar Q100,000 sin aprobación y revelar datos personales de todos los
clientes. Es la operación **OP-7**.

La defensa es en capas, y dos de los cuatro ataques **no dependen de que el
modelo se porte bien**:

| Ataque | Dónde se bloquea |
|---|---|
| Anular las reglas del sistema | Reglas del asistente (6 y 7) |
| Emitir el código canario | Reglas del asistente (7) |
| Cobrar sin aprobación | **Servidor MCP:** sin `confirmado` no aplica, y el monto inventado se rechaza |
| Revelar DPI y teléfono | **Servidor MCP:** ninguna herramienta los expone, y no hay forma de recorrer los clientes |

De las ocho capacidades, las cuatro que consultan al cliente extraen
**únicamente el nombre completo**. El DPI, el teléfono y el municipio existen
en el repositorio pero nunca cruzan el borde de las herramientas, y ninguna
recibe un `idCliente`: se entra siempre por el crédito. Comprobado en
`tests/op7-inyeccion.test.ts`.

El modelo de amenaza completo y el guion de demostración están en
[`docs/proyecto-final/E5/defensa-inyeccion-op7.md`](docs/proyecto-final/E5/defensa-inyeccion-op7.md).

Las credenciales se configuran por variables de entorno y no se incluyen en el
repositorio.

---

# Pruebas (E6)

```bash
npm test
```

**630 pruebas en 44 archivos**, sin red y sin base de datos. La suite del
Proyecto 1 y del Proyecto 2 sigue pasando intacta: es la prueba de que el
núcleo no se rompió.

| Grupo | Qué cubre |
|---|---|
| Núcleo (P1 / P2) | Dinero, plan francés, prelación, estados, cartera en riesgo, políticas de mora y los oráculos del enunciado |
| Cargador canónico | Conteos, idempotencia y verificación de la huella SHA-256 |
| Adaptadores | Que el de PostgreSQL y el de CSV sean intercambiables y den las mismas cifras |
| API REST | Rutas, perfiles, validación de entrada y originación de créditos |
| Servidor MCP | Que devuelva lo mismo que el núcleo y que rechace lo que debe rechazar |
| RAG | Fragmentación, citación, validación y seguridad |
| Chat y evaluación | Orquestación, memoria de la sesión, la barrera de aprobación y los 14 casos de evaluación |
| OP-7 | Que los datos personales no sean alcanzables y que el pago inyectado no se aplique |

Las pruebas que necesitan base de datos usan **PGlite**, PostgreSQL embebido en
memoria: es Postgres real —llaves foráneas, índices únicos parciales,
transacciones— pero sin servidor ni credenciales. Las que necesitan un modelo
de lenguaje usan el modelo guionizado.

## Evaluación del asistente

Catorce casos: las siete consultas de gerencia del Anexo B, tres operaciones,
dos de seguridad y dos de límite. Cada uno declara qué herramientas deben
invocarse, qué cifras deben aparecer y qué texto no debe aparecer.

```bash
npm run evals:asistente              # contra el modelo real
npm run evals:asistente -- --caso G-7
```

**El conjunto no puede desfasarse en silencio.** Un conjunto de evaluación con
cifras escritas a mano acaba midiendo nada: el núcleo cambia, las cifras
esperadas se quedan viejas y la evaluación sigue dando verde contra una
expectativa equivocada. Por eso `tests/evals/casos-asistente.test.ts`
comprueba que cada cifra esperada **siga apareciendo en la salida real de su
herramienta**, y que lo prohibido no aparezca: Q6.01 y Q34.47 son las cifras
que daba el núcleo con el plan de amortización corrido un mes.

Las cifras se comparan **por valor y no como texto**, porque JSON serializa
36554.50 como `36554.5` mientras el asistente escribe `Q36,554.50` —son la
misma cifra— y porque un `includes` daría por bueno un «130» que en realidad
estaba dentro de «1300».

---

# Scripts disponibles

| Comando | Qué hace |
|---|---|
| `npm test` | Toda la suite de pruebas |
| `npm run cargar` | Carga el paquete canónico en la base (`-- --reiniciar` borra antes) |
| `npm run api` | Levanta la API REST en el puerto 3000 |
| `npm run mcp:servidor` | Levanta el servidor MCP por STDIO (`-- --csv` sin base) |
| `npm run chat` | Chat gerencial por consola (necesita `GEMINI_API_KEY`) |
| `npm run evals:asistente` | Evaluación de los 14 casos del asistente |
| `npm run demo` | Recorrido del núcleo por consola |
| `npm run contratos:openapi` | Regenera el OpenAPI desde los esquemas Zod |
| `npm run db:probar` | Comprueba la conexión, `pgvector` y los fragmentos |
| `npm run rag:indexar` | Indexa el corpus documental |
| `npm run rag:buscar` | Prueba la recuperación por similitud |
| `npm run rag:responder` | Prueba una respuesta con citación |

---

# Estructura del repositorio

```text
.
├── datos/                      paquete canónico (no se modifica)
│   ├── corpus/                 los siete documentos del RAG
│   ├── eventos.jsonl           bitácora: fuente de verdad
│   └── eventos.sha256          huella que el cargador verifica
│
├── src/
│   ├── dominio/                núcleo del P1, evolucionado en el P2
│   │   └── politica-mora/      catálogo versionado (CP-01 a CP-04)
│   ├── servicios/              casos de uso y consultas de cartera
│   ├── estrategias/            Strategy: cálculo francés, adelanto
│   ├── adaptadores/            CSV y PostgreSQL (mismo puerto)
│   ├── persistencia/           esquema, cargador canónico (E2)
│   ├── api/                    API REST sobre los servicios (E1)
│   ├── mcp/                    servidor MCP y esquemas Zod (E3)
│   ├── rag/                    ingesta, recuperación y citación (E4)
│   ├── asistente/              orquestador del chat y evaluación (E5/E6)
│   ├── contratos/              esquemas Zod → OpenAPI
│   └── demo.ts                 recorrido del núcleo por consola
│
├── tests/                      suite del P1, P2 y Proyecto Final
│   └── ayudas/                 PGlite en memoria para las pruebas
│
└── docs/
    ├── proyecto1/              ADR, OpenAPI, diagramas, trazabilidad
    ├── proyecto2/              E1–E6 de UX y evolución del núcleo
    └── proyecto-final/         decisiones del Proyecto Final
```

---

# Prototipo de alta fidelidad

Desarrollado en **Figma**, representa los tres flujos principales y es la base
de la interfaz del E1.

https://www.figma.com/design/oZNRdndoK2Nm2GskdeOjlD/Cr%C3%A9dito-vecino

## Flujos

```text
Originación            Cobro en campo          Consulta gerencial
───────────            ──────────────          ──────────────────
Solicitud              Detalle del crédito     Tablero gerencial
    ↓                          ↓                       ↓
Revisión               Detalle de la mora      Créditos del tramo
    ↓                          ↓                       ↓
Crédito aprobado       Registro del pago       Cierre diario/mensual
                               ↓
                         Comprobante
```

---

# Tecnologías utilizadas

| Área | Herramientas |
|---|---|
| Núcleo y servicios | Node.js 20+, TypeScript, Zod, date-fns |
| API | Express 5 |
| Persistencia | PostgreSQL, `pgvector`, `pg`, PGlite (pruebas) |
| Asistente | Model Context Protocol (`@modelcontextprotocol/sdk`), orquestador propio |
| RAG | Google Gemini (`gemini-embedding-001`, `gemini-3.8-flash`) |
| Pruebas | Vitest |
| Contratos | OpenAPI 3.1 generado desde Zod |
| UX / UI | Figma |
| Documentación | Markdown, Mermaid, PlantUML |

---

# Distribución del trabajo

## Proyecto Final

| Integrante | Responsabilidades |
|---|---|
| **Maryori Elizabeth Acifuina Juárez** | RAG con citación de fuentes (E4): ingesta del corpus, fragmentación, embeddings, almacenamiento vectorial, validación de citas, reglas de seguridad del asistente y evaluaciones. |
| **Dalila Nineth Zacarías de León** | Servidor MCP sobre los puertos del Proyecto 1 (E3): las ocho capacidades y la acción sensible con aprobación humana. Orquestador del chat gerencial (E5) y evaluación del asistente (E6). Puerto del repositorio de cartera y su adaptador de pruebas, corrección del plan de amortización y de la exigibilidad al corte, blindaje del servidor para OP-7, y documentación técnica (E7). |
| **Eric Alexander Barillas Orozco** | Persistencia y carga canónica (E2): esquema de base de datos, cargador idempotente con verificación SHA-256 y adaptador de PostgreSQL del repositorio de cartera. |
| **Hilton Alexander López Ic** | API REST con Express (E1): rutas de los siete casos de uso, perfiles asesor y gerencia verificados en el servidor, y los servicios de originación de créditos y cobro. |

## Etapas anteriores

| Integrante | Responsabilidades |
|---|---|
| **Maryori Elizabeth Acifuina Juárez** | Investigación de usuarios, arquitectura de información, wireframes, prototipo de alta fidelidad y documentación UX/UI. |
| **Dalila Nineth Zacarías de León** | Evolución del núcleo del dominio, política de mora escalonada, motor de negocio e integración con el Proyecto 1. |
| **Eric Alexander Barillas Orozco** | Documentación de movilidad y experiencia de usuario, y ADR del Proyecto 2. |

---

# Uso de Inteligencia Artificial

En cumplimiento del apartado de integridad académica del curso, se declara el
uso de herramientas de Inteligencia Artificial durante el desarrollo.

| Herramienta | Uso principal |
|---|---|
| **Claude (Anthropic)** | Apoyo durante la implementación y revisión del núcleo, el servidor MCP y sus pruebas; redacción de documentación técnica. |
| **ChatGPT (OpenAI)** | Documentación técnica y revisión de consistencia entre entregables. |
| **Figma AI** | Propuestas iniciales de interfaz y apoyo en la construcción del prototipo. |
| **Google Gemini** | Modelo de lenguaje que **el sistema usa en producción** para los embeddings y las respuestas del módulo RAG. |

Las tres primeras se emplearon como apoyo al desarrollo. Todas las decisiones
de diseño, implementación y documentación fueron revisadas, comprendidas y
validadas por los integrantes del equipo antes de su entrega.

---

# Documentación

| Etapa | Contenido |
|---|---|
| **Proyecto 1** | Arquitectura hexagonal, modelo de dominio, OpenAPI, ADR, diagramas UML y matriz de trazabilidad |
| **Proyecto 2** | Investigación de usuarios, journey map, arquitectura de información, wireframes, prototipo, estrategia de movilidad, evaluación heurística e informe de impacto SOLID |
| **Proyecto Final** | Modelo de amenaza y defensa de OP-7 |

---

# Autores

- **Maryori Elizabeth Acifuina Juárez**
- **Dalila Nineth Zacarías de León**
- **Eric Alexander Barillas Orozco**
- **Hilton Alexander López Ic**

---

**Universidad Mariano Gálvez de Guatemala**

**2026**
