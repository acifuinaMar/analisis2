
import { generarEmbedding } from "./embeddings";
import { obtenerPool } from "./conexionBD";

export interface ResultadoBusqueda {
  id: string;
  documentoId: string;
  fuente: string;
  contenido: string;
  posicion: number;
  similitud: number;
}

interface FilaBusqueda {
  id: string;
  documento_id: string;
  fuente: string;
  contenido: string;
  posicion: number;
  similitud: number;
}

export async function buscarFragmentos(
  pregunta: string,
  limite = 5
): Promise<ResultadoBusqueda[]> {
  if (!pregunta.trim()) {
    throw new Error("La pregunta no puede estar vacía.");
  }

  if (!Number.isInteger(limite) || limite < 1 || limite > 20) {
    throw new Error("El límite debe estar entre 1 y 20.");
  }

  const embedding = await generarEmbedding(
    pregunta,
    "RETRIEVAL_QUERY"
  );

  const vector = `[${embedding.join(",")}]`;

  const resultado = await obtenerPool().query<FilaBusqueda>(
    `
    SELECT *
    FROM public.buscar_fragmentos(
      $1::extensions.vector,
      $2::integer
    )
    `,
    [vector, limite]
  );

  return resultado.rows.map((fila) => ({
    id: fila.id,
    documentoId: fila.documento_id,
    fuente: fila.fuente,
    contenido: fila.contenido,
    posicion: fila.posicion,
    similitud: fila.similitud,
  }));
}
