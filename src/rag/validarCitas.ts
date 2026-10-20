
export interface ResultadoValidacionCitas {
  validas: string[];
  invalidas: string[];
  sinCitas: boolean;
}

export function validarCitas(
  respuesta: string,
  idsPermitidos: string[]
): ResultadoValidacionCitas {
  const permitidos = new Set(idsPermitidos);

  const patron =
    /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-chunk-\d+\b/g;

  const citasEncontradas = [
    ...new Set(respuesta.match(patron) ?? []),
  ];

  const validas = citasEncontradas.filter((id) =>
    permitidos.has(id)
  );

  const invalidas = citasEncontradas.filter(
    (id) => !permitidos.has(id)
  );

  return {
    validas,
    invalidas,
    sinCitas: citasEncontradas.length === 0,
  };
}
