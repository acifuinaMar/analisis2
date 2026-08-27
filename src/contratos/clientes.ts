import { z } from "zod";
import { FechaHoraISOEsquema } from "./comun";

/**
 * Recurso Clientes.
 *
 */
export const ClienteEsquema = z.object({
    id: z.string().openapi({ example: "CLI-0001" }),
    nombreCompleto: z.string().min(3).openapi({ example: "Maria Xolop" }),
    dpi: z.string()
        .regex(/^\d{13}$/, "El DPI debe tener 13 digitos.")
        .openapi({ example: "2547896321015" }),
    nit: z.string().optional().openapi({ example: "1234567-8" }),
    telefono: z.string().openapi({ example: "50212345678" }),
    direccion: z.string().openapi({ example: "3a. calle 4-56, zona 3, Xela" }),
    fechaRegistro: FechaHoraISOEsquema
}).openapi("Cliente");

export const CrearClienteEsquema = ClienteEsquema.omit({
    id: true,
    fechaRegistro: true
}).openapi("CrearClienteRequest");
