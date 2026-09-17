# ADR-003: Política moratoria escalonada por tramo de atraso

| Campo | Contenido |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | 15/09/2026 |
| **Relacionada con** | ADR-002 (Representación de importes monetarios) |

## Contexto

El Comité de Crédito de Crédito Vecino, S. A. resolvió (Acta 09-2026) reemplazar
la tasa moratoria única del 24 % nominal anual por una política escalonada:
cada tramo de atraso (Mora 1, Mora 2, Mora 3, Vencido) tiene su propia TNA
moratoria, y el interés se calcula sumando lo que corresponde a cada tramo
**recorrido**, no aplicando la tasa del tramo actual a todos los días. La
resolución exige además que los créditos otorgados antes del 1 de octubre de
2026 conserven la política plana vigente a su fecha de otorgamiento — ambas
políticas deben convivir en el mismo sistema y en el mismo cierre.

El Proyecto 1 (ADR previo, sección 6.3.1) ya había resuelto sacar la *tasa*
moratoria del motor de cálculo hacia `PoliticaCredito`, un objeto versionado
con autor y fecha de vigencia. Pero esa abstracción solo parametrizaba un
número: `calculadora-mora.ts` seguía teniendo escrita internamente la
*fórmula* `capital × tasa diaria × días`. La política escalonada no es una
tasa distinta — es una **fórmula distinta**: una suma sobre los tramos
recorridos, con una regla de redondeo propia (una sola vez, al cerrar la
cuota vencida, nunca tramo por tramo — un centavo por cuota multiplicado por
miles de cuotas es un descuadre contable real).

Fuerzas en juego:

- La tabla de tasas (18 %/24 %/30 %/36 % por tramo) es política
  institucional versionada, no una constante de código: debe poder
  cambiarse sin recompilar el motor (sección 6.3.1 del P1, reforzada por la
  sección 7.2 del enunciado de P2).
- Dos políticas —plana y escalonada— deben coexistir en el mismo cierre,
  resueltas por la fecha de otorgamiento del crédito, no por la fecha de
  corte (CP-03).
- El diseño debe poder probarse contra una tercera política hipotética
  (retroactiva, tasa del tramo actual sobre todos los días) sin que esa
  política exista en producción, solo para verificar sustitución de Liskov.
- El motor de cálculo (`calculadora-mora.ts`) no debería tener que volver a
  abrirse cada vez que el comité decida una política nueva.

## Alternativas consideradas

**A. Condicional en el motor** — agregar un parámetro `tipoPolitica` a
`CalculadoraMora` y resolver la fórmula con un `if`/`switch` dentro del
mismo archivo. Se descartó: cada política nueva obligaría a reabrir
`calculadora-mora.ts` y a extender el mismo `switch` (viola abierto/cerrado
de forma directa), y mezclaría en un solo archivo la responsabilidad de
clasificar tramos, calcular montos y decidir qué política aplica.

**B. Solo ensanchar `PoliticaCredito`** — agregarle a la interfaz existente
del P1 un método para la fórmula escalonada. Se descartó: `PoliticaCredito`
ya tiene una responsabilidad completa (tasa corriente, tasa moratoria plana,
base de conteo) y no es su lugar declarar una fórmula de tramos; hacerlo
habría violado segregación de interfaces, obligando a toda política de
crédito a implementar algo que la mayoría no necesita.

**C. Patrón Strategy con un puerto nuevo `PoliticaMora`** (adoptada) — ver
decisión.

## Decisión

Se adopta el patrón **Strategy** (GoF), con un puerto nuevo `PoliticaMora`
(`src/dominio/politica-mora/politica-mora.ts`) que expone lo mínimo que el
motor necesita: `version: string` y `calcular(capitalEnMora, diasAtraso):
Dinero`. `CalculadoraMora` pasa de inyectar una tasa a inyectar el cálculo
completo:

