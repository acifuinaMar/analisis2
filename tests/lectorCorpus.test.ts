
import { describe, expect, it } from "vitest";
import { cargarCorpus } from "../src/rag/lectorCorpus";

describe("RAG - Lector del corpus", () => {
  it("debe cargar los siete documentos oficiales", async () => {
    const documentos = await cargarCorpus();

    expect(documentos).toHaveLength(7);
  });

  it("debe conservar el identificador y la fuente", async () => {
    const documentos = await cargarCorpus();

    const politica = documentos.find(
      (documento) => documento.id === "POL-2024-01"
    );

    expect(politica).toBeDefined();
    expect(politica?.fuente).toBe("corpus/POL-2024-01.md");
    expect(politica?.contenido.trim().length).toBeGreaterThan(0);
  });

  it("debe rechazar una ruta de datos inexistente", async () => {
    await expect(
      cargarCorpus("./directorio-que-no-existe")
    ).rejects.toThrow();
  });
});
