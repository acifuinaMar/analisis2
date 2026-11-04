import type { VistaPreviaPago } from "../chat/TarjetaAprobacion";
import type { ClienteApi } from "./cliente";

/**
 * Chat gerencial (E5) contra la API.
 *
 *   POST /api/chat            preguntar (abre o continúa la conversación)
 *   POST /api/chat/aprobar    aplicar el pago propuesto  — solo asesor
 *   POST /api/chat/rechazar   descartar la propuesta      — ambos perfiles
 *
 * Las cifras no se calculan aquí ni en ninguna parte de la interfaz:
 * vienen del orquestador, que las pide a las herramientas MCP, que las
 * piden al núcleo.
 *
 * LA SESIÓN. `idSesion` es opcional al preguntar: sin él el servidor abre
 * una conversación nueva y devuelve su identificador; con él continúa la
 * que ya existe. Eso es lo que da la memoria entre preguntas encadenadas
 * que pide el E5, porque HTTP no recuerda nada por su cuenta.
 *
 * El perfil queda atado a la conversación en el servidor, así que una
 * sesión abierta como gerencia no se puede continuar como asesor: la
 * respuesta sería 404. Para cambiar de perfil se empieza de nuevo, que es
 * justo lo correcto.
 */

export interface RespuestaTexto {
    readonly idSesion: string;
    readonly tipo: "respuesta";
    readonly texto: string;
    readonly herramientasUsadas: ReadonlyArray<string>;
}

export interface RespuestaAprobacion {
    readonly idSesion: string;
    readonly tipo: "aprobacion_requerida";
    readonly propuesta: {
        readonly idCredito: string;
        readonly monto: number;
        readonly claveIdempotencia: string;
        readonly fechaOperacion: string;
        readonly canal: string;
        readonly vistaPrevia: VistaPreviaPago;
    };
    readonly herramientasUsadas: ReadonlyArray<string>;
    /**
     * Si este perfil puede aplicar el pago. Lo decide el SERVIDOR; la
     * interfaz solo lo refleja para no ofrecer un botón que iba a ser
     * negado. No es el control: la ruta de aprobar es solo del asesor y
     * el orquestador lo verifica otra vez.
     */
    readonly puedeAprobar: boolean;
}

export type RespuestaChat = RespuestaTexto | RespuestaAprobacion;

export function preguntarAlAsistente(
    api: ClienteApi,
    pregunta: string,
    idSesion: string | null,
    senal?: AbortSignal
) {
    return api.post<RespuestaChat>(
        "/chat",
        idSesion === null ? { pregunta } : { pregunta, idSesion },
        senal
    );
}

export function aprobarPagoDelAsistente(
    api: ClienteApi,
    idSesion: string,
    senal?: AbortSignal
) {
    return api.post<RespuestaChat>("/chat/aprobar", { idSesion }, senal);
}

export function rechazarPagoDelAsistente(
    api: ClienteApi,
    idSesion: string,
    motivo?: string,
    senal?: AbortSignal
) {
    return api.post<RespuestaChat>(
        "/chat/rechazar",
        motivo === undefined ? { idSesion } : { idSesion, motivo },
        senal
    );
}
