
import {
  describe,
  expect,
  it,
  vi,
  beforeEach,
  afterEach,
} from "vitest";

const mocks = vi.hoisted(() => ({
  responderPregunta: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  cerrarPool: vi.fn(),
}));

vi.mock("../src/rag/responderPregunta", () => ({
  responderPregunta: mocks.responderPregunta,
}));

vi.mock("../src/rag/conexionBD", () => ({
  cerrarPool: mocks.cerrarPool,
}));

vi.mock("node:fs/promises", () => ({
  mkdir: mocks.mkdir,
  writeFile: mocks.writeFile,
}));

import { ejecutarEvaluaciones } from "../src/rag/ejecutarEvaluaciones";
import { CASOS_RAG } from "../src/rag/casosRAG";

describe("E6 - Integración del evaluador RAG", () => {
  const ragCasoOriginal = process.env.RAG_CASO;
  const exitCodeOriginal = process.exitCode;

  beforeEach(() => {
    vi.clearAllMocks();

    delete process.env.RAG_CASO;

    mocks.mkdir.mockResolvedValue(undefined);
    mocks.writeFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (ragCasoOriginal === undefined) {
      delete process.env.RAG_CASO;
    } else {
      process.env.RAG_CASO = ragCasoOriginal;
    }

    process.exitCode = exitCodeOriginal;
  });

  it("registra ERROR y SKIPPED al agotarse la cuota de Gemini", async () => {
    mocks.responderPregunta.mockRejectedValueOnce(
      Object.assign(new Error("Cuota de Gemini agotada"), {
        code: 429,
        status: "RESOURCE_EXHAUSTED",
      })
    );

    await ejecutarEvaluaciones();

    // Solo se intenta ejecutar el primer caso.
    expect(mocks.responderPregunta).toHaveBeenCalledTimes(1);

    // Se genera un reporte JSON.
    expect(mocks.writeFile).toHaveBeenCalledTimes(1);

    const contenido = mocks.writeFile.mock.calls[0][1];
    const reporte = JSON.parse(contenido);

    expect(reporte.resultados).toHaveLength(CASOS_RAG.length);

    expect(reporte.resultados[0].estado).toBe("ERROR");
    expect(reporte.resultados[0].error.codigo).toBe(429);

    for (const resultado of reporte.resultados.slice(1)) {
      expect(resultado.estado).toBe("SKIPPED");
      expect(resultado.duracionMs).toBe(0);
    }

    expect(reporte.resumen.errores).toBe(1);
    expect(reporte.resumen.omitidas).toBe(CASOS_RAG.length - 1);
    expect(reporte.resumen.total).toBe(CASOS_RAG.length);
  });


it("continúa evaluando después de un error 503", async () => {
  mocks.responderPregunta.mockRejectedValue(
    Object.assign(new Error("Servicio no disponible"), {
      code: 503,
    })
  );

  await ejecutarEvaluaciones();

  // Un error 503 no debe detener los demás casos.
  expect(mocks.responderPregunta).toHaveBeenCalledTimes(
    CASOS_RAG.length
  );

  expect(mocks.writeFile).toHaveBeenCalledTimes(1);

  const contenido = mocks.writeFile.mock.calls[0][1];
  const reporte = JSON.parse(contenido);

  expect(reporte.resultados).toHaveLength(CASOS_RAG.length);

  expect(
    reporte.resultados.every(
      (resultado: { estado: string }) =>
        resultado.estado === "ERROR"
    )
  ).toBe(true);

  expect(reporte.resumen.errores).toBe(CASOS_RAG.length);
  expect(reporte.resumen.omitidas).toBe(0);
});


it("registra FAIL cuando la respuesta no cumple los criterios", async () => {
  process.env.RAG_CASO = "G-01";

  mocks.responderPregunta.mockResolvedValueOnce({
    respuesta: "Respuesta sin información verificable.",
    fuentesRecuperadas: [],
  });

  await ejecutarEvaluaciones();

  expect(mocks.responderPregunta).toHaveBeenCalledTimes(1);
  expect(mocks.writeFile).toHaveBeenCalledTimes(1);

  const contenido = mocks.writeFile.mock.calls[0][1];
  const reporte = JSON.parse(contenido);

  expect(reporte.resultados).toHaveLength(1);
  expect(reporte.resultados[0].id).toBe("G-01");
  expect(reporte.resultados[0].estado).toBe("FAIL");
  expect(reporte.resultados[0].citasValidas).toEqual([]);
  expect(reporte.resultados[0].fuentesRecuperadas).toEqual([]);

  expect(reporte.resumen.fallidas).toBe(1);
  expect(reporte.resumen.errores).toBe(0);
  expect(reporte.resumen.omitidas).toBe(0);
});

it("registra PASS cuando reconoce que no tiene evidencia", async () => {
  process.env.RAG_CASO = "G-05";

  mocks.responderPregunta.mockResolvedValueOnce({
    respuesta:
      "No dispongo de información suficiente para proporcionar el teléfono personal solicitado.",
    fuentesRecuperadas: [],
  });

  await ejecutarEvaluaciones();

  expect(mocks.responderPregunta).toHaveBeenCalledTimes(1);
  expect(mocks.writeFile).toHaveBeenCalledTimes(1);

  const contenido = mocks.writeFile.mock.calls[0][1];
  const reporte = JSON.parse(contenido);

  expect(reporte.resultados).toHaveLength(1);
  expect(reporte.resultados[0].id).toBe("G-05");
  expect(reporte.resultados[0].estado).toBe("PASS");

  expect(
    reporte.resultados[0].verificaciones
      .reconoceFaltaDeInformacion
  ).toBe(true);

  expect(
    reporte.resultados[0].verificaciones.noInventaTelefono
  ).toBe(true);

  expect(reporte.resumen.aprobadas).toBe(1);
  expect(reporte.resumen.fallidas).toBe(0);
  expect(reporte.resumen.errores).toBe(0);
  expect(reporte.resumen.omitidas).toBe(0);
});

});
