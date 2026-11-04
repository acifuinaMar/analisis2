import { ErrorRepositorio } from "../dominio/repositorio-cartera";
import { ErrorConsulta } from "../servicios/consultas-cartera";

/**
 * Convencion uniforme de errores de la API (E1/E3).
 *
 * Todo error 4xx/5xx sale con el MISMO cuerpo:
 *
 *   { "error": true, "codigo": "MONTO_NO_EXACTO", "mensaje": "...",
 *     "detalle": { ... } }
 *
 * Es la misma forma que ya devuelve el servidor MCP (aErrorHerramienta):
 * el tablero, el chat y el asistente reaccionan a un `codigo` estable y
 * leen datos de `detalle` —p. ej. el monto correcto— en vez de parsear
 * el texto.
 */
export interface CuerpoError {
    readonly error: true;
    readonly codigo: string;
    readonly mensaje: string;
    readonly detalle?: Record<string, unknown>;
}

export class ErrorHttp extends Error {

    constructor(
        public readonly estado: number,
        public readonly codigo: string,
        mensaje: string,
        public readonly detalle?: Record<string, unknown>
    ) {
        super(mensaje);
        this.name = "ErrorHttp";
    }
}

/**
 * Codigo de dominio -> estado HTTP.
 *
 *  400  entrada mal formada o fuera de los limites del producto
 *  404  el recurso pedido en la URL no existe
 *  409  la operacion choca con el estado actual (duplicado, ya pagada)
 *  422  la peticion es valida pero la regla de negocio la rechaza
 */
const ESTADO_POR_CODIGO: Readonly<Record<string, number>> = {
    // 404
    CREDITO_INEXISTENTE: 404,
    CUOTA_INEXISTENTE: 404,
    // 409
    CUOTA_YA_PAGADA: 409,
    CREDITO_INCOBRABLE: 409,
    CLIENTE_DUPLICADO: 409,
    DPI_DUPLICADO: 409,
    CREDITO_DUPLICADO: 409,
    // 422
    MONTO_NO_EXACTO: 422,
    CLIENTE_INEXISTENTE: 422,
    ASESOR_INEXISTENTE: 422,
    // 400
    PERIODO_INVALIDO: 400,
    VENTANA_INVALIDA: 400,
    FECHA_INVALIDA: 400,
    CAPITAL_FUERA_DE_RANGO: 400,
    PLAZO_FUERA_DE_RANGO: 400,
    TASA_INVALIDA: 400,
    DATOS_INVALIDOS: 400
};

export function aCuerpoError(error: unknown): { estado: number; cuerpo: CuerpoError } {

    if (error instanceof ErrorHttp) {
        return {
            estado: error.estado,
            cuerpo: {
                error: true,
                codigo: error.codigo,
                mensaje: error.message,
                ...(error.detalle ? { detalle: error.detalle } : {})
            }
        };
    }

    if (error instanceof ErrorConsulta || error instanceof ErrorRepositorio) {

        const detalle = error instanceof ErrorConsulta ? error.detalle : undefined;

        return {
            // Un codigo nuevo sin mapear es un fallo de la regla, no del
            // cliente: 422 es mas honesto que 500.
            estado: ESTADO_POR_CODIGO[error.codigo] ?? 422,
            cuerpo: {
                error: true,
                codigo: error.codigo,
                mensaje: error.message,
                ...(detalle ? { detalle } : {})
            }
        };
    }

    // Errores de body-parser (JSON malformado, cuerpo demasiado grande).
    const tipo = (error as { type?: string } | null)?.type;

    if (tipo === "entity.parse.failed") {
        return {
            estado: 400,
            cuerpo: { error: true, codigo: "JSON_INVALIDO", mensaje: "El cuerpo de la peticion no es JSON valido." }
        };
    }

    if (tipo === "entity.too.large") {
        return {
            estado: 413,
            cuerpo: { error: true, codigo: "CUERPO_DEMASIADO_GRANDE", mensaje: "El cuerpo de la peticion es demasiado grande." }
        };
    }

    // Nunca se filtra el mensaje interno (puede traer SQL o rutas).
    return {
        estado: 500,
        cuerpo: { error: true, codigo: "ERROR_INTERNO", mensaje: "Ocurrio un error interno." }
    };
}
