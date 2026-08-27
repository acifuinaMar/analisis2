import { z } from "zod";
import { DineroEsquema, FechaHoraISOEsquema } from "./comun";
import { EstadoCreditoEsquema, TramoMoraEsquema } from "./creditos";

/**
 * Recurso Pagos.
 *
 * `RegistrarPago` es, junto con la mora, el caso de uso mas delicado del
 * dominio (secciones 6.5-6.6). El contrato expone el desglose completo
 * de la prelacion (AplicacionPago, src/dominio/aplicacion-pago.ts) para
 * que quien reciba el pago pueda auditar, en la misma respuesta, a que
 * correspondio cada quetzal -- la regla de "cargos justificados"
 * (seccion 6.3.1) exige poder demostrarlo.
 */

export const RegistrarPagoEsquema = z.object({
    monto: DineroEsquema,
    fecha: FechaHoraISOEsquema,
    medioPago: z.enum([
        "efectivo",
        "transferencia",
        "deposito",
        "tarjeta"
    ]),
    referencia: z.string().optional().openapi({
        example: "DEP-458210",
        description: "Numero de boleta, voucher o comprobante externo."
    }),
    fechaCorte: FechaHoraISOEsquema.openapi({
        description: "Fecha de corte con la que se calcula la mora al "
            + "momento de aplicar el pago (puerto Reloj, seccion 7.1). "
            + "El servidor NUNCA usa su propio reloj de sistema para "
            + "esta operacion; la recibe siempre como parametro."
    })
}).openapi("RegistrarPagoRequest", {
    description: "Cuerpo de POST /creditos/{id}/pagos. La peticion "
        + "DEBE incluir el encabezado 'Idempotency-Key' (ver seccion "
        + "de idempotencia del documento E5); repetirla con la misma "
        + "clave nunca cobra dos veces (invariante 6.10)."
});

/** Espejo de AplicacionPago (src/dominio/aplicacion-pago.ts). */
export const AplicacionPagoEsquema = z.object({
    gastos: DineroEsquema,
    interesMoratorio: DineroEsquema,
    interesCorriente: DineroEsquema,
    capital: DineroEsquema,
    excedente: DineroEsquema,
    destinoExcedente: z.enum([
        "ninguno",
        "amortizacion_a_capital",
        "pago_anticipado_de_cuotas"
    ]).openapi({
        description: "Politica de adelanto aplicada al excedente "
            + "(seccion 6.6.5, src/estrategias/politica-adelanto.ts). "
            + "'ninguno' cuando el pago no genero excedente."
    })
}).openapi("AplicacionPago");

export const PagoEsquema = z.object({
    id: z.string().openapi({ example: "PAG-0001" }),
    creditoId: z.string().openapi({ example: "CR-0001" }),
    monto: DineroEsquema,
    fecha: FechaHoraISOEsquema,
    medioPago: z.enum([
        "efectivo",
        "transferencia",
        "deposito",
        "tarjeta"
    ]),
    referencia: z.string().optional(),
    claveIdempotencia: z.string().uuid(),
    aplicacion: AplicacionPagoEsquema,
    estadoCreditoResultante: EstadoCreditoEsquema,
    tramoMoraResultante: TramoMoraEsquema.nullable()
}).openapi("Pago");
