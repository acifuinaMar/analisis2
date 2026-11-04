
import { buscarFragmentos } from "./buscarFragmentos";
import { cerrarPool } from "./conexionBD";

async function main(): Promise<void> {
  const pregunta =
    "¿Cómo se calcula el interés moratorio de un crédito otorgado en agosto de 2026?";

  console.log("Pregunta:", pregunta);
  console.log("\nBuscando documentos relevantes...\n");

  const resultados = await buscarFragmentos(pregunta, 5);

  for (const [indice, resultado] of resultados.entries()) {
    console.log(`Resultado ${indice + 1}`);
    console.log(`Fuente: ${resultado.fuente}`);
    console.log(`Fragmento: ${resultado.id}`);
    console.log(`Similitud: ${resultado.similitud.toFixed(4)}`);
    console.log(`Contenido: ${resultado.contenido.slice(0, 300)}...`);
    console.log("--------------------------------");
  }
}

main()
  .catch((error: unknown) => {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await cerrarPool();
  });
