import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

/**
 * Contratos de la API (E5).
 *
 * Nota 8.2 del enunciado: "un esquema Zod se escribe una vez y sirve tres
 * veces: valida la entrada de la API, genera la especificacion OpenAPI, y
 * define el esquema de las herramientas del servidor MCP en el Proyecto
 * Final". Por eso estos esquemas NO viven en el nucleo de dominio (E4):
 * son el contrato de los adaptadores primarios, la capa que en el
 * Proyecto Final hablara con Express y con el servidor MCP por igual.
 *
 * Regla de diseno (seccion 6.2): ningun importe monetario viaja como
 * `number` de punto flotante, ni siquiera en el borde HTTP. Un monto se
 * representa como una cadena decimal de dos posiciones ("1004.62"), tal
 * como lo exige la representacion interna en centavos. El cliente de la
 * API nunca ve un float que un parser JSON pueda truncar.
 */

/** Patron de un importe expresado con exactamente 2 decimales. */
const PATRON_MONTO_DECIMAL = /^\d+\.\d{2}$/;

export const MonedaEsquema = z.enum(["GTQ", "USD"]).openapi("Moneda", {
    description: "Moneda del importe. El nucleo prohibe operar dos "
        + "monedas distintas entre si (seccion 6.2)."
});

export const DineroEsquema = z.object({
    moneda: MonedaEsquema,
    monto: z.string()
        .regex(
            PATRON_MONTO_DECIMAL,
            "El monto debe expresarse con exactamente 2 decimales, "
            + "p. ej. '1004.62'."
        )
        .openapi({ example: "1004.62" })
}).openapi("Dinero", {
    description: "Objeto de Valor Dinero (seccion 6.2). Se serializa "
        + "como cadena decimal, nunca como number, para no reintroducir "
        + "en el borde HTTP el error de punto flotante que el nucleo "
        + "evita internamente representando centavos como entero."
});

export const ClaveIdempotenciaEsquema = z.string()
    .uuid("La clave de idempotencia debe ser un UUID v4.")
    .openapi("ClaveIdempotencia", {
        description: "Identificador unico generado por el cliente para "
            + "cada intento logico de pago (seccion 6.10, Anexo /E5). "
            + "Reintentar la misma peticion con la misma clave nunca "
            + "cobra dos veces: el servidor devuelve el mismo resultado "
            + "que la primera vez.",
        example: "6f9e2b0a-8f0e-4a34-9a2c-9d6a0a2f7e10"
    });

/**
 * Convencion uniforme de error (E5).
 *
 * Sigue el espiritu de RFC 9457 (Problem Details): un cuerpo de error
 * homogeneo para toda la API, en vez de que cada endpoint invente su
 * propia forma. `codigo` es un identificador estable pensado para que
 * el cliente programe contra el, sin parsear el mensaje humano.
 */
export const ErrorApiEsquema = z.object({
    codigo: z.string().openapi({
        example: "TRANSICION_INVALIDA",
        description: "Codigo estable, en mayusculas, para programar "
            + "contra el (no traducir ni parsear `mensaje`)."
    }),
    mensaje: z.string().openapi({
        example: "El credito 'CR-0001' esta en estado 'solicitado' y no "
            + "admite el evento 'registrarPago'."
    }),
    detalles: z.record(z.string(), z.unknown()).optional().openapi({
        description: "Contexto adicional segun el tipo de error, p. ej. "
            + "la lista de campos invalidos en un error de validacion."
    }),
    instancia: z.string().optional().openapi({
        description: "Identificador de la peticion (trazabilidad / logs)."
    })
}).openapi("ErrorApi", {
    description: "Cuerpo uniforme de error. Se usa en toda respuesta "
        + "4xx/5xx de la API."
});

export const FechaISOEsquema = z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use formato de fecha ISO (AAAA-MM-DD).")
    .openapi({ example: "2026-02-15" });

export const FechaHoraISOEsquema = z.string()
    .datetime({ message: "Use formato de fecha-hora ISO 8601." })
    .openapi({ example: "2026-02-15T14:30:00.000Z" });
