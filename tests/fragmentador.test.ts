
import { describe, expect, it } from "vitest";
import { fragmentarDocumentos } from "../src/rag/fragmentador";
import type { DocumentoCorpus } from "../src/rag/lectorCorpus";

const documentos: DocumentoCorpus[] = [
  {
    id: "POL-PRUEBA",
    fuente: "corpus/POL-PRUEBA.md",
    contenido: "A".repeat(2200),
  },
];

describe("RAG - Fragmentador", () => {
  it("divide documentos largos en fragmentos", () => {
    const fragmentos = fragmentarDocumentos(documentos);

    expect(fragmentos).toHaveLength(3);
    expect(fragmentos.every((f) => f.contenido.length <= 1000)).toBe(true);
  });

  it("conserva la fuente documental", () => {
    const fragmentos = fragmentarDocumentos(documentos);

    expect(fragmentos[0].documentoId).toBe("POL-PRUEBA");
    expect(fragmentos[0].fuente).toBe("corpus/POL-PRUEBA.md");
  });

  it("mantiene el solapamiento entre fragmentos", () => {
    const fragmentos = fragmentarDocumentos(documentos);

    expect(fragmentos[0].contenido.slice(-150)).toBe(
      fragmentos[1].contenido.slice(0, 150)
    );
  });

  it("rechaza configuraciones inválidas", () => {
    expect(() =>
      fragmentarDocumentos(documentos, {
        tamano: 100,
        solapamiento: 100,
      })
    ).toThrow();
  });
});
