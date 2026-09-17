# Informe de impacto SOLID — Evolución del núcleo (E6)

**Sistema de Gestión de Microcrédito — Crédito Vecino, S. A.**
Análisis de Sistemas II (037) · Proyecto 2 · Cambio de requisito: política de mora escalonada (Acta 09-2026, sección 7 del enunciado)

> **Nota metodológica:** este informe se elaboró leyendo el código del núcleo y respaldándolo con la salida real de `git diff --stat` y `git log -p` entre el commit de entrega del Proyecto 1 (`entrega-p1`) y el `HEAD` de la rama `proyecto2` (commit `88c1431`). Toda cifra de este documento proviene de esa comparación, no de estimación por inspección.

---

## 1. Punto de partida

| | Referencia |
|---|---|
| Commit de entrega del Proyecto 1 | `8b30186` (tag `entrega-p1`) — "Documentar Chain of Responsibility en el E3" |
| Commit de entrega del Proyecto 2 | `88c1431` (HEAD de `proyecto2`) — "Corregir los tres huecos del Proyecto 1 (CP-04)" |
| Commits que componen la evolución de E6 | `7a31e2d` (CP-01 y CP-03), `ab68452` (CP-02, gasto de gestión de cobro), `88c1431` (CP-04.1 a CP-04.3) |
| Cambio de requisito evaluado | Política moratoria escalonada por tramo de atraso (CP-01), gasto de gestión de cobro (CP-02), coexistencia de políticas (CP-03), y tres correcciones de huecos del Proyecto 1 (CP-04.1 a CP-04.3) |

---

## 2. Métricas del cambio

Fuente: `git diff --stat entrega-p1..HEAD -- src/dominio/ src/servicios/`

```
 src/dominio/devengo-interes.ts                          | 102 ++++++++++++++
 src/dominio/estados/estado-credito.ts                   |   9 ++
 src/dominio/estados/estados-credito.ts                  |  27 +++-
 src/dominio/gasto-gestion-cobro.ts                      | 122 ++++++++++++++++
 src/dominio/plan-amortizacion.ts                        | 118 ++++++++++++++--
 src/dominio/politica-mora/catalogo-politicas.ts         | 110 +++++++++++++++
 src/dominio/politica-mora/politica-mora-escalonada.ts   | 155 +++++++++++++++++++++
 src/dominio/politica-mora/politica-mora-plana.ts        |  58 ++++++++
 src/dominio/politica-mora/politica-mora-retroactiva.ts  |  74 ++++++++++
 src/dominio/politica-mora/politica-mora.ts              |  69 +++++++++
 src/servicios/calculadora-mora.ts                       |  42 +++---
 src/servicios/cartera.ts                                | 146 ++++++++++++++++++-
 12 files changed, 996 insertions(+), 36 deletions(-)
```

| Métrica | Valor | Evidencia |
|---|---|---|
| Archivos del núcleo **creados** | **7**: `devengo-interes.ts`, `gasto-gestion-cobro.ts`, `catalogo-politicas.ts`, `politica-mora-escalonada.ts`, `politica-mora-plana.ts`, `politica-mora-retroactiva.ts`, `politica-mora.ts` | `git diff --diff-filter=A --name-only entrega-p1..HEAD -- src/dominio/ src/servicios/` |
| Archivos del núcleo **modificados** | **5**: `estado-credito.ts`, `estados-credito.ts`, `plan-amortizacion.ts`, `calculadora-mora.ts`, `cartera.ts` | `git diff --diff-filter=M --name-only entrega-p1..HEAD -- src/dominio/ src/servicios/` |
| ¿Se modificó el motor de cálculo de mora (`calculadora-mora.ts`)? | **Sí, exactamente una vez**, en el commit `7a31e2d`. Ningún commit posterior de E6 (`ab68452`, `88c1431`) vuelve a tocarlo. Ver el análisis del principio O en la sección 3. | `git log --oneline entrega-p1..HEAD -- src/servicios/calculadora-mora.ts` → un solo resultado |
| Pruebas del P1 que dejaron de pasar | 0 | `npm test` sobre `HEAD`: 254/254 pruebas pasan, incluida la suite heredada del P1 |
| Pruebas del P1 que hubo que reescribir | 0 (con un matiz honesto) | El commit `7a31e2d` mueve el punto de construcción de tres pruebas del P1 (de `PoliticaCredito` directa a `POLITICA_PLANA_2024`), pero **ninguna aserción se modificó**: el valor de Q7.26 a 15 días sigue siendo el resultado esperado. Es un cambio de fixture, no una reescritura de lo que se verifica. |
| Líneas netas añadidas/eliminadas al núcleo (`src/dominio/` + `src/servicios/`) | **996 inserciones, 36 eliminaciones** | Ver bloque de diff arriba |

