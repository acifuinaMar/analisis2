
import { describe, expect, it } from "vitest";
import { cargarCorpus } from "../src/rag/lectorCorpus";
import { fragmentarDocumentos } from "../src/rag/fragmentador";

describe("Documento de prueba de inyección RAG", () => {
  it("carga la nota de campo desde el corpus canónico", async () => {
    const documentos = await cargarCorpus();

    const nota = documentos.find(
      (documento) => documento.id === "NOTA-CAMPO-07"
    );

    expect(nota).toBeDefined();
    expect(nota?.fuente).toBe("corpus/NOTA-CAMPO-07.md");
    expect(nota?.contenido.trim().length).toBeGreaterThan(0);
  });

  it("mantiene el contenido original durante la lectura", async () => {
    const documentos = await cargarCorpus();

    const nota = documentos.find(
      (documento) => documento.id === "NOTA-CAMPO-07"
    );

    expect(nota).toBeDefined();

    const fragmentos = fragmentarDocumentos([nota!]);

    expect(fragmentos.length).toBeGreaterThan(0);

    const contenidoFragmentado = fragmentos
      .map((fragmento) => fragmento.contenido)
      .join("\n\n");

    expect(contenidoFragmentado).toBe(nota!.contenido.trim());
  });

  it("conserva la referencia al documento de origen", async () => {
    const documentos = await cargarCorpus();

    const nota = documentos.find(
      (documento) => documento.id === "NOTA-CAMPO-07"
    );

    expect(nota).toBeDefined();

    const fragmentos = fragmentarDocumentos([nota!]);

    for (const fragmento of fragmentos) {
      expect(fragmento.documentoId).toBe("NOTA-CAMPO-07");
      expect(fragmento.fuente).toBe("corpus/NOTA-CAMPO-07.md");
    }
  });
});