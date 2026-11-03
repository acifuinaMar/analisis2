import { GoogleGenAI } from "@google/genai";
import type { Content, FunctionDeclaration, HttpRetryOptions, Part } from "@google/genai";

import { estadoHttpGemini } from "../asistente/es-error-gemini-saturado";
import {
    ErrorModeloLenguaje,
    type DeclaracionHerramienta,
    type Mensaje,
    type ModeloLenguaje,
    type TurnoModelo
} from "../asistente/modelo-lenguaje";

/**
 * ADAPTADOR del puerto ModeloLenguaje sobre Google Gemini.
 *
 * Es el unico lugar del chat que conoce el formato del proveedor. La
 * traduccion esta separada en funciones puras —`aContenidos` y
 * `aDeclaraciones`— para poder probarla sin clave de API ni red: lo que
 * se puede verificar sin llamar al modelo, se verifica.
 *
 * El modelo es el mismo que usa el modulo RAG del E4, para no sostener
 * dos proveedores por un sistema.
 */

export const MODELO_POR_OMISION = "gemini-3.8-flash";

/**
 * El modelo que se usa: GEMINI_MODELO del .env o, si no esta, el de
 * omision. Permite cambiar de modelo sin tocar codigo (por ejemplo, si
 * uno esta saturado), despues de comprobar con `npm run chat:diagnostico`
 * que el nuevo existe para la clave. Lo comparten el chat y el RAG.
 */
export function modeloGeminiConfigurado(): string {
    return process.env.GEMINI_MODELO?.trim() || MODELO_POR_OMISION;
}

/**
 * Cuanto puede tardar, COMO MAXIMO, una respuesta del modelo, contando
 * los reintentos. Es un limite LOCAL: corta la espera en la consola.
 *
 * A proposito NO se usa `httpOptions.timeout` del SDK: ademas del limite
 * local, ese valor viaja al servidor en el encabezado X-Server-Timeout, y
 * Google corta la generacion a esos segundos con un
 * 504 DEADLINE_EXCEEDED. Con 30 s, cualquier respuesta lenta (un modelo
 * que razona antes de elegir herramienta, o un momento de alta demanda)
 * se convertia en un error. Sin ese encabezado, el servidor usa su propio
 * plazo (unos 10 minutos) y aqui se decide cuanto esperar.
 */
export const LIMITE_RESPUESTA_MS = 120_000;

/**
 * Reintentos del propio SDK (p-retry con espera exponencial y jitter).
 * Solo para fallas TEMPORALES del servicio: 408, 500, 502, 503 y 504.
 *
 * No incluye 429: una cuota agotada no se arregla esperando unos
 * segundos, y reintentarla solo gasta mas cuota. Tampoco 400/401/403/404:
 * un error de la peticion, de la clave o del modelo se repite igual.
 */
export const REINTENTOS_GEMINI: Readonly<HttpRetryOptions> = {
    attempts: 4,
    initialDelay: 2,
    maxDelay: 16,
    httpStatusCodes: [408, 500, 502, 503, 504]
};

export interface OpcionesModeloGemini {
    /** Limite local por respuesta, reintentos incluidos. */
    readonly limiteMs?: number;
    /** Reintentos del SDK; en las pruebas se acortan las esperas. */
    readonly reintentos?: Readonly<HttpRetryOptions>;
    /**
     * Senal de la SESION: al abortarla (Ctrl+C, cierre del chat) se corta
     * la peticion en curso y no se reintenta.
     */
    readonly senal?: AbortSignal;
}

/**
 * Temperatura baja a proposito. Aqui no se busca variedad: se busca que
 * elija la herramienta correcta y repita la cifra que la herramienta
 * devolvio, sin adornarla.
 */
const TEMPERATURA = 0.1;

/**
 * Pasa el historial propio al formato de Gemini.
 *
 * Los resultados de herramienta van con papel de usuario, que es como el
 * proveedor espera recibirlos: para el modelo son informacion que llega
 * de fuera, no algo que el dijo.
 */