El objetivo orientativo del enunciado (60–120 líneas para un cambio bien absorbido, sección 8.1) se refiere a un cambio de requisito aislado; aquí el diff cubre **tres** entregables encadenados en el mismo rango (CP-01+CP-03, CP-02, y las tres correcciones CP-04), lo cual explica razonablemente por qué la cifra total es casi diez veces mayor. Descontando lo que corresponde solo a CP-01/CP-03 (los 5 archivos de política: `politica-mora.ts` + `-plana` + `-escalonada` + `-retroactiva` + `catalogo-politicas.ts` = 466 líneas, más el ajuste de 42 líneas en `calculadora-mora.ts`), el cambio de requisito estrictamente pedido por el comité (sección 7 del enunciado) ronda las **500 líneas** — todavía por encima del rango orientativo, y ese exceso también merece explicarse: la política escalonada no es solo "una tasa nueva", es una fórmula nueva (suma sobre tramos recorridos) más una tercera implementación (`retroactiva`) que existe únicamente para poder probar Liskov. Sin esa tercera política, el cambio real habría sido más cercano al rango sugerido.

---

## 3. Los cinco principios, uno por uno

### S — Responsabilidad única

**Pregunta:** ¿Quién decide en qué tramo está una cuota, y quién decide cuánto cuesta ese tramo? ¿Son la misma clase?

**Evidencia:** No. Son dos clases separadas y con responsabilidades que no se solapan:

- `ClasificadorTramoMora` (`src/dominio/tramo-mora.ts`) traduce días de atraso → tramo (`MORA_1`, `MORA_2`, `MORA_3`, `VENCIDO`). Es una función pura: mismo número de días, mismo tramo, sin importar el historial del crédito. Además vive ahí la guarda de incobrable (`superaPlazoParaIncobrable`) y la de suspensión de devengo (`suspendeDevengo`) — ambas son clasificaciones derivadas de los días de atraso, no cálculos monetarios.
- `PoliticaMoraEscalonada` (`src/dominio/politica-mora/politica-mora-escalonada.ts`) no clasifica nada: recibe días de atraso y capital en mora, y devuelve un monto. La tabla de tasas (`TRAMOS_CP01`, en `catalogo-politicas.ts`) es un tercer objeto, separado de ambas: **la tasa del 30 % de Mora 3 se cambia editando un arreglo de datos, sin tocar ni el clasificador ni la política.**

Esta separación es justo lo que permite responder la pregunta de la sección 8.2 sin ambigüedad: clasificar y tasar son decisiones distintas, tomadas por objetos distintos, probadas por separado (`tests/tramo-mora.test.ts` vs. `tests/politica-mora.test.ts`).

### O — Abierto/cerrado

**Pregunta:** ¿Pudo agregar la política escalonada sin abrir el motor de cálculo?

**Evidencia, confirmada con `git log -p`:** `calculadora-mora.ts` aparece en el diff de un solo commit de todo el rango `entrega-p1..HEAD`: `7a31e2d` ("Inyectar la política moratoria completa en el motor (CP-01 y CP-03)"). Ningún commit posterior (`ab68452`, CP-02; `88c1431`, CP-04) vuelve a tocarlo.

El diff de ese commit único muestra el cambio real:

```diff
- constructor(private readonly politica: PoliticaCredito) {}
+ constructor(private readonly politica: PoliticaMora) {}

  public calcular(capitalEnMora: Dinero, diasAtraso: number): Dinero {
-     if (!Number.isInteger(diasAtraso)) { throw new Error(...); }
-     if (diasAtraso <= 0) { return Dinero.cero(...); }
-     return capitalEnMora.multiplicar(this.politica.tasaMoratoriaDiaria() * diasAtraso);
+     return this.politica.calcular(capitalEnMora, diasAtraso);
  }
```

