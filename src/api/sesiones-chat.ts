import { randomUUID } from "node:crypto";

import { type Perfil } from "../acceso/perfil";
import type { Orquestador } from "../asistente/orquestador";
import { ErrorHttp } from "./errores";

/**
 * Las conversaciones del chat gerencial, vivas entre peticiones HTTP.
 *
 * Existe por una exigencia del enunciado que HTTP no cumple solo: el
 * E5 pide «memoria de la sesion: mantiene el contexto entre preguntas
 * encadenadas». El orquestador guarda ese contexto en su propia
 * instancia, y HTTP no recuerda nada entre peticiones, asi que alguien
 * tiene que sostener una instancia por conversacion. Ese alguien es
 * este modulo.
 *
 * EL PERFIL QUEDA ATADO A LA SESION AL ABRIRLA, y es la propiedad mas
 * importante de todo el archivo. Si la sesion aceptara cualquier
 * perfil en cada peticion, el chat volveria a ser la puerta de atras
 * del modelo de permisos por otro camino: se abriria la conversacion
 * como gerencia, se propondria el pago, y bastaria con cambiar el
 * encabezado `X-Perfil` a asesor para aprobarlo. El perfil se fija una
 * vez y despues se verifica que sea el mismo; una peticion con otro
 * perfil no continua la conversacion, se le niega.
 *
 * Vive en memoria y a proposito: el alcance del proyecto no incluye
 * autenticacion ni sesiones persistentes (seccion 3.1), y una
 * conversacion no es un dato que haya que conservar. Si el servidor se
 * reinicia, las conversaciones se pierden y eso esta bien.
 */

/** Crea un orquestador nuevo para el perfil dado. */
export type FabricaChat = (perfil: Perfil) => Promise<Orquestador>;

interface Sesion {
    readonly chat: Orquestador;
    readonly perfil: Perfil;
    /** Ultimo uso, para desalojar las viejas primero. */
    usadaEn: number;
}

export interface OpcionesSesiones {
    /**
     * Tope de conversaciones simultaneas. Al llegar al tope se
     * desaloja la que lleve mas tiempo sin usarse: sin tope, cada
     * recarga del navegador dejaria una conversacion viva para siempre
     * y la memoria del servidor creceria sin limite.
     */
    readonly maxSesiones?: number;
    /** Cuanto vive una conversacion sin usarse. */
    readonly vidaMs?: number;
    /** Inyectable para poder probar el vencimiento sin esperar. */
    readonly ahora?: () => number;
}

const MAX_SESIONES = 50;

/** Media hora sin preguntar: la reunion ya termino. */
const VIDA_MS = 30 * 60 * 1000;

export class SesionesChat {

    private readonly sesiones = new Map<string, Sesion>();

    private readonly maxSesiones: number;

    private readonly vidaMs: number;

    private readonly ahora: () => number;

    constructor(
        private readonly fabrica: FabricaChat,
        opciones: OpcionesSesiones = {}
    ) {
        this.maxSesiones = opciones.maxSesiones ?? MAX_SESIONES;
        this.vidaMs = opciones.vidaMs ?? VIDA_MS;
        this.ahora = opciones.ahora ?? (() => Date.now());
    }

    /** Abre una conversacion nueva y devuelve su identificador opaco. */
    public async abrir(
        perfil: Perfil
    ): Promise<{ idSesion: string; chat: Orquestador }> {

        this.limpiar();

        const chat = await this.fabrica(perfil);
        const idSesion = randomUUID();

        this.sesiones.set(idSesion, {
            chat,
            perfil,
            usadaEn: this.ahora()
        });

        return { idSesion, chat };
    }

    /**
     * Recupera una conversacion, exigiendo que el perfil coincida.
     *
     * El perfil se compara ANTES de decir si la sesion existe o no, por
     * la misma razon por la que el orquestador verifica el perfil antes
     * de mirar si hay un pago pendiente: un control de acceso no debe
     * filtrar informacion sobre lo que protege.
     */
    public obtener(idSesion: string, perfil: Perfil): Orquestador {

        this.limpiar();

        const sesion = this.sesiones.get(idSesion);

        if (!sesion || sesion.perfil !== perfil) {
            throw new ErrorHttp(
                404, "SESION_INEXISTENTE",
                "Esa conversacion no existe o ya vencio. Empiece una "
                + "nueva enviando la pregunta sin identificador de sesion."
            );
        }

        sesion.usadaEn = this.ahora();

        return sesion.chat;
    }

    /** Termina una conversacion. Es idempotente. */
    public cerrar(idSesion: string, perfil: Perfil): void {

        const sesion = this.sesiones.get(idSesion);

        if (sesion && sesion.perfil === perfil) {
            this.sesiones.delete(idSesion);
        }
    }

    /** Cuantas conversaciones hay vivas. Para pruebas y diagnostico. */
    public vivas(): number {
        this.limpiar();
        return this.sesiones.size;
    }

    /**
     * Quita las vencidas y, si aun sobra, las menos recientes.
     *
     * No hay temporizador: se limpia al usar el registro. Un
     * temporizador mantendria vivo el proceso sin necesidad y habria
     * que apagarlo al cerrar el servidor.
     */
    private limpiar(): void {

        const ahora = this.ahora();

        for (const [id, sesion] of this.sesiones) {
            if (ahora - sesion.usadaEn > this.vidaMs) {
                this.sesiones.delete(id);
            }
        }

        if (this.sesiones.size < this.maxSesiones) {
            return;
        }

        const porAntiguedad = [...this.sesiones.entries()]
            .sort((a, b) => a[1].usadaEn - b[1].usadaEn);

        const sobran = this.sesiones.size - this.maxSesiones + 1;

        for (const [id] of porAntiguedad.slice(0, sobran)) {
            this.sesiones.delete(id);
        }
    }
}
