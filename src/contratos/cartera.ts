import { z } from "zod";
import { DineroEsquema, FechaISOEsquema } from "./comun";
import { TramoMoraEsquema } from "./creditos";

/**
 * Recurso Cartera en riesgo (seccion 6.8).
 *
 * Espejo de ReporteCartera (src/servicios/cartera.ts). El enunciado es
 * explicito: "el porcentaje de cartera en riesgo nunca se reporta solo:
 * debe ir acompanado de cuanto se dio por incobrable en el periodo". Por
 * eso `porcentajeEnRiesgo` y `dadoPorIncobrable` viven en el MISMO objeto
 * y no en endpoints separados que alguien pueda consultar por separado.
 */
export const ReporteCarteraEsquema = z.object({
    fechaCorte: FechaISOEsquema,
    carteraActiva: DineroEsquema,
    montoEnRiesgo: DineroEsquema,
    porcentajeEnRiesgo: z.number().min(0).max(1).openapi({
        description: "Invariante 6.10: siempre entre 0 y 1. Se expresa "
            + "en decimal (0.07 = 7.00%), nunca ya multiplicado por 100, "
            + "para que el cliente decida el formato de presentacion.",
        example: 0.07
    }),
    dadoPorIncobrable: DineroEsquema
}).openapi("ReporteCartera");

export const CarteraPorTramoEsquema = z.object({
    mora1: DineroEsquema,
    mora2: DineroEsquema,
    mora3: DineroEsquema,
    vencido: DineroEsquema
}).openapi("CarteraPorTramo", {
    description: "Saldo de capital de la cartera activa agrupado por "
        + "TramoMora (seccion 6.5), usado en el cierre mensual."
});

export const PosicionCarteraEsquema = z.object({
    creditoId: z.string().openapi({ example: "CR-0003" }),
    saldoCapital: DineroEsquema,
    diasAtraso: z.number().int().min(0),
    tramoMora: TramoMoraEsquema,
    marcadoReestructurado: z.boolean(),
    enRiesgo: z.boolean()
}).openapi("PosicionCartera", {
    description: "Espejo de PosicionCartera (src/dominio/"
        + "posicion-cartera.ts): la foto de un credito a la fecha de "
        + "corte usada para decidir si esta en riesgo."
});
