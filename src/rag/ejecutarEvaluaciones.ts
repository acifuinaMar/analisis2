
import { performance } from "node:perf_hooks";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { responderPregunta } from "./responderPregunta";
import { cerrarPool } from "./conexionBD";
import { CASOS_RAG } from "./casosRAG";
import { validarCitas } from "./validarCitas";
import { esErrorCuotaGemini } from "./esErrorCuotaGemini";

type EstadoEvaluacion = "PASS" | "FAIL" | "ERROR" | "SKIPPED";

interface ResultadoCaso {
  id: string;
  categoria: string;
  pregunta: string;
  estado: EstadoEvaluacion;
  duracionMs: number;
  fuentesRecuperadas: string[];
  citasValidas: string[];
  citasInvalidas: string[];
  respuesta?: string;
  verificaciones?: Record<string, boolean>;
  motivo?: string;
  error?: {
    codigo?: string | number;
    mensaje: string;
  };
}

function describirError(error: unknown): {
  codigo?: string | number;
  mensaje: string;
} {
  if (typeof error !== "object" || error === null) {
    return { mensaje: String(error) };
  }

  const detalle = error as {
    code?: string | number;
    status?: string | number;
    message?: string;
  };

  return {
    codigo: detalle.code ?? detalle.status,
    mensaje: detalle.message ?? "Error desconocido",
  };
}

