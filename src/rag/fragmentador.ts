
import type { DocumentoCorpus } from "./lectorCorpus";

export interface FragmentoCorpus {
  id: string;
  documentoId: string;
  fuente: string;
  contenido: string;
  posicion: number;
}

export interface OpcionesFragmentacion {
  tamano?: number;
  solapamiento?: number;
}

/**
 * Divide textos largos sin cortar palabras.
 */

function dividirTextoLargo(
  texto: string,
  tamano: number,
  solapamiento: number
): string[] {
  const fragmentos: string[] = [];
  let inicio = 0;

  while (inicio < texto.length) {
    let fin = Math.min(inicio + tamano, texto.length);

    // Preferir un límite de palabra cuando sea posible.
    if (fin < texto.length) {
      const espacio = texto.lastIndexOf(" ", fin);

      if (espacio > inicio + solapamiento) {
        fin = espacio;
      }
    }

    const fragmento = texto.slice(inicio, fin).trim();

    if (fragmento) {
      fragmentos.push(fragmento);
    }

    if (fin >= texto.length) {
      break;
    }

    // Conservar parte del fragmento anterior.
    const siguienteInicio = Math.max(
      inicio + 1,
      fin - solapamiento
    );

    inicio = siguienteInicio;
  }

  return fragmentos;
}


/**
 * Fragmenta documentos respetando párrafos Markdown.
 */
export function fragmentarDocumentos(
  documentos: DocumentoCorpus[],
  opciones: OpcionesFragmentacion = {}
): FragmentoCorpus[] {
  const tamano = opciones.tamano ?? 1000;
  const solapamiento = opciones.solapamiento ?? 150;

  if (
    !Number.isInteger(tamano) ||
    !Number.isInteger(solapamiento) ||
    tamano <= 0 ||
    solapamiento < 0 ||
    solapamiento >= tamano
  ) {
    throw new Error(
      "La fragmentación requiere tamaño positivo y solapamiento menor que el tamaño."
    );
  }

  const resultado: FragmentoCorpus[] = [];

  for (const documento of documentos) {
    const contenido = documento.contenido.trim();

    // Separar bloques mediante líneas vacías.
    const bloques = contenido
      .split(/\r?\n\s*\r?\n/)
      .map((bloque) => bloque.trim())
      .filter(Boolean);

    const partes: string[] = [];
    let actual = "";

    function guardarActual(): void {
      if (actual.trim()) {
        partes.push(actual.trim());
        actual = "";
      }
    }

    for (const bloque of bloques) {
      if (bloque.length > tamano) {
        guardarActual();

        partes.push(
          ...dividirTextoLargo(
            bloque,
            tamano,
            solapamiento
          )
        );

        continue;
      }

      const candidato = actual
        ? `${actual}\n\n${bloque}`
        : bloque;

      if (candidato.length > tamano) {
        guardarActual();
        actual = bloque;
      } else {
        actual = candidato;
      }
    }

    guardarActual();

    partes.forEach((texto, indice) => {
      resultado.push({
        id: `${documento.id}-chunk-${indice + 1}`,
        documentoId: documento.id,
        fuente: documento.fuente,
        contenido: texto,
        posicion: indice,
      });
    });
  }

  return resultado;
}
