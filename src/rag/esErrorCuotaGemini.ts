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
