
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface DocumentoCorpus {
  id: string;
  fuente: string;
  contenido: string;
}

const DOCUMENTOS_ESPERADOS = [
  "FAQ-CLIENTES-01.md",
  "MAN-PRODUCTO-01.md",
  "NOTA-CAMPO-07.md",
  "POL-2024-01.md",
  "POL-2026-10.md",
  "POL-CARTERA-01.md",
  "POL-COBRO-01.md",
] as const;

export async function cargarCorpus(
  directorioDatos: string = process.env.CV_DATA_DIR ?? ""
): Promise<DocumentoCorpus[]> {
  if (!directorioDatos.trim()) {
    throw new Error(
      "Falta configurar CV_DATA_DIR con la ruta del paquete canónico."
    );
  }

  const directorioCorpus = path.join(directorioDatos, "corpus");
  const archivos = await readdir(directorioCorpus);

  const faltantes = DOCUMENTOS_ESPERADOS.filter(
    (nombre) => !archivos.includes(nombre)
  );

  if (faltantes.length > 0) {
    throw new Error(
      `Faltan documentos del corpus: ${faltantes.join(", ")}`
    );
  }

  const documentos: DocumentoCorpus[] = [];

  for (const nombre of DOCUMENTOS_ESPERADOS) {
    const ruta = path.join(directorioCorpus, nombre);
    const contenido = await readFile(ruta, "utf8");

    if (!contenido.trim()) {
      throw new Error(`El documento ${nombre} está vacío.`);
    }

    documentos.push({
      id: path.parse(nombre).name,
      fuente: `corpus/${nombre}`,
      contenido,
    });
  }

  return documentos;
}