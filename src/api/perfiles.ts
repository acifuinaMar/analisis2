import type { RequestHandler } from "express";

import { PERFILES, type Perfil } from "../acceso/perfil";
import { ErrorHttp } from "./errores";

/**
 * Como la API hace cumplir los perfiles.
 *
 * La LISTA de perfiles no se define aqui: vive en src/acceso/perfil.ts,
 * porque el chat gerencial del E5 necesita la misma y dos listas que
 * deberian ser iguales acaban divergiendo. Aqui vive solo la parte que
 * es propia de HTTP.
 *
 * El perfil viaja en el encabezado `X-Perfil` y se VERIFICA EN EL
 * SERVIDOR: ocultar un boton en la interfaz no es un control de acceso.
 * Es la expresion del menor privilegio en la capa HTTP.
 *
 * No es seguridad real (cualquiera puede mandar el encabezado): es la
 * separacion de responsabilidades que pide el alcance del proyecto, y la
 * autenticacion queda fuera por la seccion 3.1 del enunciado.
 */

export { PERFILES, type Perfil } from "../acceso/perfil";

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
