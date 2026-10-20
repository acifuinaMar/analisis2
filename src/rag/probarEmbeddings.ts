
import { generarEmbedding } from "./embeddings";

async function main(): Promise<void> {
  const texto =
    "¿Cómo se calcula el interés moratorio de un crédito?";

  console.log("Generando embedding de prueba...");

  const vector = await generarEmbedding(texto);

  console.log("Embedding generado correctamente.");
  console.log("Dimensiones:", vector.length);
  console.log("Primeros 5 valores:", vector.slice(0, 5));
}

main().catch((error: unknown) => {
  console.error(
    "Error al generar embedding:",
    error instanceof Error ? error.message : String(error)
  );

  process.exitCode = 1;
});
