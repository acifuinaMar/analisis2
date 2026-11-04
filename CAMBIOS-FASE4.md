# Crédito Vecino · Fase 4: cierre funcional y preparación para la entrega

Base: rama `feature/e1-react-mar`, commit `6ce00df`. Sin commits, push, merge, rebase ni cambio de rama.
Todos los cambios están dentro de `web/`. No se tocaron `src/`, `tests/`, la base de datos, las
migraciones, las políticas ni el núcleo. `.env` no se abrió ni se incluye.

## Cómo integrar

1. Descomprimir `fase4-cierre.zip` en la raíz del repositorio (`analisis2/`). Las rutas son relativas
   (`web/...`) y reemplazan los archivos existentes.
2. **Eliminar a mano** estos dos archivos (un ZIP no puede borrar):
   - `web/src/paginas/PantallaPendiente.tsx`
   - `web/src/paginas/gerencia/PantallasGerencia.tsx`

   En Git: `git rm web/src/paginas/PantallaPendiente.tsx web/src/paginas/gerencia/PantallasGerencia.tsx`
3. Verificar en Windows, desde la raíz:
   `npm run tipos`, `npm test`, `npm --prefix web run build`, `npm --prefix web test`.

## Archivos creados

| Archivo | Contenido |
|---|---|
| `web/src/api/gerencia.ts` | `obtenerCartera`, `listarCreditosEnMora`, `obtenerCierreDiario`, `obtenerCierreMensual` y los tramos válidos del filtro |
| `web/src/paginas/gerencia/Tablero.tsx` | Tablero G-1: indicadores, candidatos a incobrable, riesgo por categoría (barras + tabla) |
| `web/src/paginas/gerencia/CarteraEnMora.tsx` | Cartera en mora G-4 con pestañas por tramo |
| `web/src/paginas/gerencia/Cierre.tsx` | Cierre diario G-3 y mensual G-2 con selector de mes |
| `web/src/paginas/gerencia/DetalleGerencia.tsx` | Detalle, mora y plan para gerencia (reutiliza las pantallas del asesor) |
| `web/pruebas/gerencia.prueba.ts` | 22 pruebas de gerencia, asistente, perfiles y pantallas |

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `web/src/app/rutas.tsx` | Rutas nuevas `/gerencia/creditos/:id/mora` y `/plan`; migas; páginas reales de gerencia |
| `web/src/layouts/LayoutGerencia.tsx` | El detalle de un crédito resalta «Cartera en mora» en el menú |
| `web/src/paginas/asesor/CobroEnCampo.tsx` | `usePerfilCredito()`: enlaces bajo el perfil; sin «Registrar pago» para gerencia; plural «cuota(s) vencida(s)» corregido |
| `web/src/paginas/asesor/PlanAmortizacion.tsx` | Mismos enlaces por perfil |
| `web/src/chat/PanelAsistente.tsx` | Estado informativo honesto (D1): sin campo de texto ni respuestas simuladas; instrucciones de consola |
| `web/src/api/contratos.ts` | Tipos reales `EstadoCartera`, `FilaRiesgo`, `ListadoCreditosEnMora`, `CreditoEnMora`, `Cierre`, `RecuperacionesPorConcepto` (`import type` de `src/`) |
| `web/src/utilidades/etiquetas.ts` | `etiquetaCategoriaRiesgo`, `cantidadCreditos`, `cantidadCuotasVencidas` |
| `web/pruebas/apiSimulada.ts` | `/api/cartera`, `/api/cartera/mora`, `/api/cierres/*` con forma real, perfil, vacío, error y demora |
| `web/vite.config.ts` | `server.warmup` para la primera carga en `npm run dev` |
| `web/playwright.config.ts` | Espera de 10 s por aserción y `retries: 0` (no cambia ninguna aserción) |
| `web/README.md` | Funcionalidades finales, rutas, Fase 4, demostración, limitaciones, resultados, trazabilidad |

## Funcionalidades implementadas

