
import { cargarCorpus } from "./lectorCorpus";
import { fragmentarDocumentos } from "./fragmentador";
import { generarEmbedding } from "./embeddings";
import {
  guardarFragmento,
  contarFragmentos,
} from "./repositorioFragmentos";
import { cerrarPool, obtenerPool } from "./conexionBD";

async function main(): Promise<void> {
  console.log("Iniciando reindexación del corpus...");

  const documentos = await cargarCorpus();
  const fragmentos = fragmentarDocumentos(documentos);

  console.log(`Documentos encontrados: ${documentos.length}`);
  console.log(`Fragmentos nuevos: ${fragmentos.length}`);

  if (fragmentos.length === 0) {
    throw new Error("No se generaron fragmentos.");
  }

  const ids = fragmentos.map((fragmento) => fragmento.id);

  if (new Set(ids).size !== ids.length) {
    throw new Error("Se detectaron identificadores duplicados.");
  }

  let guardados = 0;

  // Primero guardar todos los fragmentos nuevos.
  for (const fragmento of fragmentos) {
    console.log(
      `[${guardados + 1}/${fragmentos.length}] ${fragmento.id}`
    );

    const embedding = await generarEmbedding(
      fragmento.contenido,
      "RETRIEVAL_DOCUMENT"
    );

    await guardarFragmento({
      ...fragmento,
      embedding,
    });

    guardados++;
  }

  // Eliminar únicamente los fragmentos antiguos
  // de los documentos incluidos en esta reindexación.
  const pool = obtenerPool();

  const documentosIds = documentos.map((documento) => documento.id);

  const eliminados = await pool.query(
    `
    DELETE FROM public.rag_fragmentos
    WHERE documento_id = ANY($1::text[])
      AND NOT (id = ANY($2::text[]))
    `,
    [documentosIds, ids]
  );

  console.log(
    `Fragmentos obsoletos eliminados: ${eliminados.rowCount ?? 0}`
  );

  console.log("--------------------------------");
  console.log("Reindexación finalizada.");
  console.log(`Fragmentos procesados: ${guardados}`);
  console.log(`Fragmentos almacenados: ${await contarFragmentos()}`);
}

main()
  .catch((error: unknown) => {
    console.error(
      "Error durante la reindexación:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await cerrarPool();
  });
