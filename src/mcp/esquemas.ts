import { z } from "zod";
import type { ZodRawShape } from "zod";

import { TramoMora } from "../dominio/tramo-mora";

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

export const explicarMoraForma: ZodRawShape = {
    idCredito: IdCreditoEsquema,
    numeroCuota: NumeroCuotaEsquema,
    fechaCorte: FechaCorteEsquema
};

export const ExplicarMoraEntrada = z.object({
    idCredito: IdCreditoEsquema,
    numeroCuota: NumeroCuotaEsquema,
    fechaCorte: FechaCorteEsquema
});

/**
 * Tramo de mora por el que filtrar el listado.
 *
 * El enum se arma con los valores de TramoMora y no con literales
 * sueltos: si el dominio renombra un tramo, esto deja de compilar en vez
 * de aceptar en silencio un filtro que nunca calza con nada.
 *
 * AL_DIA queda fuera a proposito: la herramienta lista creditos EN MORA,
 * y pedirle los que estan al dia es una contradiccion que conviene
 * rechazar en el borde antes que devolver una lista vacia inexplicable.
 */
const TramoEnMoraEsquema = z
    .enum([
        TramoMora.MORA_1,
        TramoMora.MORA_2,
        TramoMora.MORA_3,
        TramoMora.VENCIDO
    ])
    .describe(
        "Tramo de mora por el que filtrar: mora_1 (1 a 30 dias), "
        + "mora_2 (31 a 60), mora_3 (61 a 90) o vencido (mas de 90). "
        + "Si se omite, devuelve todos los creditos con atraso."
    );

export const creditosEnMoraForma: ZodRawShape = {
    fechaCorte: FechaCorteEsquema,
    tramo: TramoEnMoraEsquema.optional()
};

export const CreditosEnMoraEntrada = z.object({
    fechaCorte: FechaCorteEsquema,
    tramo: TramoEnMoraEsquema.optional()
});

/**
 * Ventana de dias hacia adelante para los proximos vencimientos.
 *
 * Se acota a 365 dias: mas alla de un año la pregunta deja de ser
 * "que vence pronto" y pasa a ser el plan de amortizacion completo, que
 * ya tiene su propia consulta.
 */
const VentanaDiasEsquema = z
    .number()
    .int()
    .min(1)
    .max(365)
    .describe(
        "Cantidad de dias hacia adelante desde la fecha de corte, de 1 a "
        + "365. La ventana no incluye el dia del corte: una cuota que "
        + "vence hoy ya es exigible y no es un vencimiento proximo."
    );

export const proximosVencimientosForma: ZodRawShape = {
    fechaCorte: FechaCorteEsquema,
    ventanaDias: VentanaDiasEsquema
};

export const ProximosVencimientosEntrada = z.object({
    fechaCorte: FechaCorteEsquema,
    ventanaDias: VentanaDiasEsquema
});

export const consultarCarteraForma: ZodRawShape = {
    fechaCorte: FechaCorteEsquema
};

export const ConsultarCarteraEntrada = z.object({
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
