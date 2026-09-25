# E3 · Cifras del núcleo para el prototipo

**Sistema de Gestión de Microcrédito — Crédito Vecino, S. A.**
Análisis de Sistemas II (037) · Proyecto 2

---

## Para qué sirve este documento

La sección 6.2 del enunciado es explícita:

> Si su prototipo muestra un plan de amortización, debe mostrar el que
> calcula su núcleo, no cifras inventadas.

Todos los valores de este documento **salieron del núcleo evolucionado en
E6**, no se escribieron a mano. Son los textos exactos que deben aparecer
en las pantallas de Figma.

**Caso de referencia usado en todo el prototipo:**

| Dato | Valor |
|:---|:---|
| Crédito | `CV-2026-0410` |
| Capital desembolsado | Q10,000.00 |
| Tasa | 36 % nominal anual · 3 % mensual |
| Plazo | 12 cuotas mensuales |
| Fecha de desembolso | 10 de octubre de 2026 |
| Política moratoria | `POL-2026-10` · escalonada (posterior al 1/10/2026) |

Cómo regenerarlas si alguien cambia el núcleo:

```bash
npm test          # 254 pruebas deben pasar
npm run demo      # imprime la tabla y los escenarios
```

---

## Pantalla 1 · Solicitud de crédito

Simulación que se muestra **antes** de confirmar:

| Elemento | Texto exacto |
|:---|:---|
| Monto solicitado | `Q10,000.00` |
| Plazo | `12 meses` |
| Tasa | `36 % nominal anual (3 % mensual)` |
| Cuota mensual | `Q1,004.62` |
| Total a pagar | `Q12,055.45` |
| Interés total | `Q2,055.45` |

> **Ojo con la tasa.** La sección 6.3 advierte que «36 % anual» no significa
> nada sin decir si es nominal o efectiva. Poner las dos formas, como arriba.

Límites para la validación del campo: **Q1,000 – Q25,000** y **3 a 24 meses**.

---

## Pantalla 2 · Detalle del crédito

Estado del crédito al corte, con la cuota 2 vencida hace 45 días:

| Elemento | Texto exacto |
|:---|:---|
| Saldo de capital | `Q8,569.62` |
| Próxima cuota | `Q1,004.62` |
| Vence | `10 de diciembre de 2026` |
| Estado | `En mora` |
| Tramo | `Mora 2` |
| Total adeudado hoy | `Q1,047.76` |

> **Microcopy obligatorio.** La heurística 2 de Nielsen pregunta: ¿dice
> «Mora 2» o dice «lleva más de un mes de atraso»? Marta no sabe qué es un
> tramo. Poner **las dos**:
>
> `Mora 2 · lleva más de un mes de atraso`

---

## Pantalla 3 · Registro de pago

El desglose de la prelación cambia según los días de atraso. Diseñar los
**dos estados**, porque el gasto de gestión solo existe desde el día 31.

### Estado A · 15 días de atraso (Mora 1)

| # | Rubro | Monto |
|:---:|:---|---:|
| 1 | Gastos de gestión de cobro | `Q0.00` |
| 2 | Interés moratorio | `Q5.44` |
| 3 | Interés corriente | `Q278.86` |
| 4 | Capital | `Q725.76` |
| | **Total adeudado** | **`Q1,010.06`** |

### Estado B · 45 días de atraso (Mora 2)

| # | Rubro | Monto |
|:---:|:---|---:|
| 1 | Gastos de gestión de cobro | `Q25.00` |
| 2 | Interés moratorio | `Q18.14` |
| 3 | Interés corriente | `Q278.86` |
| 4 | Capital | `Q725.76` |
| | **Total adeudado** | **`Q1,047.76`** |

Microcopy para el gasto:

```
Gestión de cobro · visita del 10 dic — Q25.00
```

> **Dos trampas.** El gasto **no** aparece en Mora 1: no hubo visita, así que
> no se cobra. Y el orden de los cuatro rubros es regla de negocio, no
> estética: gastos → mora → interés corriente → capital. Reordenarlo cambia
> cuánto debe el cliente.

---

## Pantalla 4 · Plan de amortización

Las 12 cuotas exactas. **La fila 12 debe destacarse visualmente.**

| # | Cuota | Capital | Interés | Vence |
|---:|---:|---:|---:|:---|
| 1 | 1,004.62 | 704.62 | 300.00 | 10 oct 2026 |
| 2 | 1,004.62 | 725.76 | 278.86 | 10 nov 2026 |
| 3 | 1,004.62 | 747.53 | 257.09 | 10 dic 2026 |
| 4 | 1,004.62 | 769.96 | 234.66 | 10 ene 2027 |
| 5 | 1,004.62 | 793.06 | 211.56 | 10 feb 2027 |
| 6 | 1,004.62 | 816.85 | 187.77 | 10 mar 2027 |
| 7 | 1,004.62 | 841.35 | 163.27 | 10 abr 2027 |
| 8 | 1,004.62 | 866.59 | 138.03 | 10 may 2027 |
| 9 | 1,004.62 | 892.59 | 112.03 | 10 jun 2027 |
| 10 | 1,004.62 | 919.37 | 85.25 | 10 jul 2027 |
| 11 | 1,004.62 | 946.95 | 57.67 | 10 ago 2027 |
| **12** | **1,004.63** | **975.37** | **29.26** | 10 sep 2027 |

Totales: **Q12,055.45** pagado · **Q2,055.45** de interés · saldo final
**Q0.00** exacto.

