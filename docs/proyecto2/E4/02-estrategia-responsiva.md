# E4 · Estrategia responsiva mobile-first

## Punto de partida: dos audiencias, dos prioridades de información

El sistema no tiene un solo "responsive breakpoint" genérico: tiene dos pantallas con jerarquías de información opuestas, porque sus usuarios las abren en circunstancias opuestas (E1, sección "Dispositivo y conectividad"):

- Byron y Marta abren el sistema en el teléfono, de pie, con prisa, muchas veces con una sola mano libre. La jerarquía correcta es *una decisión o un dato a la vez*.
- Lorena abre el tablero gerencial en un monitor grande, sentada, con tiempo para comparar cifras. La jerarquía correcta es *densidad*: varios indicadores visibles al mismo tiempo, para no tener que navegar entre pantallas para comparar cartera en mora contra cartera en riesgo.

Por eso la estrategia no es "diseñar para móvil y estirar a escritorio", sino diseñar cada pantalla **para el formato en el que su usuario principal realmente la usa** (E3 ya asigna formato por pantalla: móvil para las de Byron/Marta, escritorio para las de Lorena) y resolver el caso contrario —Lorena abriendo el tablero desde su celular en una emergencia, o Byron consultando algo desde una tableta— como una transformación controlada, no como el diseño principal.

## El tablero gerencial: qué se transforma entre teléfono y escritorio

| Elemento | Escritorio (diseño principal) | Teléfono (transformación) |
|---|---|---|
| Cartera en mora vs. cartera en riesgo (7.8) | Dos tarjetas lado a lado, cada una con su rótulo explícito y su cifra — nunca superpuestas ni con el mismo color, para evitar el hallazgo de severidad 4 que describe el enunciado (confundir ambos indicadores) | Se apilan verticalmente, pero **nunca se colapsa una dentro de la otra ni se omite el rótulo**: el riesgo de severidad 4 es el mismo o mayor en pantalla chica, donde hay menos espacio para aclarar cuál es cuál |
| Desglose de cartera en riesgo por tramo | Tabla completa de 5 filas (Mora 1 a Vencido + Reestructurado) visible sin scroll | La misma tabla, pero con scroll vertical dentro de un contenedor con altura fija — no se recorta información, se pagina el acceso a ella |
| Desembolsos y recuperaciones del período | Gráficas comparativas una junto a otra | Gráficas apiladas, una por pantalla completa, deslizables |
| Cierre diario/mensual | Vista de auditoría con el detalle de movimientos congelados visible de una vez | Resumen primero (totales), con un botón "ver detalle de movimientos" que expande la lista — se prioriza la respuesta a "¿ya cerró?" sobre el detalle completo |

**Lo que se sacrifica en pantalla pequeña, explícitamente:** la posibilidad de comparar dos indicadores con un solo vistazo sin desplazarse. Es una decisión consciente: Lorena en su escenario principal (oficina, monitor grande) no pierde nada; en el escenario secundario (emergencia desde el celular) prioriza *ver el número correcto y bien rotulado* sobre *verlos todos a la vez* — que es exactamente lo que la sección 7.8 del enunciado exige que nunca se sacrifique, sin importar el tamaño de pantalla.

## Reglas mobile-first para las pantallas de Byron y Marta

- Objetivos táctiles de al menos 24×24 px CSS (WCAG 2.2, criterio 2.5.8, ya exigido en E5) — con margen adicional en los botones de acción primaria (Registrar pago, Confirmar desembolso), porque Byron opera con una sola mano.
- Un solo campo o una sola decisión por "paso" visible en el flujo de registro de pago, para minimizar el tecleo bajo presión de tiempo.
- Contraste alto (mínimo el que exige WCAG 1.4.3) para que las cifras se lean bajo luz solar directa, condición que E1 documenta explícitamente para Byron.
- El plan de amortización y el detalle de la mora, que en escritorio podrían mostrarse como tablas completas, en móvil se muestran fila por fila con navegación (no se comprime una tabla de 12 filas a texto de 8px para que "quepa").

## Cómo se prueba en E5

La auditoría de accesibilidad de E5 debe ejercitar el prototipo en ambos anchos (simulando ~375 px y ~1280 px en Figma), y el criterio "confundir o rotular igual cartera en mora y cartera en riesgo" (penalización de −0.5 pts, sección 10) se revisa específicamente en la versión móvil del tablero, no solo en la de escritorio, porque es donde el espacio reducido hace más fácil cometer ese error de diseño.