**Traducido a la pregunta del informe:** en el Proyecto 1 el principio abierto/cerrado estaba aplicado *a medias*. El commit `1d1ed32` (25 de agosto, ya en P1) había sacado la *tasa* del motor hacia `PoliticaCredito`, pero la *fórmula* (capital × tasa diaria × días, con su validación de días incluida) seguía escrita dentro de `calculadora-mora.ts`. Eso alcanzaba para variar un porcentaje, pero no para variar una fórmula — y la política escalonada no es una tasa distinta, es una fórmula distinta (suma sobre tramos recorridos). Por eso el motor tuvo que abrirse una vez, en `7a31e2d`, para pasar de recibir una tasa a recibir el cálculo completo a través del puerto `PoliticaMora`.

El propio mensaje de ese commit documenta la intención de diseño de forma explícita: la política retroactiva (`politica-mora-retroactiva.ts`) se agregó *después*, y en su commit no vuelve a aparecer `calculadora-mora.ts` en el diff. Esa ausencia es la prueba de que el principio quedó satisfecho a partir de ese punto: el archivo no dejó de cambiar *nunca en la historia del proyecto* — dejó de cambiar **a partir del momento en que la abstracción correcta quedó en su lugar**, y esa es la lectura que el enunciado pide reportar (sección 8.3: "explica la causa y describe el rediseño aplicado").

**Dónde se cumplió sin excepción, desde el primer commit de la evolución:** la tabla de tasas (`TRAMOS_CP01` en `catalogo-politicas.ts`) es un arreglo de datos con fecha de vigencia, introducido junto con el puerto en el mismo commit `7a31e2d`. Cambiar el 30 % de Mora 3 a 32 %, o agregar un sexto tramo, es editar ese arreglo — no recompilar lógica de negocio en ningún otro archivo, y esto no ha requerido ningún ajuste posterior en los commits `ab68452` o `88c1431`.

### L — Sustitución de Liskov

**Pregunta:** ¿Puede intercambiar la política plana, la escalonada y la retroactiva sin que ninguna rompa los invariantes del motor?

**Evidencia:** `tests/contrato-politica.test.ts` (34 pruebas) ejecuta la **misma batería de aserciones** contra las tres implementaciones de `PoliticaMora` — plana, escalonada y retroactiva — verificando que las tres respetan el mismo contrato: mismo tipo de retorno (`Dinero`), el tope de no exceder el capital en mora, el rechazo de días de atraso negativos o no enteros, y el comportamiento en `diasAtraso = 0`. Ninguna de las tres lanza una excepción de "no soportado" ni exige un caso especial en quien las consume — `CalculadoraMora` las trata de forma completamente intercambiable.

### I — Segregación de interfaces

**Pregunta:** ¿El puerto de política de mora expone solo lo que el motor necesita, o arrastra métodos que ninguna implementación usa?

**Evidencia:** la interfaz `PoliticaMora` (`src/dominio/politica-mora/politica-mora.ts`) tiene exactamente dos miembros: `version: string` y `calcular(capitalEnMora, diasAtraso): Dinero`. Nada más. El tope común (`aplicarTope`) y la validación de días (`validarDiasAtraso`) se sacaron del contrato de la interfaz a funciones libres que cada implementación invoca si las necesita — así el puerto no obliga a ninguna política a implementar una regla que no le corresponde declarar. Ninguna de las tres implementaciones tiene un método vacío ni un `throw new Error("no soportado")`.

### D — Inversión de dependencias

**Pregunta:** ¿El motor depende de la abstracción de política, o de una implementación concreta?

**Evidencia:** `CalculadoraMora` recibe `PoliticaMora` (la interfaz) en su constructor, nunca una clase concreta:

```ts
constructor(private readonly politica: PoliticaMora) {}
```

Y quien decide *cuál* implementación concreta usar no es el motor ni el crédito: es `CatalogoPoliticasMora.resolver(fechaOtorgamiento)`, un objeto aparte cuya única razón de existir es esa decisión (CP-03). `credito.ts` tampoco importa `PoliticaMora` en absoluto — depende de `PoliticaCredito`, el puerto más general definido ya en el Proyecto 1. La dirección de la dependencia siempre apunta hacia la abstracción, nunca al revés.

