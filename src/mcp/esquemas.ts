import { z } from "zod";
import type { ZodRawShape } from "zod";

/**
 * Esquemas Zod de las herramientas MCP (E3).
 *
 * El enunciado pide que las herramientas se describan con Zod, y la nota
 * 8.2 del Proyecto 1 explica por que: un esquema se escribe una vez y
 * sirve tres veces — valida la entrada de la API, genera el OpenAPI y
 * describe las herramientas del servidor MCP. Es lo que hace que el
 * contrato disenado en agosto sea el mismo que el asistente usa ahora.
 */

/**
 * Fecha de corte en formato AAAA-MM-DD.
 *
 * TODA herramienta la recibe como parametro. Ninguna lee la fecha del
 * sistema: es el puerto Reloj del Proyecto 1, y con mora escalonada pesa
 * mas que nunca porque el tramo depende de la fecha. La consulta G-7 pide
 * deliberadamente una fecha futura para comprobarlo.
 */
export const FechaCorteEsquema = z
    .string()
    .regex(
        /^\d{4}-\d{2}-\d{2}$/,
        "La fecha de corte debe venir en formato AAAA-MM-DD."
    )
    .describe(
        "Fecha de corte del calculo, en formato AAAA-MM-DD. "
        + "Obligatoria: el sistema nunca usa la fecha de hoy por su cuenta."
    );

export const IdCreditoEsquema = z
    .string()
    .regex(
        /^CV-\d{4}-\d{4}$/,
        "El identificador de credito tiene la forma CV-AAAA-NNNN."
    )
    .describe("Identificador del credito, por ejemplo CV-2026-0030.");

/**
 * Las formas se anotan como ZodRawShape a proposito.
 *
 * El SDK de MCP infiere los tipos del manejador a partir del esquema, y
 * con validaciones encadenadas esa inferencia se vuelve tan profunda que
 * TypeScript se rinde (error TS2589). Ensanchar el tipo aqui la corta, y
 * la validacion estricta se hace dentro del manejador con el esquema
 * completo: se valida igual, y ademas en tiempo de ejecucion.
 */
export const consultarCreditoForma: ZodRawShape = {
    idCredito: IdCreditoEsquema,
    fechaCorte: FechaCorteEsquema
};

export const ConsultarCreditoEntrada = z.object({
    idCredito: IdCreditoEsquema,
    fechaCorte: FechaCorteEsquema
});

const NumeroCuotaEsquema = z
    .number()
    .int()
    .positive()
    .describe("Numero de cuota dentro del plan, empezando en 1.");

export const deudaDeCuotaForma: ZodRawShape = {
    idCredito: IdCreditoEsquema,
    numeroCuota: NumeroCuotaEsquema,
    fechaCorte: FechaCorteEsquema
};

export const DeudaDeCuotaEntrada = z.object({
    idCredito: IdCreditoEsquema,
    numeroCuota: NumeroCuotaEsquema,
    fechaCorte: FechaCorteEsquema
});

export type ConsultarCreditoEntrada =
    z.infer<typeof ConsultarCreditoEntrada>;

export type DeudaDeCuotaEntrada =
    z.infer<typeof DeudaDeCuotaEntrada>;

/**
 * Convierte la fecha de corte validada a Date.
 *
 * Se construye por componentes y no con `new Date(texto)` porque esa
 * forma la interpreta como UTC y en Guatemala retrocede un dia. Un dia de
 * diferencia puede cambiar el tramo de mora y con el la cifra cobrada.
 */
export function aFechaCorte(texto: string): Date {

    const [anio, mes, dia] = texto.split("-").map(Number);
    const fecha = new Date(anio, mes - 1, dia);

    if (
        fecha.getFullYear() !== anio
        || fecha.getMonth() !== mes - 1
        || fecha.getDate() !== dia
    ) {
        throw new Error(`La fecha ${texto} no existe en el calendario.`);
    }

    return fecha;
}
