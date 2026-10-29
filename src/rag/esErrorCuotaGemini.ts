import { detalleErrorGemini } from "./detalleErrorGemini";

/**
 * Si el error es por cuota agotada (429 / RESOURCE_EXHAUSTED).
 *
 * El codigo puede venir en el primer nivel, anidado bajo `error`, o solo
 * dentro del JSON del mensaje; detalleErrorGemini mira las tres formas,
 * porque mirar solo la primera dejaba el reintento sin dispararse.
 */
export function esErrorCuotaGemini(error: unknown): boolean {

  const { codigos, estados } = detalleErrorGemini(error);

  return (
    codigos.includes(429) ||
    estados.includes("RESOURCE_EXHAUSTED")
  );
}

/**
 * Cuanto se puede esperar antes de que reintentar deje de tener sentido.
 *
 * Dos minutos: alcanza para una cuota por minuto, que es la que se
 * libera sola, y descarta la cuota por dia, que no.
 */
const ESPERA_MAXIMA_RAZONABLE_SEGUNDOS = 120;

/**
 * Si el error es de cuota Y vale la pena esperarla.
 *
 * La diferencia importa. La cuota POR MINUTO se libera sola y
 * reintentar es exactamente lo correcto. La cuota POR DIA no: Gemini
 * responde con una espera sugerida de horas —en la corrida que lo
 * destapo pedia 12578 segundos, tres horas y media— y reintentar cinco
 * veces con espera creciente solo gasta medio minuto por caso para
 * terminar fallando igual.
 *
 * Asi que se mira la espera que el propio error sugiere, y si pide mas
 * de lo razonable se falla de una con el mensaje intacto, que es la
 * informacion que de verdad sirve: dice cual es el tope y a que hora
 * se renueva.
 */
export function esErrorCuotaPasajera(error: unknown): boolean {

  if (!esErrorCuotaGemini(error)) {
    return false;
  }

  const { esperaSugeridaSegundos } = detalleErrorGemini(error);

  return (
    esperaSugeridaSegundos === undefined ||
    esperaSugeridaSegundos <= ESPERA_MAXIMA_RAZONABLE_SEGUNDOS
  );
}
