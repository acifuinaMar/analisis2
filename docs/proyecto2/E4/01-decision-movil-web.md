# E4 · Decisión de arquitectura móvil/web

## Las tres opciones sobre la mesa

| | Nativa | Híbrida (React Native / Flutter) | PWA (Progressive Web App) |
|---|---|---|---|
| Instalación | Tienda de apps, requiere señal la primera vez | Tienda de apps, requiere señal la primera vez | Un enlace; "Agregar a pantalla de inicio" sin tienda |
| Actualizaciones | Dependen de que el usuario actualice desde la tienda | Igual que nativa | Instantáneas: se actualiza al abrir, sin fricción para el asesor |
| Trabajo sin conexión | Sí, con esfuerzo de desarrollo propio | Sí, con esfuerzo de desarrollo propio | Sí, vía Service Worker + almacenamiento local — mismo esfuerzo, un solo código |
| Un solo código para móvil y escritorio | No (nativa es una app por plataforma) | Parcial (móvil sí; el tablero gerencial de escritorio necesitaría otro proyecto) | Sí — el mismo React que ya se planea para el Proyecto Final corre en el teléfono de Byron y en el monitor de Lorena |
| Costo de desarrollo dado el equipo (4 personas, 4 semanas en el Proyecto Final) | Alto: dos bases de código si se quiere iOS + Android | Medio-alto: un framework nuevo que el equipo no ha usado en P1 | Bajo: el Proyecto Final ya declara React + Vite + Tailwind (enunciado, sección 14) |

## Decisión

Se adopta **PWA**.

## Por qué, contra el contexto real de cada perfil (no en abstracto)

**Contra el contexto de Byron (asesor de crédito, E1):** Byron usa datos móviles toda la jornada, con "cobertura irregular en varias comunidades que visita", y trabaja "de pie y con una sola mano disponible". Su cita representativa — *"Si tengo que volver, perdí la visita"* — es la que más pesa en esta decisión: el costo de un error de conectividad no es una mala experiencia, es una visita perdida y un cliente que espera otra semana. Una PWA resuelve dos problemas de Byron a la vez que una app nativa no resuelve mejor:

- No depende de que tenga señal para *instalar* la herramienta la primera vez desde una tienda de apps — basta un enlace, y "Agregar a pantalla de inicio" queda disponible incluso si después pierde cobertura.
- El trabajo sin conexión (registrar un pago sin señal, sincronizar al reconectar) se resuelve con las mismas piezas del navegador (Service Worker + almacenamiento local) que una PWA ya trae, sin que el equipo tenga que mantener dos implementaciones distintas de la misma lógica de reintento — una nativa y otra web — con el riesgo de que diverjan.

**Contra el contexto de Lorena (gerencia, E1):** Lorena trabaja en "modalidad híbrida", con "computadora de escritorio con monitor de gran tamaño en la oficina" y también laptop remota. El tablero gerencial no es un caso de "app de escritorio dedicada": es una vista densa de información que Lorena abre y cierra varias veces al día, muchas veces desde el navegador de una laptop distinta a la de la oficina. Una PWA responsiva cubre ese uso sin que el equipo tenga que construir y mantener una segunda interfaz solo para escritorio.

**Contra la continuidad hacia el Proyecto Final (enunciado, sección 14):** el enunciado ya fija que la interfaz se implementa en "React + Vite + Tailwind" y que el chat conversacional se integra "en ese mismo diseño". Elegir nativa o híbrida habría significado diseñar en Figma para una tecnología que el Proyecto Final no va a usar, obligando a rediseñar decisiones de interacción (gestos, navegación) que no se trasladan de un framework móvil nativo a React. La PWA es la única de las tres opciones que es *directamente* lo que el Proyecto Final va a construir — el prototipo de Figma diseña la misma interfaz que después se programa, sin una capa de traducción entre plataformas en medio.

## Lo que se sacrifica, dicho con honestidad

- Una PWA no tiene acceso a todas las capacidades de hardware que sí tiene una app nativa (por ejemplo, notificaciones push son más limitadas en iOS que en Android). Para el alcance de este sistema — captura de datos, consulta de saldos, registro de pagos — ese acceso no se necesita; si en el futuro Crédito Vecino quisiera biometría de huella para autenticar al asesor, esa sería una razón real para reconsiderar esta decisión.
- La app no aparece en las tiendas de aplicaciones, lo que reduce el "descubrimiento" orgánico — irrelevante aquí, porque el sistema es interno de la institución, no una app de cara al público que compite por instalaciones.

## Cómo se verifica esta decisión en la evaluación (rúbrica, sección 10)

Esta decisión debe quedar reflejada en el prototipo de Figma (E3) como *mobile-first*: las pantallas de Byron y Marta (Solicitud de crédito, Detalle del crédito, Registro de pago, Plan de amortización, Detalle de la mora) se diseñan primero para el formato móvil (360–414 px de ancho), y el tablero gerencial y el cierre diario/mensual (pantallas de Lorena) se diseñan primero para escritorio, siguiendo la tabla de la sección E3 del enunciado. La estrategia de cómo el tablero se adapta entre ambos formatos se documenta en `02-estrategia-responsiva.md`.