---

## 4. GRASP

- **Experto en información:** `ClasificadorTramoMora` (`src/dominio/tramo-mora.ts`) es quien conoce los días de atraso y los límites de cada tramo (30/60/90/120); es también quien responde si se suspende el devengo (`suspendeDevengo()`) o si el crédito es candidato a incobrable (`superaPlazoParaIncobrable()`). Lo notable, confirmado por el diff: **`tramo-mora.ts` no aparece ni en los archivos creados ni en los modificados del rango P1→P2** — es decir, esos dos métodos ya existían desde el Proyecto 1, anticipando exactamente la información que E6 terminaría necesitando. La clase nueva `DevengoInteres` (CP-04.2) se limita a *consumir* `suspendeDevengo()` sin tener que abrir ni ampliar el clasificador. Es la evidencia más limpia de "experto en información" de todo el cambio: la pieza que ya sabía calcular el dato siguió siendo la única que lo calcula, incluso para un caso de uso que el Proyecto 1 no había terminado de resolver.
- **Polimorfismo, no switch:** la elección entre política plana y escalonada se resuelve por **despacho polimórfico** a través de `PoliticaMora.calcular()`, no con un `switch (tipoPolitica)`. El único `switch` que existe en la zona de mora está en `cartera.ts`, sobre el `TramoMora` ya clasificado, para decidir en qué fila del desglose cae un crédito — es un `switch` de presentación de datos, no de reglas de negocio, y no crecerá cuando se agregue una política de tasa nueva.
- **Bajo acoplamiento / alta cohesión:** medido por el diff `[COMPLETAR]`, pero cualitativamente: cada archivo nuevo tiene una sola razón para cambiar (la tabla de tasas cambia por decisión del comité; el clasificador cambia si cambian los límites de días; la política escalonada cambia si cambia la fórmula de tramos recorridos). Son tres razones de cambio distintas, en tres archivos distintos.

---

## 5. Resultado de las pruebas

```
Test Files  15 passed (15)
     Tests  254 passed (254)
```

Incluye, entre otras:

- Los cinco casos oráculo: M-1 (Q5.44), M-2 (Q18.14), M-3 (Q50.80), M-4 (Q65.32), M-5 (Q1,047.76) — `tests/politica-mora.test.ts`, `tests/gasto-gestion-cobro.test.ts`.
- Coexistencia de políticas (CP-03): Q21.77 con la política plana y Q18.14 con la escalonada para la misma cuota — mismo archivo.
- La suite heredada del P1 sigue pasando sin modificarse: la prueba de los Q7.26 a 15 días con política plana sigue siendo verde.
- Batería de contrato (Liskov) contra las tres políticas — `tests/contrato-politica.test.ts` (34 pruebas).
- Desglose de cartera en riesgo por tramo (CP-04.3): 3.00 % + 2.25 % + 1.00 % + 0.75 % = 7.00 % — `tests/cartera-por-tramo.test.ts`.
- Transición `en_mora → cancelado` (CP-04.1) y suspensión de devengo (CP-04.2) — `tests/correcciones-p1.test.ts`.

`npm install && npm test` corre en limpio. `tsconfig.json` mantiene `"strict": true`; no se encontró uso de `any` en `src/`.

---

## 6. Puntos de fricción (honestos, no maquillados)

Esto es lo que el enunciado pide explícitamente en la sección 8.3 y penaliza si se omite: qué archivos hubo que abrir que en un diseño ideal no deberían haberse tocado.

Confirmados por `git diff --diff-filter=M`, los 5 archivos que sí hubo que abrir son:

