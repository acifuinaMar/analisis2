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

/**
 * Periodo mensual en formato AAAA-MM.
 *
 * El cierre mensual recibe el periodo como parametro, igual que el diario
 * recibe la fecha de corte: el nucleo nunca deduce "el mes actual" del
 * reloj del sistema.
 */
export const PeriodoEsquema = z
    .string()
    .regex(
        /^\d{4}-(0[1-9]|1[0-2])$/,
        "El periodo debe venir en formato AAAA-MM, por ejemplo 2026-10."
    )
    .describe(
        "Mes del cierre en formato AAAA-MM, por ejemplo 2026-10. "
        + "Obligatorio: el sistema nunca asume el mes actual."
    );

export const cierreDiarioForma: ZodRawShape = {
    fechaCorte: FechaCorteEsquema
};

export const CierreDiarioEntrada = z.object({
    fechaCorte: FechaCorteEsquema
});

export const cierreMensualForma: ZodRawShape = {
    periodo: PeriodoEsquema
};

export const CierreMensualEntrada = z.object({
    periodo: PeriodoEsquema
});

/**
 * Clave de idempotencia de la operacion de pago.
 *
 * Identifica la OPERACION, no el pago (P1 6.10): reintentar con la misma
 * clave no vuelve a cobrar. Es obligatoria y la pone el llamador, porque
 * si la generara el servidor cada reintento seria una clave nueva y la
 * idempotencia no serviria de nada.
 */
const ClaveIdempotenciaEsquema = z
    .string()
    .min(4)
    .max(64)
    .regex(
        /^[A-Za-z0-9._:-]+$/,
        "La clave solo admite letras, numeros, punto, guion, guion bajo "
        + "y dos puntos."
    )
    .describe(
        "Clave de idempotencia de la operacion, por ejemplo "
        + "IDEM-OP-1. Reintentar con la misma clave NO vuelve a cobrar."
    );

const MontoPagoEsquema = z
    .number()
    .positive()
    .describe(
        "Monto del pago en quetzales. Debe ser exactamente la deuda "
        + "exigible del credito a la fecha de operacion; si no lo es, la "
        + "herramienta lo rechaza e indica el monto correcto."
    );

export const registrarPagoForma: ZodRawShape = {
    idCredito: IdCreditoEsquema,
    monto: MontoPagoEsquema,
    claveIdempotencia: ClaveIdempotenciaEsquema,
    fechaOperacion: FechaCorteEsquema,
    canal: z
        .enum(["agencia", "campo", "transferencia"])
        .optional()
        .describe("Canal por el que se recibio el pago. Por omision, agencia."),
    confirmado: z
        .boolean()
        .optional()
        .describe(
            "Debe ser true para APLICAR el pago. Omitirlo o enviarlo en "
            + "false devuelve solo la vista previa con el desglose, sin "
            + "mover nada: es el paso de aprobacion humana. Nunca lo "
            + "envie en true sin que una persona haya aprobado el "
            + "desglose."
        )
};

export const RegistrarPagoEntrada = z.object({
    idCredito: IdCreditoEsquema,
    monto: MontoPagoEsquema,
    claveIdempotencia: ClaveIdempotenciaEsquema,
    fechaOperacion: FechaCorteEsquema,
    canal: z.enum(["agencia", "campo", "transferencia"]).optional(),
    confirmado: z.boolean().optional()
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
