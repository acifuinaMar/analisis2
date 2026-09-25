# E5 · Evaluación heurística individual

## Dalila Nineth Zacarías de León

Revisé el prototipo por mi cuenta antes de juntar los resultados con el
resto del equipo. Los hallazgos que me correspondieron son **H-02** y
**H-06**, los dos en pantallas de escritorio que usa la gerencia.

---

# H-02 · No hay forma de salir del cierre mensual

| Campo | Contenido |
|:---|:---|
| **Heurística** | N.º 3 — Control y libertad del usuario |
| **Pantalla** | Cierre mensual (escritorio) |
| **Persona afectada** | Lorena Aguilar, gerente |
| **Severidad** | **2 — Menor** |

![Cierre mensual](img/cierre-mensual-pc.png)

## Qué encontré

Revisé la pantalla del cierre mensual y el único botón disponible es
**Siguiente**. No hay forma de cancelar, ni de regresar al tablero, ni de
guardar lo que se lleva y salir.

Si la gerente entra solo a ver cómo va el cierre, no tiene cómo retroceder.

## Por qué es un problema

Nielsen dice que los usuarios se meten en funciones por error y necesitan
una salida clara para abandonarlas. Aquí esa salida no existe.

En este sistema pesa más de lo normal, porque el cierre no es una pantalla
de consulta. Según la sección 6.9 del Proyecto 1, **un cierre congela las
cifras del período con una fecha de corte**: deja registro contable.

Entonces el problema no es solo que sea incómodo. Es que alguien que entró
a revisar puede terminar ejecutando un cierre solo porque era la única
dirección disponible.

## Corrección propuesta

Agregar un botón de salida al mismo nivel que **Siguiente**:

- **Cancelar**, si todavía no se ha capturado nada.
- **Guardar y salir**, si ya hay avance, para no perder lo hecho.

Ese botón debería estar siempre en la misma posición dentro del flujo. Eso
también ayuda con el criterio **3.2.6 Consistent Help** de WCAG 2.2, que
pide que la ayuda y los controles estén en el mismo lugar en todas las
pantallas.

---

# H-06 · El tablero no deja claro qué mirar primero

| Campo | Contenido |
|:---|:---|
| **Heurística** | N.º 8 — Diseño estético y minimalista |
| **Pantalla** | Tablero gerencial (escritorio) |
| **Persona afectada** | Lorena Aguilar, gerente |
| **Severidad** | **1 — Cosmético** |

![Dashboard gerencial](img/dashboard-gerencial-pc.png)

## Qué encontré

El tablero muestra al mismo tiempo los indicadores, las gráficas y las
solicitudes en proceso. Todo está correcto, pero los tres bloques tienen
un peso visual parecido, así que no queda claro por dónde empezar a leer.

## Por qué es un problema

En el E1 documentamos que Lorena necesita responder consultas de jefatura
de forma inmediata. Si tiene que buscar el dato entre tres bloques que se
ven igual de importantes, pierde tiempo justo cuando no lo tiene.

La heurística 8 lo plantea así: ¿el tablero muestra lo que sirve para
decidir, o todo lo que existe?

Hay además un riesgo concreto. El tablero muestra dos indicadores que se
parecen pero miden cosas distintas:

| Indicador | Valor | Qué mide |
|:---|---:|:---|
| Cartera en **mora** | 21.75 % | Quién no pagó a tiempo |
| Cartera en **riesgo** | 7.00 % | Quién probablemente no pague |

Si los dos se ven igual y no están bien rotulados, la gerencia puede leer
el número equivocado en una reunión. El enunciado dice que esa confusión es
un hallazgo de **severidad 4**. Por eso conviene arreglar la jerarquía
ahora, mientras todavía es cosmético.

## Corrección propuesta

Aplicar en el diseño la jerarquía que ya definimos en el E2:

1. **Primero** los indicadores, con el mayor tamaño. Las tarjetas de mora y
   de riesgo deben ir **separadas y con su etiqueta visible**, no una junto
   a la otra con solo el porcentaje.
2. **Después** las gráficas de tendencia, más pequeñas.
3. **Al final** los listados y las solicitudes en proceso.

No se trata de quitar información, sino de que lo secundario deje de
competir con lo que la gerencia mira primero.

---

## Documento consolidado

El detalle de los ocho hallazgos, la escala de severidad y la auditoría
WCAG 2.2 están en
[`evaluacion-heuristica-y-accesibilidad.md`](evaluacion-heuristica-y-accesibilidad.md).
