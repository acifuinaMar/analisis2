
import { esErrorCuotaGemini } from "./esErrorCuotaGemini";

export type EstadoLote = "OK" | "ERROR" | "SKIPPED";

export interface ResultadoLote<T = unknown> {
  id: string;
  estado: EstadoLote;
  valor?: T;
  error?: unknown;
  motivo?: string;
}

export async function ejecutarLote<
  TCaso extends { id: string },
  TResultado
>(
  casos: TCaso[],
  ejecutarCaso: (caso: TCaso) => Promise<TResultado>
): Promise<ResultadoLote<TResultado>[]> {
  const resultados: ResultadoLote<TResultado>[] = [];
  let cuotaAgotada = false;

  for (const caso of casos) {
    if (cuotaAgotada) {
      resultados.push({
        id: caso.id,
        estado: "SKIPPED",
        motivo: "Cuota de Gemini agotada en un caso anterior.",
      });

      continue;
    }

    try {
    const valor = await ejecutarCaso(caso);

    resultados.push({
        id: caso.id,
        estado: "OK",
        valor,
    });
    } catch (error: unknown) {
        resultados.push({
            id: caso.id,
            estado: "ERROR",
            error,
            motivo:
            error instanceof Error
                ? error.message
                : "Error durante la ejecución.",
        });

        if (esErrorCuotaGemini(error)) {
            cuotaAgotada = true;
        }
        }
  }

  return resultados;
}
