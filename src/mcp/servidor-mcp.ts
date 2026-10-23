import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShape } from "zod";

import { RepositorioCartera } from "../dominio/repositorio-cartera";
import {
    ConsultasCartera,
    ErrorConsulta
} from "../servicios/consultas-cartera";
import {
    ConsultarCreditoEntrada,
    CreditosEnMoraEntrada,
    DeudaDeCuotaEntrada,
    ExplicarMoraEntrada,
    aFechaCorte,
    consultarCreditoForma,
    creditosEnMoraForma,
    deudaDeCuotaForma,
    explicarMoraForma
} from "./esquemas";

/**
 * Servidor MCP sobre los puertos del Proyecto 1 (E3).
 *
 * Expone el nucleo de calculo como herramientas que el asistente puede
 * invocar. La separacion que el enunciado llama "el corazon del
 * proyecto": el modelo decide QUE herramienta llamar y redacta la
 * respuesta; los numeros los pone siempre el nucleo.
 *
 * Tres reglas que gobiernan todas las herramientas:
 *
 *  1. SOLO LECTURA por defecto. Las consultas no piden autorizacion.
 *     La unica accion sensible —registrar un pago— exige aprobacion
 *     humana explicita y se agrega aparte.
 *  2. La FECHA DE CORTE llega como parametro. Ninguna herramienta lee el
 *     reloj del sistema.
 *  3. Errores con CONVENCION UNIFORME: cada fallo trae un codigo estable
 *     contra el que el cliente puede programar.
 */

/** Codigos de error estables. El cliente programa contra estos. */
export const CODIGOS_ERROR = {
    CREDITO_INEXISTENTE: "CREDITO_INEXISTENTE",
    CUOTA_INEXISTENTE: "CUOTA_INEXISTENTE",
    CUOTA_YA_PAGADA: "CUOTA_YA_PAGADA",
    CREDITO_INCOBRABLE: "CREDITO_INCOBRABLE",
    MONTO_NO_EXACTO: "MONTO_NO_EXACTO",
    FECHA_INVALIDA: "FECHA_INVALIDA",
    ERROR_INTERNO: "ERROR_INTERNO"
} as const;

/** Respuesta de error con la forma que el asistente sabe leer. */
export interface ErrorHerramienta {
    readonly error: true;
    readonly codigo: string;
    readonly mensaje: string;
}

/**
 * Traduce cualquier excepcion a la convencion uniforme.
 *
 * El asistente nunca ve una pila de llamadas ni un mensaje de Postgres:
 * ve un codigo y una frase que puede explicarle al gerente.
 */
export function aErrorHerramienta(error: unknown): ErrorHerramienta {

    if (error instanceof ErrorConsulta) {
        return {
            error: true,
            codigo: error.codigo,
            mensaje: error.message
        };
    }

    const mensaje = error instanceof Error ? error.message : String(error);

    if (/no existe en el calendario|formato AAAA-MM-DD/i.test(mensaje)) {
        return {
            error: true,
            codigo: CODIGOS_ERROR.FECHA_INVALIDA,
            mensaje
        };
    }

    return {
        error: true,
        codigo: CODIGOS_ERROR.ERROR_INTERNO,
        mensaje
    };
}

/** Lo que devuelve una herramienta: texto JSON para el asistente. */
interface ContenidoHerramienta {
    readonly content: Array<{ readonly type: "text"; readonly text: string }>;
}

/**
 * Firma con la que se registran las herramientas.
 *
 * El SDK infiere los tipos del manejador a partir del esquema Zod, y con
 * validaciones encadenadas esa inferencia se vuelve tan profunda que
 * TypeScript se rinde (TS2589). En vez de simplificar los esquemas —que
 * son justo lo que el enunciado pide— se ensancha la firma UNA sola vez,
 * aqui, y cada manejador valida su entrada con el esquema completo.
 *
 * El resultado es mas seguro, no menos: la validacion pasa a ocurrir en
 * tiempo de ejecucion, que es cuando llegan los datos del asistente.
 */
type RegistrarHerramienta = (
    nombre: string,
    configuracion: {
        title: string;
        description: string;
        inputSchema: ZodRawShape;
    },
    manejador: (
        argumentos: Record<string, unknown>
    ) => Promise<ContenidoHerramienta>
) => void;

/** Empaqueta cualquier resultado como contenido MCP. */
function comoContenido(valor: unknown): ContenidoHerramienta {
    return {
        content: [
            {
                type: "text" as const,
                text: JSON.stringify(valor, null, 2)
            }
        ]
    };
}