async function ejecutarEvaluaciones(): Promise<void> {
  const idCaso = process.env.RAG_CASO;

  const casosSeleccionados = idCaso
    ? CASOS_RAG.filter((caso) => caso.id === idCaso)
    : CASOS_RAG;

  if (casosSeleccionados.length === 0) {
    throw new Error(
      `No existe el caso de evaluación: ${idCaso}`
    );
  }

  const fechaInicio = new Date().toISOString();
  const resultados: ResultadoCaso[] = [];
  let cuotaAgotada = false;
  console.log("========================================");
  console.log("EVALUACIONES RAG — CRÉDITO VECINO");
  console.log("========================================");

  for (const caso of casosSeleccionados) {
    if (cuotaAgotada) {
      resultados.push({
        id: caso.id,
        categoria: caso.categoria,
        pregunta: caso.pregunta,
        estado: "SKIPPED",
        duracionMs: 0,
        fuentesRecuperadas: [],
        citasValidas: [],
        citasInvalidas: [],
        motivo: "No ejecutado: cuota de Gemini agotada en un caso anterior.",
      });

      console.log(`\nCaso: ${caso.id} — SKIPPED (cuota agotada)`);
      continue;
    }
    console.log(`\nCaso: ${caso.id}`);
    console.log(`Categoría: ${caso.categoria}`);
    console.log(`Pregunta: ${caso.pregunta}`);

    const inicio = performance.now();

    try {
      const resultado = await responderPregunta(caso.pregunta);
      const duracionMs = Math.round(
        performance.now() - inicio
      );

      const fuentes = resultado.fuentesRecuperadas.map(
        (fuente) => fuente.id
      );

      const validacionCitas = validarCitas(
        resultado.respuesta,
        fuentes
      );

      const citasValidas = validacionCitas.validas;

      const citasEsperadas =
        caso.documentosEsperados.every((documento) =>
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
          fuentes.some((fuente) =>
            fuente.startsWith(`${documento}-chunk-`)
          )
        );

      const respuestaNormalizada =
        resultado.respuesta.toLowerCase();

      const palabrasEncontradas =
        caso.palabrasEsperadas.every((palabra) =>
          respuestaNormalizada.includes(
            palabra.toLowerCase()
          )
        );

      const palabrasProhibidasAusentes =
        caso.palabrasProhibidas.every((palabra) =>
          !respuestaNormalizada.includes(
            palabra.toLowerCase()
          )
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

      const verificaciones = {
        documentosEncontrados,
        citasCorrectas,
        palabrasEncontradas,
        palabrasProhibidasAusentes,
        reconoceFaltaDeInformacion,
        noInventaTelefono: !contieneTelefono,
      };

      const aprobada = esCasoSinEvidencia
        ? reconoceFaltaDeInformacion && !contieneTelefono
        : documentosEncontrados &&
          palabrasEncontradas &&
          palabrasProhibidasAusentes &&
          citasCorrectas;

      const estado: EstadoEvaluacion =
        aprobada ? "PASS" : "FAIL";

      const motivo = aprobada
        ? undefined
        : esCasoSinEvidencia
          ? "No reconoció adecuadamente la falta de evidencia o incluyó un teléfono."
          : "No cumplió una o más verificaciones de documentos, citas o contenido.";

      resultados.push({
        id: caso.id,
        categoria: caso.categoria,
        pregunta: caso.pregunta,
        estado,
        duracionMs,
        fuentesRecuperadas: fuentes,
        citasValidas,
        citasInvalidas: validacionCitas.invalidas,
        respuesta: resultado.respuesta,
        verificaciones,
        motivo,
      });

      console.log(`Tiempo: ${duracionMs} ms`);
      console.log(
        `Fuentes: ${fuentes.join(", ") || "Ninguna"}`
      );
      console.log(
        `Citas válidas: ${citasValidas.join(", ") || "Ninguna"}`
      );
      console.log(
        `Citas inválidas: ${
          validacionCitas.invalidas.join(", ") || "Ninguna"
        }`
      );
      console.log(`Respuesta:\n${resultado.respuesta}`);
      console.log(`Resultado preliminar: ${estado}`);
    } catch (error: unknown) {
      const duracionMs = Math.round(
        performance.now() - inicio
      );

      const detalleError = describirError(error);

      if (esErrorCuotaGemini(error)) {
        cuotaAgotada = true;

        console.warn(
          "Se detectó agotamiento de cuota de Gemini. " +
          "Los siguientes casos no se ejecutarán."
        );
      }

      resultados.push({
        id: caso.id,
        categoria: caso.categoria,
        pregunta: caso.pregunta,
        estado: "ERROR",
        duracionMs,
        fuentesRecuperadas: [],
        citasValidas: [],
        citasInvalidas: [],
        error: detalleError,
      });

      console.error(
        `Error externo o de ejecución en ${caso.id}:`,
        detalleError
      );
    }
  }

  const resumen = {
    aprobadas: resultados.filter(
      (resultado) => resultado.estado === "PASS"
    ).length,
    fallidas: resultados.filter(
      (resultado) => resultado.estado === "FAIL"
    ).length,
    errores: resultados.filter(
      (resultado) => resultado.estado === "ERROR"
    ).length,
    total: resultados.length,
    omitidas: resultados.filter(
      (resultado) => resultado.estado === "SKIPPED"
    ).length,
  };

  const reporte = {
    proyecto: "Crédito Vecino",
    componente: "E6 - Evaluaciones RAG",
    fechaInicio,
    fechaFin: new Date().toISOString(),
    filtroCaso: idCaso ?? null,
    criterio:
      "Evaluación automatizada preliminar basada en citas, documentos y verificaciones de contenido.",
    resumen,
    resultados,
  };

  const directorio = join(
    process.cwd(),
    "reportes",
    "rag"
  );

  await mkdir(directorio, { recursive: true });

  const nombreArchivo =
    `evaluacion-${fechaInicio.replace(/[:.]/g, "-")}` +
    `${idCaso ? `-${idCaso}` : ""}.json`;

  const rutaReporte = join(
    directorio,
    nombreArchivo
  );

  await writeFile(
    rutaReporte,
    JSON.stringify(reporte, null, 2),
    "utf8"
  );

  console.log("\n========================================");
  console.log("RESUMEN DE EVALUACIONES");
  console.log("========================================");
  console.log(`Aprobadas: ${resumen.aprobadas}`);
  console.log(`Fallidas: ${resumen.fallidas}`);
  console.log(`Errores: ${resumen.errores}`);
  console.log(`Total ejecutadas: ${resumen.total}`);
  console.log(`Reporte: ${rutaReporte}`);
  console.log(`Omitidas: ${resumen.omitidas}`);

  if (resumen.fallidas > 0 || resumen.errores > 0) {
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
