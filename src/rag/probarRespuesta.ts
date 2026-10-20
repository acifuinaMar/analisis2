
import { responderPregunta } from "./responderPregunta";
import { cerrarPool } from "./conexionBD";

async function main(): Promise<void> {
  const pregunta =
    "¿Cómo se calcula el interés moratorio de un crédito otorgado en agosto de 2026? Cita la fuente.";

  console.log("========================================");
  console.log("CRÉDITO VECINO - PRUEBA DEL CHATBOT RAG");
  console.log("========================================");

  console.log("\nPregunta:");
  console.log(pregunta);

  console.log("\nConsultando documentos y generando respuesta...\n");

  const resultado = await responderPregunta(pregunta);

  console.log("RESPUESTA:");
  console.log(resultado.respuesta);

  console.log("\n========================================");
  console.log("FUENTES RECUPERADAS:");
  console.log("========================================");

  for (const fuente of resultado.fuentesRecuperadas) {
    console.log(`Documento: ${fuente.fuente}`);
    console.log(`Fragmento: ${fuente.id}`);
    console.log(`Similitud: ${fuente.similitud.toFixed(4)}`);
    console.log("----------------------------------------");
  }
}

main()
  .catch((error: unknown) => {
    console.error(
      "Error durante la prueba RAG:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await cerrarPool();
  });