export function aContenidos(
    historial: ReadonlyArray<Mensaje>
): Content[] {

    const contenidos: Content[] = [];

    for (const mensaje of historial) {

        if (mensaje.papel === "usuario") {
            contenidos.push({
                role: "user",
                parts: [{ text: mensaje.texto }]
            });
            continue;
        }

        if (mensaje.papel === "asistente") {
            contenidos.push({
                role: "model",
                parts: [{ text: mensaje.texto }]
            });
            continue;
        }

        if (mensaje.papel === "asistente_llama") {
            // Cada llamada vuelve con su firma (thought signature), en el
            // mismo orden en que el modelo las emitio. Gemini 3 exige la
            // firma en las llamadas del turno en curso: sin ella responde
            // 400 "Function call is missing a thought_signature".
            contenidos.push({
                role: "model",
                parts: mensaje.llamadas.map((llamada): Part => ({
                    functionCall: {
                        name: llamada.nombre,
                        args: llamada.argumentos
                    },
                    ...(llamada.firma ? { thoughtSignature: llamada.firma } : {})
                }))
            });
            continue;
        }

        contenidos.push({
            role: "user",
            parts: [{
                functionResponse: {
                    name: mensaje.nombre,
                    response: comoObjeto(mensaje.contenido)
                }
            }]
        });
    }

    return contenidos;
}

/**
 * La respuesta de una herramienta tiene que llegar como objeto. Si no es
 * JSON, se envuelve en vez de descartarse: un error en texto plano
 * tambien es informacion que el modelo debe poder explicar.
 */
function comoObjeto(contenido: string): Record<string, unknown> {

    try {
        const valor = JSON.parse(contenido) as unknown;

        if (valor && typeof valor === "object" && !Array.isArray(valor)) {
            return valor as Record<string, unknown>;
        }

        return { resultado: valor };
    } catch {
        return { resultado: contenido };
    }
}

/**
 * Pasa el catalogo al formato de Gemini.
 *
 * El esquema viaja como JSON Schema tal cual: el servidor MCP ya lo
 * publica asi desde los esquemas Zod, de modo que no hay una segunda
 * definicion que se pueda desfasar. Solo se quita `$schema`, que es
 * metadato del documento y no describe ningun parametro.
 */
export function aDeclaraciones(
    herramientas: ReadonlyArray<DeclaracionHerramienta>
): FunctionDeclaration[] {

    return herramientas.map((herramienta) => ({
        name: herramienta.nombre,
        description: herramienta.descripcion,
        parametersJsonSchema: sinMetadatos(herramienta.esquema)
    }));
}

function sinMetadatos(
    esquema: Record<string, unknown>
): Record<string, unknown> {

    const copia: Record<string, unknown> = {};

    for (const [clave, valor] of Object.entries(esquema)) {
        if (clave !== "$schema") {
            copia[clave] = valor;
        }
    }

    return copia;
}

/**
 * Lee el turno que devolvio Gemini en el vocabulario del puerto.
 *
 * Las llamadas se leen de las PARTES del candidato y no del atajo
 * `respuesta.functionCalls`: ese atajo devuelve solo nombre y argumentos y
 * pierde la `thoughtSignature` que viaja en la misma parte, que hay que
 * reenviar (ver aContenidos). Si no hay partes (respuestas armadas a mano
 * en las pruebas), se usa el atajo.
 */
export function aTurno(respuesta: {
    candidates?: Array<{ content?: { parts?: Part[] } }>;
    functionCalls?: Array<{ name?: string; args?: unknown }>;
    text?: string;
}): TurnoModelo {

    const partes = respuesta.candidates?.[0]?.content?.parts;

    const crudas: Array<{ name?: string; args?: unknown; firma?: string }> = partes?.length
        ? partes
            .filter((parte) => parte.functionCall)
            .map((parte) => ({
                name: parte.functionCall!.name,
                args: parte.functionCall!.args,
                firma: parte.thoughtSignature
            }))
        : (respuesta.functionCalls ?? []);

    const llamadas = crudas
        .filter((llamada) => typeof llamada.name === "string")
        .map((llamada) => ({
            nombre: llamada.name as string,
            argumentos: (llamada.args ?? {}) as Record<string, unknown>,
            ...(llamada.firma ? { firma: llamada.firma } : {})
        }));

    if (llamadas.length > 0) {
        return { tipo: "llamadas", llamadas };
    }

    return { tipo: "texto", texto: respuesta.text ?? "" };
}

/** Si el error es la cancelacion de un fetch (AbortSignal). */
function esAborto(error: unknown): boolean {
    const nombre = (error as { name?: unknown } | null)?.name;
    return nombre === "AbortError" || nombre === "TimeoutError";
}

/** Si el error es de red: no hubo respuesta HTTP del proveedor. */
function esErrorDeRed(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }
    const causa = (error as { cause?: { code?: unknown } }).cause;
    const codigo = typeof causa?.code === "string" ? causa.code : "";
    return error.message === "fetch failed"
        || ["ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN",
            "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT"].includes(codigo);
}

