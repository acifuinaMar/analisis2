import { z } from "zod";
import { DineroEsquema, FechaISOEsquema, FechaHoraISOEsquema } from "./comun";

/**
 * Recurso Creditos.
 *
 * Estos esquemas son el espejo, en el borde HTTP, de los tipos reales del
 * nucleo de dominio (src/dominio): NombreEstado, TramoMora, Cuota y
 * PoliticaCredito. No se inventan campos nuevos: cada propiedad de aqui
 * corresponde a un campo o a un metodo de consulta que ya existe en E4.
 */

export const BaseConteoEsquema = z.enum(["360", "365"]).openapi(
    "BaseConteo",
    {
        description: "Base de conteo de dias para la mora (seccion 6.3): "
            + "360 = Actual/360 (sugerida), 365 = Actual/365."
    }
);

/** Espejo de PoliticaCredito (src/dominio/politica-credito.ts). */
export const PoliticaCreditoEsquema = z.object({
    version: z.string().openapi({ example: "POL-2026-01" }),
    tasaAnual: z.number().min(0).max(2).openapi({
        description: "TNA corriente en decimal (0.36 = 36% anual, "
            + "seccion 6.3). Sujeta a la guarda de razonabilidad del "
            + "dominio: valores fuera de [0, 2] se rechazan.",
        example: 0.36
    }),
    tasaMoratoriaAnual: z.number().min(0).max(2).openapi({
        description: "TNA moratoria en decimal (seccion 6.5).",
        example: 0.24
    }),
    baseConteo: BaseConteoEsquema,
    autor: z.string().openapi({ example: "Comite de Credito" }),
    fechaVigencia: FechaISOEsquema
}).openapi("PoliticaCredito");

/** Espejo del enum NombreEstado (tabla 6.7.1). */
export const EstadoCreditoEsquema = z.enum([
    "aprobado",
    "vigente",
    "en_mora",
    "reestructurado",
    "cancelado",
    "anulado",
    "incobrable"
]).openapi("EstadoCredito", {
    description: "Estado del credito (seccion 6.7). 'solicitado' y "
        + "'rechazado' pertenecen al recurso Solicitudes: un Credito "
        + "solo existe a partir del desembolso."
});

/** Espejo del enum TramoMora (seccion 6.5): clasificacion DERIVADA. */
export const TramoMoraEsquema = z.enum([
    "al_dia",
    "mora_1",
    "mora_2",
    "mora_3",
    "vencido"
]).openapi("TramoMora", {
    description: "Clasificacion derivada de los dias de atraso a la "
        + "fecha de corte consultada. NO es el estado del credito "
        + "(seccion 6.7.1): se recalcula en cada consulta y puede subir "
        + "o bajar sin que el estado cambie."
});

/** Espejo de Cuota (src/dominio/cuota.ts). */
export const CuotaEsquema = z.object({
    numero: z.number().int().min(1),
    monto: DineroEsquema,
    capital: DineroEsquema,
    interes: DineroEsquema,
    fechaVencimiento: FechaISOEsquema,
    capitalPagado: DineroEsquema,
    interesPagado: DineroEsquema,
    estado: z.enum(["pendiente", "parcial", "pagada"]).openapi({
        description: "Espejo de EstadoCuota; DERIVADO de los abonos, no "
            + "un campo independiente (src/dominio/cuota.ts)."
    })
}).openapi("Cuota");

export const CreditoEsquema = z.object({
    id: z.string().openapi({ example: "CR-0001" }),
    clienteId: z.string().openapi({ example: "CLI-0001" }),
    solicitudId: z.string().openapi({ example: "SOL-0001" }),
    monto: DineroEsquema.openapi({ description: "Capital desembolsado (P)." }),
    saldoCapital: DineroEsquema,
    plazoMeses: z.number().int().min(3).max(24),
    fechaDesembolso: FechaISOEsquema,
    politica: PoliticaCreditoEsquema,
    estado: EstadoCreditoEsquema,
    reestructuradoAlgunaVez: z.boolean().openapi({
        description: "Marca permanente (seccion 6.7): la reestructuracion "
            + "no borra el pasado, aunque el estado vuelva a 'vigente'."
    }),
    tramoMora: TramoMoraEsquema.nullable().openapi({
        description: "null cuando el credito no tiene ninguna cuota "
            + "vencida a la fecha de corte consultada."
    }),
    diasAtraso: z.number().int().min(0)
}).openapi("Credito");

export const DesembolsarCreditoEsquema = z.object({
    solicitudId: z.string().openapi({ example: "SOL-0001" }),
    fechaDesembolso: FechaISOEsquema,
    politicaVersion: z.string().openapi({
        description: "Version de PoliticaCredito vigente a la fecha de "
            + "desembolso (seccion 6.3.1): el credito queda ligado a "
            + "ella para siempre, aunque la politica cambie despues.",
        example: "POL-2026-01"
    })
}).openapi("DesembolsarCreditoRequest");

export const ReestructurarCreditoEsquema = z.object({
    nuevoPlazoMeses: z.number().int().min(3).max(24),
    nuevaPoliticaVersion: z.string().optional(),
    motivo: z.string().min(5).openapi({
        example: "Acuerdo de nuevas condiciones por reduccion de ingresos "
            + "comprobada."
    }),
    autorizadoPor: z.string().openapi({ example: "Comite de Credito" })
}).openapi("ReestructurarCreditoRequest");

export const DeclararIncobrableEsquema = z.object({
    fechaCorte: FechaISOEsquema,
    autorizadoPor: z.string().openapi({ example: "Gerencia de Cartera" })
}).openapi("DeclararIncobrableRequest");

export const PlanAmortizacionEsquema = z.object({
    creditoId: z.string(),
    cuotas: z.array(CuotaEsquema)
}).openapi("PlanAmortizacion");
