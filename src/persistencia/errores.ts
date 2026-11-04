/**
 * Errores del cargador canonico.
 *
 * Mismo estilo que la convencion de errores del contrato de la API (E5):
 * un `codigo` estable en mayusculas para programar contra el, y un
 * `mensaje` para humanos.
 */
export type CodigoErrorCarga =
    | "DIRECTORIO_NO_DEFINIDO"
    | "PAQUETE_INCOMPLETO"
    | "HUELLA_NO_COINCIDE"
    | "HUELLA_MAL_FORMADA"
    | "EVENTO_INVALIDO"
    | "CARGA_PREVIA_DISTINTA"
    | "CONTEO_INESPERADO";

export class ErrorCarga extends Error {

    constructor(
        public readonly codigo: CodigoErrorCarga,
        mensaje: string
    ) {
        super(mensaje);
        this.name = "ErrorCarga";
    }
}