Microcopy obligatorio junto a la cuota 12:

```
La última cuota lleva un centavo más para cerrar el saldo en Q0.00 exacto.
```

> **No es un error de cálculo.** Es el ajuste de cuadre: sin ese centavo el
> saldo quedaría en Q0.01 y el crédito nunca se cancelaría. El enunciado
> penaliza con −0.5 pts la última cuota sin ajustar, y la lista de
> verificación pide que esté **explicada**, no solo presente.

---

## Pantalla 5 · Detalle de la mora

Caso **M-3**: capital en mora Q725.76, 100 días de atraso.

| Tramo | Días | TNA | Tasa diaria | Monto |
|:---|---:|---:|---:|---:|
| Mora 1 · 1–30 d | 30 | 18 % | 0.000500000 | `Q10.89` |
| Mora 2 · 31–60 d | 30 | 24 % | 0.000666667 | `Q14.52` |
| Mora 3 · 61–90 d | 30 | 30 % | 0.000833333 | `Q18.14` |
| Vencido · 91–120 d | 10 | 36 % | 0.001000000 | `Q7.26` |
| **Total** | **100** | — | — | **`Q50.80`** |

> **La trampa más importante del prototipo.** Los cuatro montos redondeados
> suman **Q50.81**, pero el total correcto es **Q50.80**. No es un error: el
> redondeo ocurre **una sola vez**, al cerrar el cálculo de la cuota. Sumar
> tramo por tramo redondeado da un centavo de más, y ese centavo por cuota,
> multiplicado por miles al mes, es un descuadre contable real.
>
> La pantalla necesita resolverlo visualmente. Una opción:
>
> ```
> Subtotal por tramos    Q50.8032
> Redondeado al cerrar   Q50.80
> ```
>
> O una nota al pie: «El total se redondea una sola vez al cerrar el cálculo,
> por eso puede diferir un centavo de la suma de los tramos».

Microcopy en lenguaje llano para el cliente:

```
Su atraso pasó por cuatro etapas. Cada día se cobró
con la tasa de la etapa en que estaba, no con la última.
```

---

## Pantalla 6 · Tablero gerencial

### Indicadores principales · cartera activa Q800,000.00

| Indicador | Monto | % | Etiqueta obligatoria |
|:---|---:|---:|:---|
| Cartera en **mora** | `Q174,000.00` | `21.75 %` | Créditos con al menos un día de atraso |
| Cartera en **riesgo** | `Q56,000.00` | `7.00 %` | Más de 30 días, más los reestructurados |
| Dado por incobrable | `Q15,000.00` | — | Baja contable del período |

### Desglose de la cartera en riesgo por tramo

| Tramo | Créditos | Saldo | % cartera activa |
|:---|---:|---:|---:|
| Mora 1 · 1–30 d | 0 | `Q0.00` | `0.00 %` |
| Mora 2 · 31–60 d | 1 | `Q24,000.00` | `3.00 %` |
| Mora 3 · 61–90 d | 1 | `Q18,000.00` | `2.25 %` |
| Vencido · 91–120 d | 1 | `Q8,000.00` | `1.00 %` |
| Reestructurado al día | 1 | `Q6,000.00` | `0.75 %` |
| **Cartera en riesgo** | **4** | **`Q56,000.00`** | **`7.00 %`** |

> **Riesgo de severidad 4.** Mostrar 21.75 % y 7.00 % sin identificar cuál es
> cada uno lleva al comité a decidir sobre el número equivocado. Van en
> **tarjetas separadas, con la etiqueta de la tercera columna visible**, no
> solo el número y el porcentaje.
>
> Y el porcentaje de riesgo **nunca se reporta solo**: debe ir acompañado de
> lo dado por incobrable en el período. Si el tablero muestra que bajó de
> 7.00 % a 6.06 %, tiene que mostrar al lado que la baja contable subió de
> Q15,000 a Q23,000 — no se cobró nada, solo salió un crédito de la cartera.

---

## Pantalla 7 · Cierre diario / mensual

| Elemento | Texto exacto |
|:---|:---|
| Fecha de corte | `24 de septiembre de 2026` (fija y visible, nunca «hoy») |
| Estado | `Congelado · 24/09/2026 21:40` |
| Cartera al corte | `Q800,000.00` |
| Dado por incobrable en el período | `Q15,000.00` |

> **La idempotencia se tiene que ver.** Reejecutar el cierre del mismo día
> produce el mismo resultado. Un segundo clic en «Ejecutar cierre» no puede
> sugerir que se van a duplicar movimientos: el botón debe cambiar a un
> estado «ya ejecutado» con la hora.

---

## Verificación antes de entregar

Recorran las pantallas con esta lista:

- [ ] La cuota 12 dice **Q1,004.63** y tiene la explicación del centavo
- [ ] El detalle de mora muestra los **cuatro tramos** del caso M-3 y resuelve el Q50.81 vs Q50.80
- [ ] El registro de pago tiene los **dos estados**, con y sin el gasto de Q25.00
- [ ] El tablero distingue **21.75 %** de **7.00 %** con etiqueta explícita
- [ ] El desglose por tramo suma **7.00 %** exacto
- [ ] Ninguna pantalla tiene un monto que no esté en este documento

Si alguna cifra del prototipo no aparece aquí, o está inventada o el núcleo
cambió. En el segundo caso, corran `npm test` y actualicen este documento
antes de tocar Figma.
