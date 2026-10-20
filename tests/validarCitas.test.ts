
import { describe, expect, it } from "vitest";
import { validarCitas } from "../src/rag/validarCitas";

describe("Validación de citas del RAG", () => {
  const permitidos = [
    "POL-2024-01-chunk-1",
    "POL-2024-01-chunk-2",
  ];

  it("acepta una cita recuperada", () => {
    const resultado = validarCitas(
      "La tasa es del 24 % (POL-2024-01-chunk-1).",
      permitidos
    );

    expect(resultado.validas).toEqual([
      "POL-2024-01-chunk-1",
    ]);
    expect(resultado.invalidas).toEqual([]);
    expect(resultado.sinCitas).toBe(false);
  });

  it("detecta una cita inventada", () => {
    const resultado = validarCitas(
      "La tasa es del 99 % (POL-INVENTADA-99-chunk-1).",
      permitidos
    );

    expect(resultado.validas).toEqual([]);
    expect(resultado.invalidas).toEqual([
      "POL-INVENTADA-99-chunk-1",
    ]);
  });

  it("detecta citas válidas e inválidas juntas", () => {
    const resultado = validarCitas(
      "Ver POL-2024-01-chunk-2 y POL-FALSA-01-chunk-3.",
      permitidos
    );

    expect(resultado.validas).toEqual([
      "POL-2024-01-chunk-2",
    ]);
    expect(resultado.invalidas).toEqual([
      "POL-FALSA-01-chunk-3",
    ]);
  });

  it("identifica respuestas sin citas", () => {
    const resultado = validarCitas(
      "El interés se calcula diariamente.",
      permitidos
    );

    expect(resultado.sinCitas).toBe(true);
    expect(resultado.validas).toEqual([]);
    expect(resultado.invalidas).toEqual([]);
  });

  it("evita contar citas duplicadas", () => {
    const resultado = validarCitas(
      "POL-2024-01-chunk-1 y POL-2024-01-chunk-1.",
      permitidos
    );

    expect(resultado.validas).toEqual([
      "POL-2024-01-chunk-1",
    ]);
  });
});