```ts
export class CalculadoraMora {
    constructor(private readonly politica: PoliticaMora) {}
    public calcular(capitalEnMora: Dinero, diasAtraso: number): Dinero {
        return this.politica.calcular(capitalEnMora, diasAtraso);
    }
}
```

Tres implementaciones del puerto:

- **`PoliticaMoraPlana`** — equivalente a la del Proyecto 1 (24 % sobre
  todos los días de atraso). Se conserva para los créditos anteriores al
  1/10/2026.
- **`PoliticaMoraEscalonada`** — CP-01: itera la tabla de tramos
  (`TRAMOS_CP01`, definida como datos en `catalogo-politicas.ts`, no como
  constantes de código), calcula `dias_en_tramo` para cada uno
  (`max(0, min(dias, hasta) − desde + 1)`), acumula **sin redondear** y
  aplica el redondeo una sola vez al final, sobre el total.
- **`PoliticaMoraRetroactiva`** — no adoptada por el comité; existe
  únicamente para la batería de pruebas de contrato (Liskov), para
  demostrar que el motor acepta cualquier implementación del puerto sin
  distinguirla de las de producción.

Una regla de tope común (`aplicarTope`), que ninguna política puede saltarse,
vive junto al puerto y no en cada implementación: el interés moratorio nunca
excede el capital en mora.

La resolución de **qué** política aplica a un crédito (CP-03) se saca del
motor y de cada política individual, y se delega a
`CatalogoPoliticasMora.resolver(fechaOtorgamiento)`, que ordena las entradas
del catálogo (`{ vigenteDesde, politica }`) de la más reciente a la más
antigua y devuelve la primera vigente para esa fecha. Así, un crédito de
agosto de 2026 sigue calculándose con la plana aunque el cierre se ejecute en
diciembre, sin que ninguna otra pieza del sistema necesite saberlo.

## Consecuencias

**Positivas**

- Agregar una política de tasa nueva (por ejemplo, si el comité decide un
  quinto tramo en el futuro) es escribir una implementación nueva de
  `PoliticaMora` y una entrada nueva en el catálogo — cero cambios en
  `calculadora-mora.ts`. Esto quedó demostrado, no solo argumentado: la
  política retroactiva se agregó después de la escalonada y no aparece en
  el diff de `calculadora-mora.ts` (ver `docs/informe-impacto-solid.md`,
  sección 3, principio O).
- La tabla `TRAMOS_CP01` es un arreglo de datos con fecha de vigencia:
  cambiar el 30 % de Mora 3 es editar una fila, no una fórmula.
- La batería `tests/contrato-politica.test.ts` corre las mismas
  aserciones contra las tres implementaciones, dando evidencia directa de
  sustitución de Liskov.
- El redondeo único al final, y no por tramo, se implementa en un solo
  lugar (`PoliticaMoraEscalonada.calcular`) y reproduce exactamente los
  casos oráculo M-1 a M-5 del enunciado.

**Negativas / trade-offs asumidos**

- `calculadora-mora.ts` sí tuvo que modificarse **una vez** para pasar de
  recibir una tasa a recibir el cálculo completo — el Proyecto 1 había
  aplicado abierto/cerrado solo parcialmente (a la tasa, no a la fórmula).
  Se acepta este costo, ya pagado y cerrado, como el precio de haber
  descubierto el hueco solo hasta que un cambio de requisito real lo
  expuso; queda documentado en el informe de impacto en vez de ocultarse.
- La política retroactiva no tiene ningún consumidor en producción: existe
  solo para pruebas. Se acepta el archivo adicional porque sin él la
  garantía de sustitución de Liskov quedaría solo en la teoría, no en una
  prueba ejecutable.
- El catálogo resuelve por **fecha de otorgamiento**, no por fecha de
  corte; si en el futuro el comité decidiera aplicar retroactivamente una
  política nueva a créditos ya otorgados, esa sería una decisión de
  negocio distinta (y contraria a la resolución actual del Acta 09-2026),
  que requeriría una nueva ADR, no un cambio de código.
