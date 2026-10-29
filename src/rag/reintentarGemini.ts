import { detalleErrorGemini } from "./detalleErrorGemini";

export interface OpcionesReintento {
  maxIntentos?: number;
  esperaInicialMs?: number;
  /**
   * Que errores vale la pena reintentar. Por omision solo los
   * transitorios del servidor; quien llama puede ampliarlo —el chat
   * agrega la cuota agotada— sin que haya dos ciclos de reintento en
   * el proyecto.
   */
  esReintentable?: (error: unknown) => boolean;
}

/**
 * Si el error es una falla transitoria del servidor (500, 502, 503, 504).
 *
 * El 503 llega con el estado UNAVAILABLE y el mensaje "this model is
 * currently experiencing high demand": el modelo compartido esta
 * saturado y la siguiente peticion suele pasar.
 */
export function esErrorTemporalGemini(error: unknown): boolean {

  const { codigos, estados } = detalleErrorGemini(error);

  return (
    codigos.some((codigo) => [500, 502, 503, 504].includes(codigo)) ||
    estados.includes("UNAVAILABLE")
  );
}

export async function reintentarGemini<T>(
  operacion: () => Promise<T>,
  opciones: OpcionesReintento = {}
): Promise<T> {
  const {
    maxIntentos = 3,
    esperaInicialMs = 1500,
    esReintentable = esErrorTemporalGemini,
  } = opciones;

  if (!Number.isInteger(maxIntentos) || maxIntentos < 1) {
    throw new Error("maxIntentos debe ser un entero positivo.");
  }

  if (!Number.isFinite(esperaInicialMs) || esperaInicialMs < 0) {
    throw new Error("esperaInicialMs debe ser un número no negativo.");
  }

  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      return await operacion();
    } catch (error: unknown) {
      const puedeReintentar =
        esReintentable(error) && intento < maxIntentos;

      if (!puedeReintentar) {
        throw error;
      }

      const esperaMs = esperaInicialMs * 2 ** (intento - 1);

      console.warn(
        `Gemini devolvió un error pasajero. ` +
        `Reintento ${intento + 1}/${maxIntentos} ` +
        `en ${esperaMs} ms.`
      );

      await new Promise<void>((resolve) =>
        setTimeout(resolve, esperaMs)
      );
    }
  }

  // El ciclo siempre devuelve un resultado o lanza un error.
  throw new Error("Se agotaron los intentos de Gemini.");
}
