
import { GoogleGenAI } from "@google/genai";

export const MODELO_EMBEDDINGS = "gemini-embedding-001";

export type TipoEmbedding =
  | "RETRIEVAL_DOCUMENT"
  | "RETRIEVAL_QUERY";

export async function generarEmbedding(
  texto: string,
  tipo: TipoEmbedding = "RETRIEVAL_DOCUMENT"
): Promise<number[]> {
  if (!texto.trim()) {
    throw new Error(
      "No se puede generar un embedding de texto vacío."
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Falta configurar GEMINI_API_KEY.");
  }

  const cliente = new GoogleGenAI({ apiKey });

  const respuesta = await cliente.models.embedContent({
    model: MODELO_EMBEDDINGS,
    contents: texto,
    config: {
      taskType: tipo,
      outputDimensionality: 768,
    },
  });

  const valores = respuesta.embeddings?.[0]?.values;

  if (!valores?.length) {
    throw new Error("Gemini no devolvió un embedding válido.");
  }

  if (valores.length !== 768) {
    throw new Error(
      `Dimensión inesperada: ${valores.length}`
    );
  }

  if (valores.some((valor) => !Number.isFinite(valor))) {
    throw new Error(
      "El embedding contiene valores no válidos."
    );
  }

  return valores;
}
