/**
 * Saca los codigos, estados y espera sugerida de un error de Gemini,
 * donde sea que vengan.
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

interface RetryInfo {
  "@type"?: string;
  retryDelay?: string;
}

interface FormaError {
  code?: number | string;
  status?: number | string;
  message?: string;
  details?: ReadonlyArray<RetryInfo>;
  error?: {
    code?: number | string;
    status?: number | string;
    details?: ReadonlyArray<RetryInfo>;
  };
}

export interface DetalleErrorGemini {
  readonly codigos: ReadonlyArray<number>;
  readonly estados: ReadonlyArray<string>;
  /**
   * Los segundos que el propio error pide esperar, cuando los trae.
   *
   * Gemini los manda en un RetryInfo dentro de `details`, como
   * "12578s". Es la unica forma de distinguir una cuota por minuto,
   * que se libera sola, de una cuota por dia, que no.
   */
  readonly esperaSugeridaSegundos?: number;
}

/** Lee el "12578s" de un RetryInfo. */
function segundosDe(
  details: ReadonlyArray<RetryInfo> | undefined
): number | undefined {

  for (const dato of details ?? []) {
    if (!String(dato["@type"] ?? "").endsWith("RetryInfo")) {
      continue;
    }
    const crudo = String(dato.retryDelay ?? "").replace(/s$/, "");
    const segundos = Number(crudo);
    if (Number.isFinite(segundos) && segundos > 0) {
      return segundos;
    }
  }

  return undefined;
}

export function detalleErrorGemini(error: unknown): DetalleErrorGemini {

  if (typeof error !== "object" || error === null) {
    return { codigos: [], estados: [] };
  }

  const detalle = error as FormaError;

  const codigos: number[] = [];
  const estados: string[] = [];
  const esperas: number[] = [];

  const agregar = (forma: FormaError | undefined): void => {

    if (!forma) {
      return;
    }

    for (const valor of [forma.code, forma.status]) {
      const numero = Number(valor);
      if (Number.isFinite(numero) && numero !== 0) {
        codigos.push(numero);
      }
    }

    const texto = String(forma.status ?? "").toUpperCase();
    if (texto) {
      estados.push(texto);
    }

    const segundos = segundosDe(forma.details);
    if (segundos !== undefined) {
      esperas.push(segundos);
    }
  };

  agregar(detalle);
  agregar(detalle.error);

  // El mensaje suele traer el JSON completo del error. Se lee como
  // ultimo recurso, y si no es JSON se deja pasar sin romper nada.
  if (typeof detalle.message === "string") {
    try {
      const comoJson = JSON.parse(detalle.message) as FormaError;
      agregar(comoJson);
      agregar(comoJson.error);
    } catch {
      // No era JSON: el mensaje en texto plano no aporta codigos.
    }
  }

  return {
    codigos,
    estados,
    ...(esperas.length === 0
      ? {}
      : { esperaSugeridaSegundos: Math.max(...esperas) })
  };
}
