# E4 · Estrategia ante pérdida de conexión

## El escenario que hay que resolver

Byron registra un pago en campo, sin señal. La PWA debe permitirle completar la visita (E1: *"Si tengo que volver, perdí la visita"*) y sincronizar después, cuando recupere cobertura. Esto abre dos preguntas distintas, y el enunciado (sección E4) es explícito en que ambas ya tienen respuesta en el núcleo del Proyecto 1 — el trabajo de E4 es conectarlas, no inventar una solución nueva.

## Pregunta 1: si la app reintenta el envío al reconectar, ¿cómo evita cobrar dos veces?

**Respuesta, ya resuelta en el diseño del núcleo:** con la clave de idempotencia. El contrato de la API ya la define así (`src/contratos/comun.ts`):

```ts
export const ClaveIdempotenciaEsquema = z.string()
    .uuid("La clave de idempotencia debe ser un UUID v4.")
```

Y el endpoint de registro de pago ya la exige en el encabezado de la petición (`src/contratos/pagos.ts`): la petición **debe** incluir `Idempotency-Key`, y repetirla con la misma clave "nunca cobra dos veces" — invariante 6.10 del Proyecto 1.

**Lo que E4 agrega, del lado de la interfaz:** la PWA genera esa clave (un UUID v4) **en el momento en que Byron pulsa "Registrar pago" en el teléfono**, no cuando la petición finalmente sale al servidor. La clave se guarda junto con el pago en el almacenamiento local del dispositivo (vía Service Worker / IndexedDB), de modo que:

1. Si hay señal, el pago se envía de inmediato con esa clave.
2. Si no hay señal, el pago queda en cola local con esa misma clave, y el servicio de sincronización en segundo plano la reintenta al reconectar.
3. Si Byron cierra la app y la vuelve a abrir antes de que sincronice, la clave sigue siendo la misma — no se genera una nueva por cada intento de envío.
4. Si por cualquier motivo la petición se reintenta dos veces (p. ej. una reconexión inestable que dispara el sync dos veces), el servidor devuelve el mismo resultado que la primera vez, sin duplicar el cobro — eso ya lo garantiza el backend, no la interfaz.

El prototipo de Figma (E3) debe mostrar el estado intermedio de esto: un pago "guardado, pendiente de sincronizar" con un indicador visual distinto al de "sincronizado" — es la respuesta a la heurística 1 de Nielsen (visibilidad del estado del sistema, Anexo B del enunciado): Byron necesita saber si el pago ya salió o sigue en su teléfono.

## Pregunta 2: si el dispositivo calculó la mora con los días de ayer y sincroniza hoy, ¿con qué fecha se calcula?

**Respuesta, ya resuelta en el diseño del núcleo:** con el puerto `Reloj` (`src/dominio/reloj.ts`):

```ts
export interface Reloj {
    /** Fecha de corte con la que debe trabajar el calculo. */
    hoy(): Date;
}
```

El comentario del propio archivo lo dice de forma explícita: *"el núcleo de dominio no debe leer la fecha del sistema [...] la fecha entra siempre desde afuera, a través de este puerto"*. Esto significa que **la fecha de corte no es "el momento en que el teléfono de Byron calculó algo"**, sino un parámetro que el servidor fija al procesar la sincronización — no el reloj interno del dispositivo del asesor.

**Lo que E4 agrega, del lado de la interfaz:** el desglose de mora por tramos y el total adeudado que la PWA le muestra a Byron **mientras está sin señal son una vista informativa, calculada con la última fecha de corte que el dispositivo conoce** (la del último cierre sincronizado) — nunca una cifra que se envía de vuelta al servidor como si fuera autoritativa. Cuando el dispositivo reconecta, el servidor recalcula la mora con su propia fecha de corte (vía `Reloj`, del lado del backend) y esa es la cifra que prevalece; si hubo diferencia con lo que Byron vio en pantalla (por ejemplo, la cuota cruzó de Mora 1 a Mora 2 mientras él estaba sin señal), la PWA se lo muestra al reconectar en vez de aplicar silenciosamente el número viejo.

Esto evita un error concreto y grave: que un asesor sin señal por dos días le cobre a un cliente la mora "congelada" de hace dos días, cuando en realidad ya cruzó a un tramo más caro — o el error inverso, cobrarle de más si el cliente pagó entretanto por otro canal.

## Resumen de la estrategia

| Decisión de interfaz | Sostenida por (Proyecto 1) |
|---|---|
| El pago se guarda localmente con una clave UUID v4 generada al capturarlo, no al enviarlo | `ClaveIdempotenciaEsquema`, encabezado `Idempotency-Key` obligatorio en `POST /creditos/{id}/pagos` |
| La mora que ve Byron sin señal es informativa, no autoritativa; el servidor recalcula al sincronizar | Puerto `Reloj`: la fecha de corte nunca es "la de este dispositivo ahora" |
| El estado "pendiente de sincronizar" es visible en la interfaz, distinto de "sincronizado" | Heurística 1 de Nielsen (Anexo B) — visibilidad del estado del sistema |

Esta tabla es, en sí misma, la evidencia de que "una decisión de experiencia —permitir trabajo sin conexión— solo es viable porque dos decisiones de arquitectura la sostienen" (enunciado, sección E4): si el Proyecto 1 no hubiera sacado la fecha y la idempotencia del núcleo hacia afuera, esta estrategia de E4 no tendría dónde apoyarse.