/**
 * Traduce un error del SDK de Gemini a un ErrorModeloLenguaje.
 *
 * `cancelada` dice si la sesion se cancelo: un aborto puede venir de la
 * persona (Ctrl+C) o del limite local, y se reportan distinto. El mensaje
 * del proveedor se conserva como detalle; nunca contiene la clave.
 */
export function traducirErrorGemini(
    error: unknown,
    modelo: string,
    cancelada: boolean,
    limiteMs: number
): unknown {

    if (error instanceof ErrorModeloLenguaje) {
        return error;
    }

    if (esAborto(error)) {
        return cancelada
            ? new ErrorModeloLenguaje("cancelado", "Se cancelo la consulta al modelo.", undefined, { cause: error })
            : new ErrorModeloLenguaje(
                "tiempo_agotado",
                `El modelo ${modelo} no respondio en ${Math.round(limiteMs / 1000)} s.`,
                undefined,
                { cause: error }
            );
    }

    const estado = estadoHttpGemini(error);
    const detalle = error instanceof Error ? error.message : String(error);

    if (estado !== undefined) {
        if (estado === 503 || estado === 500 || estado === 502) {
            return new ErrorModeloLenguaje("saturado", `Gemini esta saturado (${estado}): ${detalle}`, estado, { cause: error });
        }
        if (estado === 504 || estado === 408) {
            return new ErrorModeloLenguaje("tiempo_agotado", `Gemini no termino a tiempo (${estado}): ${detalle}`, estado, { cause: error });
        }
        if (estado === 429) {
            return new ErrorModeloLenguaje("cuota", `Se agoto la cuota de la clave (429): ${detalle}`, estado, { cause: error });
        }
        if (estado === 401 || estado === 403 || /API key|API_KEY/i.test(detalle)) {
            return new ErrorModeloLenguaje("credencial", `La clave de Gemini no es valida o no tiene permiso (${estado}).`, estado, { cause: error });
        }
        if (estado === 404) {
            return new ErrorModeloLenguaje("modelo_inexistente", `El modelo ${modelo} no esta disponible para esta clave (404).`, estado, { cause: error });
        }
        return new ErrorModeloLenguaje("rechazo", `Gemini rechazo la peticion (${estado}): ${detalle}`, estado, { cause: error });
    }

    if (esErrorDeRed(error)) {
        return new ErrorModeloLenguaje("red", "No hubo conexion con Gemini.", undefined, { cause: error });
    }

    return error;
}

export class ModeloGemini implements ModeloLenguaje {

    public readonly nombre: string;

    private readonly cliente: GoogleGenAI;

    private readonly limiteMs: number;

    private readonly senal: AbortSignal | undefined;

    constructor(
        private readonly modelo: string = modeloGeminiConfigurado(),
        claveApi: string | undefined = process.env.GEMINI_API_KEY,
        opciones: OpcionesModeloGemini = {}
    ) {

        if (!claveApi?.trim()) {
            throw new Error(
                "Falta GEMINI_API_KEY para usar el modelo de lenguaje. "
                + "Vea .env.example."
            );
        }

        this.nombre = modelo;
        this.limiteMs = opciones.limiteMs ?? LIMITE_RESPUESTA_MS;
        this.senal = opciones.senal;

        // Sin `timeout`: ver LIMITE_RESPUESTA_MS. Los reintentos de fallas
        // temporales los hace el SDK, con espera exponencial.
        this.cliente = new GoogleGenAI({
            apiKey: claveApi,
            httpOptions: {
                retryOptions: { ...(opciones.reintentos ?? REINTENTOS_GEMINI) }
            }
        });
    }

    public async responder(
        instruccionesSistema: string,
        historial: ReadonlyArray<Mensaje>,
        herramientas: ReadonlyArray<DeclaracionHerramienta>
    ): Promise<TurnoModelo> {

        // Limite local de esta respuesta + cancelacion de la sesion. Ninguna
        // de las dos viaja al servidor. Con la senal abortada, el SDK deja
        // de reintentar.
        const senales = [AbortSignal.timeout(this.limiteMs)];
        if (this.senal) {
            senales.push(this.senal);
        }

        try {
            const respuesta = await this.cliente.models.generateContent({
                model: this.modelo,
                contents: aContenidos(historial),
                config: {
                    systemInstruction: instruccionesSistema,
                    temperature: TEMPERATURA,
                    tools: [{ functionDeclarations: aDeclaraciones(herramientas) }],
                    abortSignal: AbortSignal.any(senales)
                }
            });

            return aTurno(respuesta);
        } catch (error) {
            throw traducirErrorGemini(error, this.modelo, this.senal?.aborted ?? false, this.limiteMs);
        }
    }
}
