/**
 * Lectura de los errores del SDK de Gemini (@google/genai).
 *
 * El SDK lanza `ApiError` con `status` = codigo HTTP y, en `message`, el
 * cuerpo JSON del servidor ({"error":{"code":503,...,"status":"UNAVAILABLE"}}).
 * Se lee el codigo por forma y no con `instanceof ApiError`: el paquete
 * trae una version ESM y otra CJS, y si las dos llegan a cargarse, la
 * clase de una no es la de la otra y `instanceof` falla en silencio.
 */

/** Codigo HTTP de un error del SDK, o undefined si no es un error HTTP. */
export function estadoHttpGemini(error: unknown): number | undefined {

    if (typeof error !== "object" || error === null) {
        return undefined;
    }

    const estado = Number((error as { status?: unknown }).status);

    return Number.isInteger(estado) && estado >= 400 && estado < 600
        ? estado
        : undefined;
}

/**
 * Errores temporales de DISPONIBILIDAD del servicio: 503 (sobrecarga) y
 * 504 (el servidor no termino a tiempo). Son los que vale la pena volver
 * a intentar en un momento.
 */
export function esErrorGeminiSaturado(error: unknown): boolean {
    const estado = estadoHttpGemini(error);
    return estado === 503 || estado === 504;
}