1. **`src/dominio/estados/estados-credito.ts`** (+27/−10) y **`src/dominio/estados/estado-credito.ts`** (+9) se modificaron para agregar la transición `en_mora → cancelado` (CP-04.1). Esto **no es una violación de OCP del motor de cálculo** — es la máquina de estados del patrón State, y agregar una transición nueva es exactamente el tipo de cambio para el que esos archivos existen. Se documentan aquí porque es honesto reportarlos como archivos del núcleo modificados, aunque su causa (un hueco no contemplado en el Proyecto 1, no un defecto de diseño en la lógica de cálculo) es distinta a la de `calculadora-mora.ts`.
2. **`src/servicios/cartera.ts` se modificó** (146 líneas) para exponer `desglosePorTramo()` (CP-04.3). Es el archivo con más líneas tocadas de todo el cambio; vale la pena que el equipo revise en la defensa si ese tamaño corresponde solo al método nuevo o si arrastró alguna reestructuración adicional del archivo.
3. **`src/dominio/plan-amortizacion.ts` se modificó** (118 líneas) — no estaba contemplado como archivo de fricción en un análisis solo por inspección de código, y solo aparece al correr el diff real. Según el propio mensaje del commit `7a31e2d`, el cambio es que el plan de amortización pasa a **resolver la política moratoria por la fecha de otorgamiento del crédito** (a través de `CatalogoPoliticasMora`), en vez de asumir una política fija — es el punto donde CP-03 (coexistencia de políticas) se conecta con el resto del dominio. Es una modificación necesaria y explicable, pero es la más grande de las cinco y merece que el equipo la revise línea por línea en la defensa, porque 118 líneas en un archivo que ya existía es una señal que un evaluador exigente va a preguntar por qué no fue menor.
4. **`src/servicios/calculadora-mora.ts` se modificó una sola vez** (ver sección 3, principio O), y no volvió a tocarse en los dos commits posteriores de E6. Es el hallazgo central de este informe: revela que el Proyecto 1 aplicó abierto/cerrado *parcialmente* (a la tasa, no a la fórmula), y que ese hueco se cerró en P2 con una interfaz que ya no necesitó abrirse de nuevo para la tercera política (`politica-mora-retroactiva.ts`).

**Lo que el diff descarta de plano:** `tramo-mora.ts` no se tocó — la clasificación por tramo y la guarda de suspensión de devengo ya existían en el Proyecto 1 y E6 solo las consumió.

Ningún archivo del núcleo fue **reescrito** para absorber el cambio; las cinco modificaciones fueron **aditivas o de sustitución de una dependencia por otra** (cambiar `PoliticaCredito` por `PoliticaMora`, agregar un método, agregar una transición), no reescrituras de la lógica ya existente.

---

## 7. Conclusión

El diseño del Proyecto 1 aplicó SOLID de forma **desigual entre principios**, y el diff lo confirma con exactitud: S, L, I y D se sostuvieron sin que el equipo tuviera que reabrir ningún archivo del Proyecto 1 para las piezas que esos principios protegen — la clasificación por tramo (`tramo-mora.ts`) no se tocó ni una vez, y las tres políticas conviven bajo el mismo contrato sin excepciones. O se sostuvo **después de un ajuste único, localizado y ya cerrado**: la abstracción del Proyecto 1 (commit `1d1ed32`) parametrizaba la tasa pero dejaba la fórmula fija dentro del motor, y ese fue precisamente el techo que el cambio de requisito puso a prueba. El commit `7a31e2d` cerró ese hueco en un solo movimiento, y ningún commit posterior de la evolución (`ab68452`, `88c1431`) tuvo que volver a `calculadora-mora.ts`.

El punto de fricción más alto del cambio no está en el motor de mora, sino en `plan-amortizacion.ts` (118 líneas modificadas) y en `cartera.ts` (146 líneas modificadas) — ambos archivos preexistentes del Proyecto 1 que tuvieron que aprender a consultar la política correcta según la fecha de otorgamiento y a exponer el desglose por tramo, respectivamente. Ninguno de los dos rompe abierto/cerrado en el sentido estricto del motor de cálculo, pero si el equipo tuviera que rediseñar hoy, la pregunta que vale la pena hacerse es si esas dos piezas debieron depender de una abstracción más delgada desde el Proyecto 1, en vez de tener que ampliarse directamente para admitir el nuevo caso.

La lección concreta, aplicable a cualquier puerto futuro del sistema: cuando una interfaz se define para parametrizar solo *un número* de una regla de negocio, hay que preguntarse explícitamente si el número es lo único que cambiará algún día, o si podría cambiar la fórmula que lo usa. En este caso cambió la fórmula, y el costo real de no haberlo anticipado en el Proyecto 1 —medido, no estimado— fue un archivo del motor abierto una sola vez, en un solo commit, con un diff de 26 líneas.
