import { z } from "zod";
import { DineroEsquema, FechaHoraISOEsquema } from "./comun";

/**
 * Recurso Solicitudes (SolicitudCredito).
 *
 * Cubre la parte del ciclo de vida ANTERIOR al desembolso (tabla 6.7.1):
 * solicitado -> aprobado -> (se desembolsa, ver recurso Creditos)
 * solicitado -> rechazado
 * aprobado   -> anulado (el cliente desiste o expira antes del desembolso)
 *
 * Los limites de monto y plazo (seccion 2) se validan aqui, en el borde:
 * es una regla de aceptacion de la solicitud, no del calculo financiero.
 */
export const EstadoSolicitudEsquema = z.enum([
    "solicitado",
    "aprobado",
    "rechazado",
    "anulado"
]).openapi("EstadoSolicitud");

export const SolicitudEsquema = z.object({
    id: z.string().openapi({ example: "SOL-0001" }),
    clienteId: z.string().openapi({ example: "CLI-0001" }),
    montoSolicitado: DineroEsquema,
    plazoMeses: z.number().int().min(3).max(24).openapi({
        description: "Plazo en meses. La institucion coloca a 3-24 "
            + "meses (seccion 2).",
        example: 12
    }),
    estado: EstadoSolicitudEsquema,
    motivoRechazo: z.string().optional().openapi({
        description: "Obligatorio cuando estado = 'rechazado'."
    }),
    fechaSolicitud: FechaHoraISOEsquema
}).openapi("Solicitud");

export const CrearSolicitudEsquema = z.object({
    clienteId: z.string().openapi({ example: "CLI-0001" }),
    montoSolicitado: DineroEsquema.openapi({
        description: "Debe estar entre Q1,000 y Q25,000 (seccion 2)."
    }),
    plazoMeses: z.number().int().min(3).max(24)
}).openapi("CrearSolicitudRequest");

export const RechazarSolicitudEsquema = z.object({
    motivo: z.string().min(5).openapi({
        example: "No cumple el score minimo de la politica vigente."
    })
}).openapi("RechazarSolicitudRequest");