export function crearServidorMcp(
    repositorio: RepositorioCartera
): McpServer {

    const consultas = new ConsultasCartera(repositorio);

    const servidor = new McpServer({
        name: "credito-vecino",
        version: "1.0.0"
    });

    const registrar = servidor.registerTool.bind(
        servidor
    ) as unknown as RegistrarHerramienta;

    // ------------------------------------------------------------------
    // Capacidad 1 · Consultar un credito (G-5)
    // ------------------------------------------------------------------

    registrar(
        "consultar_credito",
        {
            title: "Consultar un credito",
            description:
                "Devuelve el estado de un credito a una fecha de corte: "
                + "estado, saldo de capital, dias de atraso, tramo de mora, "
                + "cuotas pagadas y vencidas, y la proxima cuota. "
                + "Solo lectura.",
            inputSchema: consultarCreditoForma
        },
        async (argumentos) => {
            try {
                const { idCredito, fechaCorte } =
                    ConsultarCreditoEntrada.parse(argumentos);

                return comoContenido(
                    await consultas.consultarCredito(
                        idCredito,
                        aFechaCorte(fechaCorte)
                    )
                );
            } catch (error) {
                return comoContenido(aErrorHerramienta(error));
            }
        }
    );

    // ------------------------------------------------------------------
    // Capacidad 2 · Calcular la deuda de una cuota (OP-1, OP-2)
    // ------------------------------------------------------------------

    registrar(
        "calcular_deuda_de_cuota",
        {
            title: "Calcular la deuda de una cuota",
            description:
                "Devuelve el desglose de lo que adeuda una cuota vencida a "
                + "una fecha de corte, en el orden de prelacion: gastos de "
                + "gestion, interes moratorio, interes corriente, capital y "
                + "total exigible. Solo lectura; no registra ningun pago.",
            inputSchema: deudaDeCuotaForma
        },
        async (argumentos) => {
            try {
                const { idCredito, numeroCuota, fechaCorte } =
                    DeudaDeCuotaEntrada.parse(argumentos);

                return comoContenido(
                    await consultas.calcularDeudaDeCuota(
                        idCredito,
                        numeroCuota,
                        aFechaCorte(fechaCorte)
                    )
                );
            } catch (error) {
                return comoContenido(aErrorHerramienta(error));
            }
        }
    );

    // ------------------------------------------------------------------
    // Capacidad 3 · Explicar una mora (G-5, G-7)
    // ------------------------------------------------------------------

    registrar(
        "explicar_mora",
        {
            title: "Explicar una mora",
            description:
                "Explica como se formo el interes moratorio de una cuota a "
                + "una fecha de corte: capital en mora y desglose por tramo "
                + "recorrido, con los dias y la tasa de cada tramo. Indica "
                + "si la suma de los tramos redondeados difiere del total, "
                + "porque el redondeo ocurre una sola vez al cerrar el "
                + "calculo. Solo lectura.",
            inputSchema: explicarMoraForma
        },
        async (argumentos) => {
            try {
                const { idCredito, numeroCuota, fechaCorte } =
                    ExplicarMoraEntrada.parse(argumentos);

                return comoContenido(
                    await consultas.explicarMora(
                        idCredito,
                        numeroCuota,
                        aFechaCorte(fechaCorte)
                    )
                );
            } catch (error) {
                return comoContenido(aErrorHerramienta(error));
            }
        }
    );

    // ------------------------------------------------------------------
    // Capacidad 4 · Listar creditos en mora (G-4)
    // ------------------------------------------------------------------

    registrar(
        "listar_creditos_en_mora",
        {
            title: "Listar creditos en mora",
            description:
                "Lista los creditos con atraso a una fecha de corte, cada "
                + "uno con su cliente, dias de atraso, tramo, saldo de "
                + "capital y cuotas vencidas. Se puede filtrar por tramo "
                + "(mora_1, mora_2, mora_3 o vencido); sin filtro devuelve "
                + "todos los que tengan atraso, del mayor al menor. "
                + "Incluye la cantidad y el saldo total. Solo lectura.",
            inputSchema: creditosEnMoraForma
        },
        async (argumentos) => {
            try {
                const { fechaCorte, tramo } =
                    CreditosEnMoraEntrada.parse(argumentos);

                return comoContenido(
                    await consultas.listarCreditosEnMora(
                        aFechaCorte(fechaCorte),
                        tramo
                    )
                );
            } catch (error) {
                return comoContenido(aErrorHerramienta(error));
            }
        }
    );

    return servidor;
}
