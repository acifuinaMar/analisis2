# ADR-001: Estilo arquitectónico del Sistema de Gestión de Microcrédito

| Campo | Contenido |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | 28/08/2026 |

## Contexto

Crédito Vecino, S. A. requiere un sistema que calcule dinero de forma exacta y
auditable, y que evolucione en tres fases sin reescrituras: Proyecto 1 (núcleo
de dominio), Proyecto 2 (interfaz) y Proyecto Final (RAG, servidor MCP,
pruebas del sistema completo). Los atributos de calidad priorizados en el
Entregable 2 son, en ese orden: **fiabilidad**, **mantenibilidad** y
**seguridad** (ISO/IEC 25010).

Fuerzas en juego:

- El cálculo financiero (plan de amortización, mora, prelación de pagos,
  cartera en riesgo) debe poder probarse exhaustivamente, en milisegundos,
  sin infraestructura, porque cada centavo importa (sección 1 del enunciado).
- En el Proyecto Final, el servidor MCP y el chat con RAG deben responder
  **exactamente lo mismo** que la API REST, porque ambos invocan el mismo
  cálculo. Si el cálculo viviera en un controlador HTTP, el asistente lo
  duplicaría, y dos implementaciones del mismo cálculo divergen siempre.
- El dominio (plazos, tasas, tramos de mora, prelación) es política
  institucional sujeta a cambio regulatorio (Decreto 25-2016, Resolución
  JM-47-2022): debe poder sustituirse sin tocar la infraestructura, y
  viceversa.
- El equipo es de una sola persona por fase (proyecto individual/grupal
  reducido) y el plazo es corto: la solución no puede exigir coordinar
  varios desplegables ni resolver consistencia distribuida desde el primer
  entregable.

## Decisión

Se adopta **arquitectura hexagonal (puertos y adaptadores)**, empaquetada
como un **monolito modular** con cuatro módulos de frontera explícita
(Originación, Cálculo financiero, Cartera y Cobros, Cierres — sección 7.2),
en vez de:

- **Arquitectura en capas clásica**: se descartó porque en la práctica las
  capas superiores terminan importando el ORM o el framework HTTP dentro de
  la lógica de negocio, acoplando el cálculo a la infraestructura que
  todavía no existe en el Proyecto 1 y que puede cambiar en el Proyecto
  Final (de Express a un servidor MCP).
- **Microservicios**: se descartó explícitamente. Repartir un desembolso y
  su asiento contable entre dos servicios convierte una transacción local
  (invariante 6.10: `Σ amortizaciones = capital`) en un problema de
  consistencia distribuida que el enunciado no exige resolver y que
  añadiría complejidad operativa sin un atributo de calidad que lo
  justifique en esta escala de negocio.
- **MVC puro**: favorece la interfaz, no el aislamiento del cálculo; no
  ofrece un lugar natural para un puerto secundario como el Reloj (ver más
  abajo) ni para intercambiar la persistencia sin tocar el dominio.

El núcleo de dominio (`src/dominio`, `src/estrategias`, `src/servicios`) no
importa nada de infraestructura: ni `express`, ni `pg`, ni el reloj del
sistema. La fecha de corte entra siempre por el puerto `Reloj`
(`src/dominio/reloj.ts`), inyectado desde afuera; en pruebas se usa un reloj
fijo (`src/adaptadores/reloj-fijo.ts`). Esto es lo que permite que
`npm test` corra en milisegundos y sin servidor.

## Consecuencias

**Positivas**

- El núcleo se prueba con funciones puras: las 151 pruebas de E4 corren en
  segundos, sin base de datos ni red.
- Los contratos de E5 (`src/contratos`, `docs/api/openapi.yaml`) describen
  los **puertos primarios** del hexágono. En el Proyecto Final, el servidor
  MCP será un adaptador primario nuevo que invoca los mismos casos de uso
  que la API REST invocará entonces — no una reescritura.
- Cambiar la política de tasas o el método de interés (Strategy, sección
  9) no exige tocar la capa de persistencia ni la de presentación.

**Negativas / trade-offs asumidos**

- Un monolito modular concentra el despliegue: si en el futuro un módulo
  necesita escalar por separado, habrá que extraerlo. Se acepta este
  costo porque la frontera entre módulos (sección 7.2) ya existe y hace esa
  extracción localizada, no una reescritura completa.
- Puertos y adaptadores añaden una capa de indirección (interfaces como
  `Reloj`, `RepositorioCreditos`) que no se necesitaría en un script
  simple. Se acepta porque es precisamente esa indirección la que permite
  sustituir infraestructura sin tocar el cálculo financiero.