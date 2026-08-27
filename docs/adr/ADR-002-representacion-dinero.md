# ADR-002: Representación de importes monetarios

| Campo | Contenido |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | 28/08/2026 |

## Contexto

El sistema calcula planes de amortización, mora e indicadores de cartera
sobre importes en quetzales. La sección 6.2 del enunciado es una regla no
negociable: **ningún importe puede representarse con `Number` de punto
flotante**, porque IEEE-754 no puede representar exactamente fracciones
decimales como 0.01 o 0.03. Un ejemplo conocido del propio lenguaje:
`0.1 + 0.2 !== 0.3` en JavaScript. Sobre miles de cuotas, ese error se
acumula y produce descuadres reales entre el sistema y la contabilidad.

Fuerzas en juego:

- El enunciado permite tres alternativas: enteros en centavos, o una
  biblioteca decimal (`decimal.js`, `big.js`, `dinero.js`).
- El redondeo debe ser "medio hacia arriba, aplicado en cada cuota y no al
  final" (sección 6.2), y debe ser reproducible byte a byte contra el caso
  de referencia de la sección 6.4.1 (12 filas exactas).
- El dinero debe ser inmutable, llevar su moneda, y prohibir operar
  quetzales contra dólares.
- El mismo problema existe en el borde de la API (E5): un número JSON con
  decimales sigue siendo un `float` de punto flotante IEEE-754 del lado
  del cliente, así el núcleo interno use centavos.

## Decisión

Se representa todo importe como un **Objeto de Valor `Dinero`**
(`src/dominio/dinero.ts`) que internamente guarda un **entero en
centavos** (`number`, pero siempre entero, nunca fraccionario), en vez de
adoptar una biblioteca decimal externa como `decimal.js`.

Razones de la elección frente a la alternativa permitida (biblioteca
decimal):

- Los enteros de JavaScript son exactos hasta `Number.MAX_SAFE_INTEGER`
  (2^53 − 1), muy por encima de cualquier cartera de microcrédito realista
  (rango de créditos: Q1,000–Q25,000, sección 2). No hace falta una
  biblioteca de precisión arbitraria para un dominio de esta magnitud.
- Evita una dependencia externa adicional en el núcleo de dominio, que el
  enunciado pide mantener "sin dependencias de infraestructura" (sección
  7.1) y lo más simple posible dado que es un walking skeleton (E4).
- El redondeo "medio hacia arriba" se implementa una sola vez, en un solo
  método privado (`Dinero.redondearMedioArriba`), y se aplica en cada
  operación (`sumar`, `restar`, `multiplicar`, `dividir`), nunca al final —
  exactamente como exige la sección 6.2.
- `Dinero` es inmutable: cada operación devuelve una instancia nueva
  (`sumar()` nunca muta `this`), y su constructor es privado — solo se
  construye a través de fábricas (`Dinero.desde`, `Dinero.desdeCentavos`)
  que garantizan la invariante de no admitir importes negativos ni no
  enteros en centavos.
- `Dinero.restar` **lanza** si el resultado sería negativo, lo que
  convierte el invariante "ningún saldo de capital es negativo" (sección
  6.10) en algo imposible de violar por construcción, no en algo que haya
  que recordar verificar con un `if` en cada caso de uso.
- La comparación de monedas (`verificarMoneda`) lanza si se intenta operar
  GTQ contra USD, cumpliendo la prohibición explícita de la sección 6.2.

**Extensión al borde de la API (E5):** en los contratos de la API
(`src/contratos/comun.ts`) el mismo problema se resuelve extendiendo la
decisión a la capa de transporte: `Dinero` se serializa como un objeto
`{ moneda, monto }` donde `monto` es una **cadena** con exactamente dos
decimales (p. ej. `"1004.62"`), nunca un `number` de JSON. Así, un cliente
HTTP que reciba la respuesta no reintroduce el error de punto flotante que
el núcleo evitó internamente representando centavos como entero — la
regla de la sección 6.2 se sostiene de punta a punta, no solo dentro de
`src/dominio`.

## Consecuencias

**Positivas**

- El caso de referencia de la sección 6.4.1 (12 cuotas, ajuste de Q0.01 en
  la última) se reproduce exactamente, celda por celda, sin
  aproximaciones (`tests/plan-amortizacion.test.ts`).
- Los invariantes de la sección 6.10 (`Σ amortizaciones = capital`, `saldo
  final = 0.00`, `ningún saldo negativo`) se cumplen por construcción del
  tipo, no por disciplina del programador.
- No hay dependencias externas en el núcleo de dominio para resolver algo
  que un entero nativo ya resuelve a esta escala.

**Negativas / trade-offs asumidos**

- Si en el futuro la institución operara montos que se acerquen al límite
  de entero seguro de JavaScript (impensable en microcrédito, pero posible
  en otro dominio), habría que migrar a una biblioteca de precisión
  arbitraria. Se acepta el riesgo porque el rango de negocio (sección 2)
  está muchísimos órdenes de magnitud por debajo de ese límite.
- Cada operación aritmética exige pasar por `Dinero` en vez de operar
  números sueltos; esto es intencional (fuerza a que todo importe declare
  su moneda), pero añade una capa de indirección frente a escribir
  `a + b` directamente.