- **Tablero (G-1)**, `GET /api/cartera`:
  - cartera activa con su número de créditos;
  - cartera en mora y cartera en riesgo, con el porcentaje del servidor y la explicación de cada una;
  - dado por incobrable;
  - aviso de candidatos a incobrable;
  - riesgo por categoría, con el total del servidor. Cada tramo enlaza a su listado.
- **Cartera en mora (G-4)**, `GET /api/cartera/mora`:
  - filtro por tramo, con el tramo en la URL;
  - cantidad y saldo total del servidor;
  - tabla que abre el detalle del crédito;
  - aviso si el tramo no es válido.
- **Cierres (G-2, G-3)**:
  - el diario usa la fecha de corte del encabezado;
  - el mensual abre en el mes de la fecha de corte y se puede elegir otro (D3);
  - muestra desembolsos, pagos, flujo neto (incluso negativo) y recuperaciones en el orden de la
    prelación, con excedente a capital y el total del servidor.
- **Detalle de gerencia (G-5, G-7)**: solo consulta (D2), bajo `/gerencia`, sin «Registrar pago».
- **Asistente**: estado informativo (D1). No se envía nada ni se simula ninguna respuesta.
- **Estados**:
  - carga, error con «Reintentar» y vacío en todas las consultas nuevas;
  - formato en quetzales;
  - singulares y plurales;
  - sin desplazamiento horizontal en 360 px, tableta y escritorio.

Contratos verificados contra la API real, ejecutada sobre los datos CSV en memoria, antes de usarlos.
Ejemplo: `desglosePorTramo` trae la categoría `reestructurado_al_dia`, que no es un tramo de mora y
por eso no tiene listado.

## Pruebas realizadas

| Prueba | Resultado |
|---|---|
| Playwright, suite completa | **133 de 133** (111 anteriores + 22 nuevas). Tres corridas con la configuración final; antes, con 5 s de espera, tres corridas con 4 trabajadores y dos con 12 |
| Revisión de tipos de `web/` y de la raíz | sin errores |
| Compilación de producción | correcta; la galería `/gerencia/componentes` no se incluye |
| Suite de la raíz | 614 de 615. Falla `ejecutarEvaluaciones`, que usa `vi.hoisted`, una función que el sustituto de Vitest del entorno no tiene (es del entorno, no un error funcional; pasó igual en la Fase 3) |
| Recorrido de gerencia contra la API real (CSV en memoria) | tablero, cartera en mora, detalle, mora y cierres: todas las respuestas 200, ninguna escritura |

Ninguna prueba usó Supabase ni escribió en una base: Playwright usa la API simulada, y el recorrido
real usó el adaptador CSV en memoria.

**No pude ejecutar aquí** `npm --prefix web run build`, `npm --prefix web test` con `npm run dev`
ni `npm test` con Vitest: npm no puede instalar paquetes en este entorno. Los reemplacé por:
- esbuild + Tailwind en lugar de `vite build`;
- un servidor estático con la configuración real de Playwright;
- node:test con el `expect` real de Vitest.

Las fallas intermitentes de tu ejecución en Windows (109/111) no se reprodujeron aquí. La causa
probable es la compilación bajo demanda de `vite dev`; la mitigación (`warmup` y 10 s de espera)
queda por confirmar en su máquina.

## Limitaciones y pendientes que requieren backend

1. **Asistente en la web:** no hay ruta HTTP hacia el orquestador. Haría falta algo como
   `POST /api/asistente` y su aprobación de pagos. Mientras tanto, `npm run chat`.
2. **Búsqueda de clientes para gerencia:** `GET /api/clientes` es solo para el asesor.
3. **Identificar una operación de originación incierta:** haría falta una clave de idempotencia en
   `POST /api/clientes` y `POST /api/creditos`, o más datos en las lecturas.
4. **R3/R4 (evaluar y aprobar solicitudes):** el núcleo no guarda solicitudes.
5. **Fuera de `web/`, para el equipo:** el `README.md` de la raíz todavía dice que el frontend «no
   está implementado» (sección 8). No lo modifiqué.

En la demostración, confirmar un pago o un desembolso escribe en la base que use la API, que puede
ser la de Supabase compartida. Conviene acordarlo con el equipo antes.
