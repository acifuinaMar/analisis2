
export function esErrorCuotaGemini(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const detalle = error as {
    code?: number | string;
    status?: number | string;
    message?: string;
  };

  // El SDK puede devolver el código HTTP como número
  // o el estado textual RESOURCE_EXHAUSTED.
  const codigo = Number(detalle.code);
  const estado = String(detalle.status ?? "").toUpperCase();

  return (
    codigo === 429 ||
    Number(detalle.status) === 429 ||
    estado === "RESOURCE_EXHAUSTED"
  );
}
