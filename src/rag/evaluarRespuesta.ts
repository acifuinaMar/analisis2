
import { validarCitas } from "./validarCitas";

export interface EvaluacionRespuesta {
  aceptada: boolean;
  motivo: string;
  citasValidas: string[];
  citasInvalidas: string[];
}

export function evaluarRespuesta(
  respuesta: string,
  idsPermitidos: string[]
): EvaluacionRespuesta {
  if (!respuesta.trim()) {
    return {
      aceptada: false,
      motivo: "La respuesta está vacía.",
      citasValidas: [],
      citasInvalidas: [],
    };
  }

  const validacion = validarCitas(
    respuesta,
    idsPermitidos
  );

  if (validacion.sinCitas) {
    return {
      aceptada: false,
      motivo: "La respuesta no contiene citas verificables.",
      citasValidas: [],
      citasInvalidas: [],
    };
  }

  if (validacion.invalidas.length > 0) {
    return {
      aceptada: false,
      motivo: "La respuesta contiene citas no recuperadas.",
      citasValidas: validacion.validas,
      citasInvalidas: validacion.invalidas,
    };
  }

  return {
    aceptada: true,
    motivo: "Los identificadores citados fueron recuperados.",
    citasValidas: validacion.validas,
    citasInvalidas: [],
  };
}
