import type {
    ClienteRegistrado,
    CreditoRegistrado,
    RepositorioCartera
} from "../dominio/repositorio-cartera";

/**
 * Búsqueda de clientes para el cobro en campo (E1 · "Buscar cliente" y
 * "Registro de pago").
 *
 * Es de SOLO LECTURA y no toca ninguna cifra: encuentra al cliente y dice
 * qué créditos tiene. El estado y el saldo de cada crédito los sigue
 * dando ConsultasCartera (GET /api/creditos/:id), que es la única fuente.
 *
 * Usa dos métodos que el puerto ya tenía (listarClientes y
 * listarCreditos), así que funciona igual con el adaptador CSV y con el
 * de PostgreSQL sin cambiar el contrato RepositorioCartera ni el esquema.
 * El filtro corre en el SERVIDOR: al navegador solo llega el resultado.
 *
 * Límite conocido: cada búsqueda lee la tabla de clientes completa en el
 * servidor. Para la cartera del proyecto (decenas de clientes) es
 * suficiente; si creciera, lo indicado sería un buscarClientes() en el
 * puerto con ILIKE en PostgreSQL.
 *
 * Privacidad: la respuesta no lleva teléfono, fecha de alta ni el DPI
 * completo; del DPI solo viajan los cuatro últimos caracteres, para que el
 * asesor confirme que eligió a la persona correcta.
 */

/** Máximo de resultados por búsqueda: la lista es para elegir, no para recorrer la cartera. */
export const LIMITE_RESULTADOS = 20;

/** Con menos caracteres, un fragmento de DPI coincidiría con media cartera. */
const MINIMO_PARA_DPI = 4;

export interface CreditoDelCliente {
    readonly idCredito: string;
}

export interface ClienteEncontrado {
    readonly idCliente: string;
    readonly nombreCompleto: string;
    readonly municipio: string;
    /** Últimos cuatro caracteres del DPI; nunca el documento completo. */
    readonly dpiTerminacion: string;
    readonly creditos: ReadonlyArray<CreditoDelCliente>;
}

export interface ResultadoBusquedaClientes {
    readonly buscar: string;
    /** Cuántos clientes coinciden en total, antes del límite. */
    readonly total: number;
    /** Verdadero cuando hubo más coincidencias que LIMITE_RESULTADOS. */
    readonly truncado: boolean;
    readonly resultados: ReadonlyArray<ClienteEncontrado>;
}

/** Minúsculas y sin tildes: "Batz Castillo" coincide con "batz castillo". */
function normalizar(texto: string): string {
    return texto
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim();
}

/** Solo letras y dígitos: "DPI-FICT-000030" y "000030" se comparan igual. */
function compactar(texto: string): string {
    return normalizar(texto).replace(/[^a-z0-9]/g, "");
}

/** Orden estable e independiente del idioma (como COLLATE "C"). */
function compararIds(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

export class DirectorioClientes {

    constructor(
        private readonly repositorio: RepositorioCartera,
        private readonly limite: number = LIMITE_RESULTADOS
    ) {}

    /**
     * Coincide si el texto aparece en:
     *   - el nombre completo (todas las palabras, sin importar tildes),
     *   - el identificador del cliente (CL-0030),
     *   - el DPI (con al menos 4 caracteres),
     *   - el identificador de uno de sus créditos (CV-2026-0043).
     */
    public async buscar(texto: string): Promise<ResultadoBusquedaClientes> {

        const buscar = texto.trim();
        const palabras = normalizar(buscar).split(/\s+/).filter(Boolean);
        const compacto = compactar(buscar);

        const [clientes, creditos] = await Promise.all([
            this.repositorio.listarClientes(),
            this.repositorio.listarCreditos()
        ]);

        const creditosPorCliente = new Map<string, CreditoRegistrado[]>();
        for (const credito of creditos) {
            const lista = creditosPorCliente.get(credito.idCliente);
            if (lista) {
                lista.push(credito);
            } else {
                creditosPorCliente.set(credito.idCliente, [credito]);
            }
        }

        const coincide = (cliente: ClienteRegistrado): boolean => {
            if (palabras.length === 0 || compacto.length === 0) {
                return false;
            }

            const nombre = normalizar(cliente.nombreCompleto);
            if (palabras.every(p => nombre.includes(p))) {
                return true;
            }

            if (compactar(cliente.idCliente).includes(compacto)) {
                return true;
            }

            if (compacto.length >= MINIMO_PARA_DPI && compactar(cliente.dpi).includes(compacto)) {
                return true;
            }

            return (creditosPorCliente.get(cliente.idCliente) ?? [])
                .some(c => compactar(c.idCredito).includes(compacto));
        };

        const encontrados = clientes
            .filter(coincide)
            .sort((a, b) => compararIds(a.idCliente, b.idCliente));

        const resultados = encontrados.slice(0, this.limite).map(cliente => ({
            idCliente: cliente.idCliente,
            nombreCompleto: cliente.nombreCompleto,
            municipio: cliente.municipio,
            dpiTerminacion: cliente.dpi.slice(-4),
            creditos: (creditosPorCliente.get(cliente.idCliente) ?? [])
                .map(c => c.idCredito)
                .sort(compararIds)
                .map(idCredito => ({ idCredito }))
        }));

        return {
            buscar,
            total: encontrados.length,
            truncado: encontrados.length > resultados.length,
            resultados
        };
    }
}
