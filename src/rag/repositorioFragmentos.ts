
import { obtenerPool } from "./conexionBD";
import type { FragmentoCorpus } from "./fragmentador";

export interface FragmentoConEmbedding extends FragmentoCorpus {
  embedding: number[];
}

export async function guardarFragmento(
  fragmento: FragmentoConEmbedding
): Promise<void> {
  if (fragmento.embedding.length !== 768) {
    throw new Error(
      `El fragmento ${fragmento.id} no tiene 768 dimensiones.`
    );
  }

  if (
    fragmento.embedding.some(
      (valor) => !Number.isFinite(valor)
    )
  ) {
    throw new Error(
      `El fragmento ${fragmento.id} contiene valores no válidos.`
    );
  }

  const pool = obtenerPool();

  const vector = `[${fragmento.embedding.join(",")}]`;

  await pool.query(
    `
    INSERT INTO public.rag_fragmentos (
      id,
      documento_id,
      fuente,
      contenido,
      posicion,
      embedding
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6::extensions.vector
    )
    ON CONFLICT (id)
    DO UPDATE SET
      documento_id = EXCLUDED.documento_id,
      fuente = EXCLUDED.fuente,
      contenido = EXCLUDED.contenido,
      posicion = EXCLUDED.posicion,
      embedding = EXCLUDED.embedding
    `,
    [
      fragmento.id,
      fragmento.documentoId,
      fragmento.fuente,
      fragmento.contenido,
      fragmento.posicion,
      vector,
    ]
  );
}

export async function contarFragmentos(): Promise<number> {
  const pool = obtenerPool();

  const resultado = await pool.query<{ total: string }>(
    `
    SELECT COUNT(*)::text AS total
    FROM public.rag_fragmentos
    `
  );

  return Number(resultado.rows[0].total);
}
