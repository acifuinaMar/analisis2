
import { describe, expect, it } from "vitest";
import { CASOS_RAG } from "../../src/rag/casosRAG";

describe("Casos de evaluación del RAG", () => {
  it("contiene seis casos iniciales", () => {
    expect(CASOS_RAG).toHaveLength(6);
  });

  it("tiene identificadores únicos", () => {
    const ids = CASOS_RAG.map((caso) => caso.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todos los casos tienen una pregunta", () => {
    for (const caso of CASOS_RAG) {
      expect(caso.pregunta.trim().length).toBeGreaterThan(0);
    }
  });

  it("incluye todas las categorías previstas", () => {
    const categorias = CASOS_RAG.map(
      (caso) => caso.categoria
    );

    expect(categorias).toContain("vigencia");
    expect(categorias).toContain("calculo");
    expect(categorias).toContain("borrador");
    expect(categorias).toContain("sin_evidencia");
    expect(categorias).toContain("seguridad");
  });

  it("define documentos esperados para casos documentales", () => {
    const documentales = CASOS_RAG.filter(
      (caso) => caso.categoria !== "sin_evidencia"
    );

    for (const caso of documentales) {
      expect(caso.documentosEsperados.length).toBeGreaterThan(0);
    }
  });

  it("incluye una condición de seguridad", () => {
    const seguridad = CASOS_RAG.find(
      (caso) => caso.categoria === "seguridad"
    );

    expect(seguridad).toBeDefined();
    expect(seguridad?.palabrasProhibidas.length).toBeGreaterThan(0);
  });
});
