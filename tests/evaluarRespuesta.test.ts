
import { describe, expect, it } from "vitest";
import { evaluarRespuesta } from "../src/rag/evaluarRespuesta";

describe("Evaluación de respuestas del RAG", () => {
  const permitidos = [
    "POL-2024-01-chunk-1",
    "POL-2024-01-chunk-2",
  ];

  it("acepta una respuesta con una cita recuperada", () => {
    const resultado = evaluarRespuesta(
      "La tasa es del 24 % (POL-2024-01-chunk-1).",
      permitidos
    );

    expect(resultado.aceptada).toBe(true);
    expect(resultado.citasValidas).toEqual([
      "POL-2024-01-chunk-1",
    ]);
    expect(resultado.citasInvalidas).toEqual([]);
  });

  it("rechaza una respuesta vacía", () => {
    const resultado = evaluarRespuesta("   ", permitidos);

    expect(resultado.aceptada).toBe(false);
    expect(resultado.motivo).toBe("La respuesta está vacía.");
  });

  it("rechaza una respuesta sin citas", () => {
    const resultado = evaluarRespuesta(
      "La tasa de mora es del 24 %.",
      permitidos
    );

    expect(resultado.aceptada).toBe(false);
    expect(resultado.motivo).toBe(
      "La respuesta no contiene citas verificables."
    );
  });

  it("rechaza una respuesta con citas inventadas", () => {
    const resultado = evaluarRespuesta(
      "La tasa es del 99 % (POL-FALSA-99-chunk-1).",
      permitidos
    );

    expect(resultado.aceptada).toBe(false);
    expect(resultado.citasInvalidas).toEqual([
      "POL-FALSA-99-chunk-1",
    ]);
  });

  it("rechaza una mezcla de citas válidas e inventadas", () => {
    const resultado = evaluarRespuesta(
      "Ver POL-2024-01-chunk-1 y POL-FALSA-99-chunk-1.",
      permitidos
    );

    expect(resultado.aceptada).toBe(false);
    expect(resultado.citasValidas).toEqual([
      "POL-2024-01-chunk-1",
    ]);
    expect(resultado.citasInvalidas).toEqual([
      "POL-FALSA-99-chunk-1",
    ]);
  });

  it("acepta múltiples citas recuperadas", () => {
    const resultado = evaluarRespuesta(
      "Ver POL-2024-01-chunk-1 y POL-2024-01-chunk-2.",
      permitidos
    );

    expect(resultado.aceptada).toBe(true);
    expect(resultado.citasValidas).toHaveLength(2);
  });
});
