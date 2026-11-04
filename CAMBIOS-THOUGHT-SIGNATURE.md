# Chat gerencial: error 400 «missing a thought_signature»

## Causa

Los modelos Gemini 3 (como `gemini-3.5-flash`) devuelven, en la parte de cada llamada a función, una
**thought signature** (`thoughtSignature`). En la siguiente petición hay que reenviar esa misma parte con
su firma; si no, Gemini responde `400 INVALID_ARGUMENT: Function call is missing a thought_signature`.

El adaptador la perdía en dos pasos:
1. `aTurno` leía las llamadas con el atajo `respuesta.functionCalls` del SDK, que devuelve solo `name` y
   `args` y descarta la firma.
2. `aContenidos` rearmaba la llamada en el historial sin firma.

Por eso la primera llamada a `consultar_cartera` funcionaba, pero al enviarle a Gemini el resultado de la
herramienta (con la llamada sin firma en el historial), respondía 400. Como el orquestador deshace la
pregunta fallida, cada intento repetía exactamente lo mismo. Los modelos anteriores (2.x) no exigían la
firma; por eso no aparecía antes.

## Cambios

| Archivo | Cambio |
|---|---|
| `src/asistente/modelo-lenguaje.ts` | `LlamadaHerramienta.firma?`: dato opaco del proveedor que se devuelve tal cual |
| `src/adaptadores/modelo-gemini.ts` | `aTurno` lee las llamadas de `candidates[0].content.parts` y conserva `thoughtSignature`; `aContenidos` la reenvía en la misma parte y en el mismo orden (en llamadas paralelas, solo la primera la trae) |
| `tests/modelo-gemini.test.ts` | 3 pruebas: lectura de la firma, reenvío en el mismo orden y ausencia del campo sin firma |
| `tests/modelo-gemini-errores.test.ts` | 1 prueba con el SDK real: la firma que manda el servidor vuelve en la siguiente petición |

El orquestador no cambia: guarda las llamadas tal como las devuelve el adaptador, así que la firma viaja
sola. No se tocaron permisos, núcleo, Supabase ni `.env`.

## Comprobación

- Gemini simulado con la regla de Gemini 3 (emite la firma y rechaza la llamada que vuelve sin ella):
  - el código anterior reproduce el mismo 400;
  - el corregido responde, también en una segunda pregunta que arrastra la llamada anterior.
- `npm run tipos`: sin errores.
- Pruebas: 678 de 679. La restante, `ejecutarEvaluaciones`, necesita `vi.hoisted`, que el sustituto de
  Vitest de este entorno no tiene; ya fallaba antes.
- Gemini real no es accesible desde el entorno de trabajo: confirmar con `npm run chat`.

## Integración

Descomprimir en la raíz del repositorio. El ZIP incluye también los archivos de la corrección anterior
(503/504 y cierre en Windows), por si todavía no estaban aplicados. No hay archivos que eliminar.
