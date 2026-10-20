
export interface OpcionesReintento {
  maxIntentos?: number;
  esperaInicialMs?: number;
}

export function esErrorTemporalGemini(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const detalle = error as {
    status?: number | string;
    code?: number | string;
    message?: string;
  };

  const codigos = [
  Number(detalle.status),
  Number(detalle.code),
];

return codigos.some((codigo) =>
  [500, 502, 503, 504].includes(codigo)
);
}

export async function reintentarGemini<T>(
  operacion: () => Promise<T>,
  opciones: OpcionesReintento = {}
): Promise<T> {
  const {
    maxIntentos = 3,
    esperaInicialMs = 1500,
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
        esErrorTemporalGemini(error) && intento < maxIntentos;

      if (!puedeReintentar) {
        throw error;
      }

      const esperaMs = esperaInicialMs * 2 ** (intento - 1);

      console.warn(
        `Gemini devolvió un error temporal. ` +
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
