
import { describe, expect, it } from "vitest";
import { cargarCorpus } from "../src/rag/lectorCorpus";
import { fragmentarDocumentos } from "../src/rag/fragmentador";

describe("RAG - Integración del corpus", () => {
  it("carga y fragmenta los siete documentos oficiales", async () => {
    const documentos = await cargarCorpus();
    const fragmentos = fragmentarDocumentos(documentos);

    expect(documentos).toHaveLength(7);
    expect(fragmentos.length).toBeGreaterThanOrEqual(7);

    for (const documento of documentos) {
      const fragmentosDelDocumento = fragmentos.filter(
        (fragmento) => fragmento.documentoId === documento.id
      );

      expect(fragmentosDelDocumento.length).toBeGreaterThan(0);

      expect(
        fragmentosDelDocumento.every(
          (fragmento) =>
            fragmento.fuente === documento.fuente &&
            fragmento.contenido.length > 0
        )
      ).toBe(true);
    }
  });

  it("conserva las fuentes de las políticas", async () => {
    const documentos = await cargarCorpus();
    const fragmentos = fragmentarDocumentos(documentos);

    const fuentes = fragmentos.map(
      (fragmento) => fragmento.fuente
    );

    expect(fuentes).toContain("corpus/POL-2024-01.md");
    expect(fuentes).toContain("corpus/POL-2026-10.md");
  });

  it("genera identificadores únicos para los fragmentos", async () => {
    const documentos = await cargarCorpus();
    const fragmentos = fragmentarDocumentos(documentos);

    const identificadores = fragmentos.map(
      (fragmento) => fragmento.id
    );

    expect(new Set(identificadores).size).toBe(
      identificadores.length
    );
  });
});
