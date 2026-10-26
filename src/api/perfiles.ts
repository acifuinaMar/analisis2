import type { RequestHandler } from "express";

import { ErrorHttp } from "./errores";

/**
 * Perfiles de uso (alcance del E1: "basta con distinguir el perfil
 * asesor del perfil gerencia"; la autenticacion empresarial queda
 * fuera, seccion 3.1 del enunciado).
 *
 * El perfil viaja en el encabezado `X-Perfil` y se VERIFICA EN EL
 * SERVIDOR: ocultar un boton en la interfaz no es un control de acceso.
 * Es la expresion del menor privilegio en la capa HTTP:
 *
 *   asesor    origina creditos y registra pagos; no ve tablero ni cierres
 *   gerencia  consulta todo; no mueve dinero ni origina
 *
 * No es seguridad real (cualquiera puede mandar el encabezado): es la
 * separacion de responsabilidades que pide el alcance del proyecto.
 */
export const PERFILES = ["asesor", "gerencia"] as const;

export type Perfil = typeof PERFILES[number];

export function exigirPerfil(...permitidos: Perfil[]): RequestHandler {

    return (req, _res, siguiente) => {

        const recibido = req.header("X-Perfil");

        if (!recibido) {
            throw new ErrorHttp(
                401, "PERFIL_REQUERIDO",
                "Falta el encabezado X-Perfil (asesor o gerencia)."
            );
        }

        if (!(PERFILES as readonly string[]).includes(recibido)) {
            throw new ErrorHttp(
                400, "PERFIL_INVALIDO",
                `El perfil '${recibido}' no existe. Use asesor o gerencia.`
            );
        }

        if (!(permitidos as readonly string[]).includes(recibido)) {
            throw new ErrorHttp(
                403, "PERFIL_SIN_PERMISO",
                `El perfil '${recibido}' no tiene permiso para esta operacion.`,
                { permitidos }
            );
        }

        siguiente();
    };
}
