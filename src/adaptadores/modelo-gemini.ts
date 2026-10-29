import { GoogleGenAI } from "@google/genai";
import type { Content, FunctionDeclaration, Part } from "@google/genai";

import type {
    DeclaracionHerramienta,
    Mensaje,
    ModeloLenguaje,
    TurnoModelo
} from "../asistente/modelo-lenguaje";
import { esErrorCuotaGemini } from "../rag/esErrorCuotaGemini";
import {
    esErrorTemporalGemini,
    reintentarGemini
} from "../rag/reintentarGemini";

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
            contenidos.push({
                role: "model",
                parts: mensaje.llamadas.map((llamada): Part => ({
                    functionCall: {
                        name: llamada.nombre,
                        args: llamada.argumentos
                    },
                    // La firma se devuelve TAL CUAL, sin mirarla. Gemini 3
                    // firma cada llamada que emite y la exige de vuelta en
                    // la ronda siguiente: sin ella responde 400
                    // INVALID_ARGUMENT y la conversacion se corta justo
                    // cuando el asistente iba por su segunda herramienta.
                    ...(llamada.firmaProveedor === undefined
                        ? {}
                        : { thoughtSignature: llamada.firmaProveedor })
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
 * Se leen las PARTES del candidato y no el atajo `functionCalls` del
 * SDK, porque ese atajo entrega el nombre y los argumentos pero pierde
 * la firma, y la firma hay que devolverla. El atajo queda como respaldo
 * para las respuestas que no traen partes.
 */
export function aTurno(respuesta: {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                functionCall?: { name?: string; args?: unknown };
                thoughtSignature?: string;
            }>;
        };
    }>;
    functionCalls?: Array<{ name?: string; args?: unknown }>;
    text?: string;
}): TurnoModelo {

    const partes = respuesta.candidates?.[0]?.content?.parts ?? [];

    const deLasPartes = partes
        .filter((parte) => typeof parte.functionCall?.name === "string")
        .map((parte) => ({
            nombre: parte.functionCall?.name as string,
            argumentos: (parte.functionCall?.args
                ?? {}) as Record<string, unknown>,
            ...(parte.thoughtSignature === undefined
                ? {}
                : { firmaProveedor: parte.thoughtSignature })
        }));

    const delAtajo = (respuesta.functionCalls ?? [])
        .filter((llamada) => typeof llamada.name === "string")
        .map((llamada) => ({
            nombre: llamada.name as string,
            argumentos: (llamada.args ?? {}) as Record<string, unknown>
        }));

    const llamadas = deLasPartes.length > 0 ? deLasPartes : delAtajo;

    if (llamadas.length > 0) {
        return { tipo: "llamadas", llamadas };
    }

    return { tipo: "texto", texto: respuesta.text ?? "" };
}

export class ModeloGemini implements ModeloLenguaje {

    public readonly nombre: string;

    private readonly cliente: GoogleGenAI;

    constructor(
        private readonly modelo: string = MODELO_POR_OMISION,
        claveApi: string | undefined = process.env.GEMINI_API_KEY
    ) {

        if (!claveApi?.trim()) {
            throw new Error(
                "Falta GEMINI_API_KEY para usar el modelo de lenguaje. "
                + "Vea .env.example."
            );
        }

        this.nombre = modelo;
        this.cliente = new GoogleGenAI({ apiKey: claveApi });
    }

    public async responder(
        instruccionesSistema: string,
        historial: ReadonlyArray<Mensaje>,
        herramientas: ReadonlyArray<DeclaracionHerramienta>
    ): Promise<TurnoModelo> {

        // El modelo compartido se sobrecarga (503 UNAVAILABLE) y la
        // cuota gratuita se agota por minuto (429). Las dos cosas son
        // transitorias y pasajeras, asi que se reintentan con espera
        // creciente en vez de contarse como una falla del asistente.
        const respuesta = await reintentarGemini(
            () => this.cliente.models.generateContent({
                model: this.modelo,
                contents: aContenidos(historial),
                config: {
                    systemInstruction: instruccionesSistema,
                    temperature: TEMPERATURA,
                    tools: [{
                        functionDeclarations: aDeclaraciones(herramientas)
                    }]
                }
            }),
            {
                maxIntentos: 5,
                esperaInicialMs: 2000,
                esReintentable: (error) =>
                    esErrorTemporalGemini(error)
                    || esErrorCuotaGemini(error)
            }
        );

        return aTurno(respuesta);
    }
}
