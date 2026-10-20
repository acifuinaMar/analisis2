
import { performance } from "node:perf_hooks";
import { responderPregunta } from "./responderPregunta";
import { cerrarPool } from "./conexionBD";
import { CASOS_RAG } from "./casosRAG";
import { validarCitas } from "./validarCitas";

async function ejecutarEvaluaciones(): Promise<void> {
  console.log("========================================");
  console.log("EVALUACIONES RAG — CRÉDITO VECINO");
  console.log("========================================");

  let exitosas = 0;
  let fallidas = 0;

const idCaso = process.env.RAG_CASO;

const casosSeleccionados = idCaso
  ? CASOS_RAG.filter((caso) => caso.id === idCaso)
  : CASOS_RAG;

if (casosSeleccionados.length === 0) {
  throw new Error(`No existe el caso de evaluación: ${idCaso}`);
}

for (const caso of casosSeleccionados) {
  /*for (const caso of CASOS_RAG) {*/
    console.log(`\nCaso: ${caso.id}`);
    console.log(`Categoría: ${caso.categoria}`);
    console.log(`Pregunta: ${caso.pregunta}`);

    const inicio = performance.now();

    try {
      const resultado = await responderPregunta(caso.pregunta);
      const duracion = Math.round(performance.now() - inicio);

      const fuentes = resultado.fuentesRecuperadas.map(
        (fuente) => fuente.id
      );

      
      const validacionCitas = validarCitas(
        resultado.respuesta,
        fuentes
      );

      const citasValidas = validacionCitas.validas;

      const citasEsperadas = caso.documentosEsperados.every(
        (documento) =>
          citasValidas.some((cita) =>
            cita.startsWith(`${documento}-chunk-`)
          )
      );

      const citasCorrectas =
        !validacionCitas.sinCitas &&
        validacionCitas.invalidas.length === 0 &&
        citasEsperadas;


      const documentosEncontrados =
        caso.documentosEsperados.every((documento) =>
          fuentes.some((fuente) => fuente.startsWith(documento))
        );

      const respuestaNormalizada =
        resultado.respuesta.toLowerCase();

      const palabrasEncontradas =
        caso.palabrasEsperadas.every((palabra) =>
          respuestaNormalizada.includes(palabra.toLowerCase())
        );

      const palabrasProhibidasAusentes =
        caso.palabrasProhibidas.every((palabra) =>
          !respuestaNormalizada.includes(palabra.toLowerCase())
        );

      
      const esCasoSinEvidencia =
        caso.categoria === "sin_evidencia";

      const reconoceFaltaDeInformacion =
        /no (dispongo|tengo|cuento|encontré|encontre|puedo determinar)|no (se encuentra|está disponible|esta disponible)|información insuficiente|no hay información|no consta|no se proporciona/i.test(
          resultado.respuesta
        );

      const contieneTelefono =
        /(?:\+?502[\s-]?)?\d{4}[\s-]?\d{4}/.test(
          resultado.respuesta
        );

      
      const aprobada = esCasoSinEvidencia
        ? reconoceFaltaDeInformacion && !contieneTelefono
        : documentosEncontrados &&
          palabrasEncontradas &&
          palabrasProhibidasAusentes &&
          citasCorrectas;

      console.log(`Tiempo: ${duracion} ms`);
      console.log(`Fuentes: ${fuentes.join(", ") || "Ninguna"}`);
      console.log(
  `Citas válidas: ${citasValidas.join(", ") || "Ninguna"}`
);

console.log(
  `Citas inválidas: ${
    validacionCitas.invalidas.join(", ") || "Ninguna"
  }`
);
      console.log(`Respuesta:\n${resultado.respuesta}`);
      console.log(
        `Resultado preliminar: ${aprobada ? "PASS" : "FAIL"}`
      );

      if (aprobada) {
        exitosas++;
      } else {
        fallidas++;
      }
    } catch (error) {
      fallidas++;
      console.error("Error:", error);
    }
  }

  console.log("\n========================================");
  console.log("RESUMEN DE EVALUACIONES");
  console.log("========================================");
  console.log(`Aprobadas preliminarmente: ${exitosas}`);
  console.log(`Fallidas: ${fallidas}`);
  console.log(`Total: ${CASOS_RAG.length}`);

  if (fallidas > 0) {
    process.exitCode = 1;
  }
}

ejecutarEvaluaciones()
  .catch((error: unknown) => {
    console.error("Error general:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cerrarPool();
  });
