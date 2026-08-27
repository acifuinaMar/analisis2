import { z } from "zod";
import { DineroEsquema, FechaISOEsquema, FechaHoraISOEsquema } from "./comun";
import { CarteraPorTramoEsquema, ReporteCarteraEsquema } from "./cartera";

/**
 * Recurso Cierres (seccion 6.9).
 *
 * Un cierre es idempotente por diseno: "reejecutar el cierre del mismo
 * dia debe producir el mismo resultado y no duplicar movimientos". Por
 * eso GET /cierres/{id} siempre puede reconstruir exactamente lo que
 * devolvio el POST que lo genero -- el cierre no se recalcula al leerlo,
 * se lee la foto que quedo congelada (regla de mayor, seccion 6.9).
 */

export const TipoCierreEsquema = z.enum(["diario", "mensual"])
    .openapi("TipoCierre");

export const CierreDiarioEsquema = z.object({
    id: z.string().openapi({ example: "CIE-2026-02-15" }),
    tipo: z.literal("diario"),
    fechaCorte: FechaISOEsquema,
    generadoEn: FechaHoraISOEsquema,
    desembolsosDelDia: DineroEsquema,
    recuperacionesPorConcepto: z.object({
        capital: DineroEsquema,
        interesCorriente: DineroEsquema,
        interesMoratorio: DineroEsquema,
        gastos: DineroEsquema
    }),
    devengoInteres: DineroEsquema.openapi({
        description: "Interes corriente reconocido en el dia, excluyendo "
            + "el que esta en suspenso por superar 90 dias de atraso "
            + "(seccion 6.5)."
    }),
    creditosMarcadosEnMora: z.number().int().min(0),
    saldoCartera: DineroEsquema
}).openapi("CierreDiario");

export const CierreMensualEsquema = z.object({
    id: z.string().openapi({ example: "CIE-2026-02" }),
    tipo: z.literal("mensual"),
    periodo: z.string().regex(/^\d{4}-\d{2}$/).openapi({ example: "2026-02" }),
    generadoEn: FechaHoraISOEsquema,
    resumenDiario: DineroEsquema.openapi({
        description: "Suma de desembolsos y recuperaciones del periodo."
    }),
    carteraEnRiesgo: ReporteCarteraEsquema,
    carteraEnRiesgoPorTramo: CarteraPorTramoEsquema,
    dadoPorIncobrableEnPeriodo: DineroEsquema.openapi({
        description: "Debe reportarse SIEMPRE junto al porcentaje de "
            + "cartera en riesgo (seccion 6.8): de lo contrario el "
            + "indicador puede 'mejorar' solo por dar de baja creditos."
    }),
    provisiones: DineroEsquema,
    creditosActivos: z.number().int().min(0),
    vencimientosProximos30Dias: DineroEsquema
}).openapi("CierreMensual");

export const GenerarCierreDiarioEsquema = z.object({
    fechaCorte: FechaISOEsquema
}).openapi("GenerarCierreDiarioRequest");

export const GenerarCierreMensualEsquema = z.object({
    periodo: z.string().regex(/^\d{4}-\d{2}$/).openapi({ example: "2026-02" })
}).openapi("GenerarCierreMensualRequest");
