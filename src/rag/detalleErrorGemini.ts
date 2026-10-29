/**
 * Saca los codigos y estados de un error de Gemini, donde sea que vengan.
 *
 * Existe porque el SDK no entrega una sola forma. Segun por donde falle,
 * el mismo 503 llega como `{ code: 503 }`, como
 * `{ error: { code: 503, status: "UNAVAILABLE" } }`, o unicamente como
 * ese JSON dentro de `message`. Un predicado que mire solo el primer
 * nivel da `false` para los otros dos, y entonces el reintento no se
 * dispara nunca: es lo que pasaba, y por eso una sobrecarga pasajera del
 * modelo se contaba como falla del asistente.
 *
 * Mirar las tres formas es mas feo que confiar en una, pero el que
 * decide la forma es el proveedor y no nosotros.
 */

interface FormaError {
  code?: number | string;
  status?: number | string;
  message?: string;
  error?: { code?: number | string; status?: number | string };
}

export interface DetalleErrorGemini {
  readonly codigos: ReadonlyArray<number>;
  readonly estados: ReadonlyArray<string>;
}

export function detalleErrorGemini(error: unknown): DetalleErrorGemini {

  if (typeof error !== "object" || error === null) {
    return { codigos: [], estados: [] };
  }

  const detalle = error as FormaError;

  const codigos: number[] = [];
  const estados: string[] = [];

  const agregar = (
    code: number | string | undefined,
    status: number | string | undefined
  ): void => {
    for (const valor of [code, status]) {
      const numero = Number(valor);
      if (Number.isFinite(numero) && numero !== 0) {
        codigos.push(numero);
      }
    }
    const texto = String(status ?? "").toUpperCase();
    if (texto) {
      estados.push(texto);
    }
  };

  agregar(detalle.code, detalle.status);
  agregar(detalle.error?.code, detalle.error?.status);

  // El mensaje suele traer el JSON completo del error. Se lee como
  // ultimo recurso, y si no es JSON se deja pasar sin romper nada.
  if (typeof detalle.message === "string") {
    try {
      const comoJson = JSON.parse(detalle.message) as FormaError;
      agregar(comoJson.code, comoJson.status);
      agregar(comoJson.error?.code, comoJson.error?.status);
    } catch {
      // No era JSON: el mensaje en texto plano no aporta codigos.
    }
  }

  return { codigos, estados };
}
