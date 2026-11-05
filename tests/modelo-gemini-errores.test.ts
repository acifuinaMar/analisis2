import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import {
    afterAll, afterEach, beforeAll, beforeEach, describe, expect, it
} from "vitest";

import {
    LIMITE_RESPUESTA_MS,
    ModeloGemini,
    REINTENTOS_GEMINI,
    traducirErrorGemini
} from "../src/adaptadores/modelo-gemini";
import { ErrorModeloLenguaje } from "../src/asistente/modelo-lenguaje";

/**
 * El adaptador de Gemini frente a las fallas reales del servicio.
 *
 * Corre el SDK de verdad (@google/genai) contra un servidor HTTP LOCAL
 * que imita a generativelanguage.googleapis.com: sin red ni clave real.
 * GOOGLE_GEMINI_BASE_URL es la variable con la que el propio SDK cambia
 * de servidor.
 *
 * Lo que se comprueba es lo que fallaba en la consola:
 *  - el SDK ya no manda X-Server-Timeout (que provocaba el 504);
 *  - los 503 se reintentan solos y, si persisten, se informan como
 *    "saturado" en vez de tumbar el chat;
 *  - lo que no se arregla esperando (404, 429, 401) no se reintenta.
 */

type Respuesta = { estado: number; cuerpo: unknown; demoraMs?: number };

const PREGUNTA = [{ papel: "usuario" as const, texto: "¿Cuantos creditos hay?" }];
const CATALOGO = [{
    nombre: "consultar_cartera",
    descripcion: "Estado de la cartera.",
    esquema: { type: "object", properties: { fechaCorte: { type: "string" } }, required: ["fechaCorte"] }
}];

const OK = {
    estado: 200,
    cuerpo: { candidates: [{ content: { role: "model", parts: [{ text: "Hay 66 creditos." }] }, finishReason: "STOP" }] }
};
const error = (estado: number, status: string, message: string): Respuesta =>
    ({ estado, cuerpo: { error: { code: estado, message, status } } });
const E503 = error(503, "UNAVAILABLE", "The model is overloaded. Please try again later.");
const E504 = error(504, "DEADLINE_EXCEEDED", "Deadline expired before operation could complete.");

/** Reintentos con esperas de milisegundos, para que las pruebas sean rapidas. */
const RAPIDO = { ...REINTENTOS_GEMINI, initialDelay: 0.01, maxDelay: 0.02 };

let servidor: Server;
let guion: Respuesta[] = [];
let recibidas: IncomingHttpHeaders[] = [];
let baseAnterior: string | undefined;

/**
 * UN SERVIDOR POR PRUEBA, en un puerto nuevo cada vez.
 *
 * Compartir un servidor entre las pruebas de este archivo las volvia
 * inestables, y de la forma mas enganosa: una prueba que aborta o que
 * reintenta deja peticiones en vuelo, y esas rezagadas aterrizaban en
 * el `recibidas` de la prueba SIGUIENTE, que entonces fallaba por algo
 * que no hizo. Cerrar las conexiones no alcanzaba, porque una peticion
 * ya encolada llega igual.
 *
 * Con un puerto nuevo por prueba el problema desaparece por
 * construccion: la rezagada no tiene a donde llegar. Levantar y cerrar
 * un servidor local cuesta milisegundos.
 *
 * Importa porque el enunciado pide que `npm test` pase EN CAMARA
 * durante el video, y estas fallaban solo cuando la maquina estaba
 * cargada —grabando, por ejemplo—.
 */
beforeEach(async () => {
    guion = [];
    recibidas = [];
    servidor = createServer((req, res) => {
        req.resume();
        req.on("end", () => {
            recibidas.push(req.headers);
            const r = guion.length > 1 ? guion.shift()! : guion[0]!;
            const responder = () => {
                if (res.destroyed) return;
                res.writeHead(r.estado, { "content-type": "application/json" });
                res.end(JSON.stringify(r.cuerpo));
            };
            if (r.demoraMs) setTimeout(responder, r.demoraMs);
            else responder();
        });
    });
    await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
    process.env.GOOGLE_GEMINI_BASE_URL =
        `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

afterEach(async () => {
    servidor.closeAllConnections();
    await new Promise<void>((ok) => servidor.close(() => ok()));
});

beforeAll(() => {
    baseAnterior = process.env.GOOGLE_GEMINI_BASE_URL;
});

afterAll(() => {
    if (baseAnterior === undefined) delete process.env.GOOGLE_GEMINI_BASE_URL;
    else process.env.GOOGLE_GEMINI_BASE_URL = baseAnterior;
});

function modelo(opciones: ConstructorParameters<typeof ModeloGemini>[2] = {}) {
    return new ModeloGemini("gemini-3.8-flash", "clave-de-prueba", { reintentos: RAPIDO, ...opciones });
}

async function fallaCon(promesa: Promise<unknown>): Promise<ErrorModeloLenguaje> {
    try {
        await promesa;
    } catch (e) {
        if (e instanceof ErrorModeloLenguaje) return e;
        throw new Error(`Se esperaba ErrorModeloLenguaje y llego: ${String(e)}`);
    }
    throw new Error("Se esperaba un error y la llamada respondio.");
}

describe("Adaptador Gemini - la causa del 504", () => {

    it("No envia X-Server-Timeout: el servidor no corta la generacion a los 30 s", async () => {
        guion = [OK];
        const turno = await modelo().responder("instrucciones", PREGUNTA, CATALOGO);

        expect(turno).toEqual({ tipo: "texto", texto: "Hay 66 creditos." });
        expect(recibidas).toHaveLength(1);
        expect(recibidas[0]!["x-server-timeout"]).toBeUndefined();
    });

    it("El limite local es generoso y los reintentos cubren solo fallas temporales", () => {
        expect(LIMITE_RESPUESTA_MS).toBeGreaterThanOrEqual(60_000);
        expect(REINTENTOS_GEMINI.httpStatusCodes).toEqual([408, 500, 502, 503, 504]);
        expect(REINTENTOS_GEMINI.httpStatusCodes).not.toContain(429);
    });
});

describe("Adaptador Gemini - thought signatures con el SDK real", () => {

    it("La firma que manda el servidor vuelve en la siguiente peticion", async () => {
        const llamada = {
            estado: 200,
            cuerpo: { candidates: [{ content: { role: "model", parts: [
                { functionCall: { name: "consultar_cartera", args: { fechaCorte: "2026-10-31" } }, thoughtSignature: "RklSTUEtREUtUFJVRUJB" }
            ] }, finishReason: "STOP" }] }
        };
        const cuerpos: unknown[] = [];
        guion = [llamada, OK];
        const m = modelo();

        const turno = await m.responder("instrucciones", PREGUNTA, CATALOGO);
        if (turno.tipo !== "llamadas") throw new Error("deberia ser llamadas");
        expect(turno.llamadas[0]!.firma).toBe("RklSTUEtREUtUFJVRUJB");

        // Segunda vuelta: el historial con la llamada y su resultado.
        servidor.prependOnceListener("request", (req) => {
            let datos = "";
            req.on("data", (c: Buffer) => (datos += c));
            req.on("end", () => cuerpos.push(JSON.parse(datos)));
        });
        await m.responder("instrucciones", [
            ...PREGUNTA,
            { papel: "asistente_llama", llamadas: turno.llamadas },
            { papel: "resultado", nombre: "consultar_cartera", contenido: "{\"creditosActivos\":66}" }
        ], CATALOGO);

        const enviado = cuerpos[0] as { contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> };
        expect(enviado.contents[1]!.role).toBe("model");
        expect(enviado.contents[1]!.parts[0]!.thoughtSignature).toBe("RklSTUEtREUtUFJVRUJB");
    });
});

describe("Adaptador Gemini - fallas temporales", () => {

    it("Dos 503 seguidos se reintentan solos y la pregunta se responde", async () => {
        guion = [E503, E503, OK];
        const turno = await modelo().responder("instrucciones", PREGUNTA, CATALOGO);

        expect(turno.tipo).toBe("texto");
        expect(recibidas).toHaveLength(3);
    });

    it("Un 503 persistente se informa como 'saturado' tras agotar los intentos", async () => {
        guion = [E503];
        const e = await fallaCon(modelo().responder("instrucciones", PREGUNTA, CATALOGO));

        expect(e.motivo).toBe("saturado");
        expect(e.estadoHttp).toBe(503);
        expect(e.esTemporal()).toBe(true);
        expect(recibidas).toHaveLength(RAPIDO.attempts!);
    });

    it("Un 504 persistente se informa como 'tiempo_agotado'", async () => {
        guion = [E504];
        const e = await fallaCon(modelo().responder("instrucciones", PREGUNTA, CATALOGO));

        expect(e.motivo).toBe("tiempo_agotado");
        expect(recibidas).toHaveLength(RAPIDO.attempts!);
    });

    it("Si el modelo no responde dentro del limite local, se corta: 'tiempo_agotado'", async () => {
        guion = [{ ...OK, demoraMs: 2_000 }];
        const inicio = Date.now();
        const e = await fallaCon(modelo({ limiteMs: 200 }).responder("instrucciones", PREGUNTA, CATALOGO));

        expect(e.motivo).toBe("tiempo_agotado");
        expect(Date.now() - inicio).toBeLessThan(1_500);
    });

    it("Cancelar la sesion corta la consulta en curso: 'cancelado', sin reintentar", async () => {
        // El servidor demora diez segundos y se corta a los cien
        // milisegundos. El margen lo da la DISTANCIA entre las dos
        // cifras y no una tolerancia apretada: con la demora en dos
        // segundos y el limite en uno y medio, la prueba fallaba bajo
        // carga aunque el aborto hubiera funcionado bien.
        guion = [{ ...OK, demoraMs: 10_000 }];
        const sesion = new AbortController();
        setTimeout(() => sesion.abort(), 100);
        const inicio = Date.now();
        const e = await fallaCon(modelo({ senal: sesion.signal }).responder("instrucciones", PREGUNTA, CATALOGO));

        expect(e.motivo).toBe("cancelado");
        expect(Date.now() - inicio).toBeLessThan(2_000);
        expect(recibidas).toHaveLength(1);
    });

    it("Sin servidor que responda, el motivo es 'red'", async () => {
        const anterior = process.env.GOOGLE_GEMINI_BASE_URL;
        process.env.GOOGLE_GEMINI_BASE_URL = "http://127.0.0.1:9";
        try {
            const e = await fallaCon(modelo().responder("instrucciones", PREGUNTA, CATALOGO));
            expect(e.motivo).toBe("red");
        } finally {
            process.env.GOOGLE_GEMINI_BASE_URL = anterior;
        }
    });
});

describe("Adaptador Gemini - lo que no se arregla esperando no se reintenta", () => {

    it("404: el modelo no existe para la clave, un solo intento", async () => {
        guion = [error(404, "NOT_FOUND", "models/gemini-3.8-flash is not found for API version v1beta")];
        const e = await fallaCon(modelo().responder("instrucciones", PREGUNTA, CATALOGO));

        expect(e.motivo).toBe("modelo_inexistente");
        expect(e.esTemporal()).toBe(false);
        expect(recibidas).toHaveLength(1);
    });

    /**
     * La cuota POR MINUTO si se espera.
     *
     * Son quince peticiones por minuto y se libera en segundos. La que
     * topa en una conversacion encadenada es esta, no la diaria: ocho
     * consultas con herramientas pasan de quince en un minuto sin
     * esfuerzo. El servidor manda su retryDelay y esperarlo es lo
     * correcto; lo descubrio el ensayo del video, donde seis casos
     * murieron por una cuota que se iba a liberar sola.
     */
    it("429 con retryDelay corto: se espera y se reintenta", async () => {
        guion = [
            {
                estado: 429,
                cuerpo: {
                    error: {
                        code: 429,
                        status: "RESOURCE_EXHAUSTED",
                        message: "Quota exceeded",
                        details: [{
                            "@type": "type.googleapis.com/google.rpc.RetryInfo",
                            retryDelay: "1s"
                        }]
                    }
                }
            },
            OK
        ];

        const turno = await modelo().responder("instrucciones", PREGUNTA, CATALOGO);

        expect(turno).toEqual({ tipo: "texto", texto: "Hay 66 creditos." });
        expect(recibidas).toHaveLength(2);
    });

    it("429: cuota agotada, un solo intento", async () => {
        guion = [error(429, "RESOURCE_EXHAUSTED", "Quota exceeded")];
        const e = await fallaCon(modelo().responder("instrucciones", PREGUNTA, CATALOGO));

        expect(e.motivo).toBe("cuota");
        expect(recibidas).toHaveLength(1);
    });

    it("400 por clave invalida: 'credencial', sin repetir la clave en el mensaje", async () => {
        guion = [error(400, "INVALID_ARGUMENT", "API key not valid. Please pass a valid API key.")];
        const e = await fallaCon(modelo().responder("instrucciones", PREGUNTA, CATALOGO));

        expect(e.motivo).toBe("credencial");
        expect(e.message).not.toContain("clave-de-prueba");
        expect(recibidas).toHaveLength(1);
    });
});

describe("Adaptador Gemini - traduccion de errores (sin red)", () => {

    const aborto = Object.assign(new Error("This operation was aborted"), { name: "AbortError" });

    it("Un aborto es 'cancelado' si la sesion se cancelo, 'tiempo_agotado' si no", () => {
        const cancelado = traducirErrorGemini(aborto, "m", true, 1000) as ErrorModeloLenguaje;
        const tiempo = traducirErrorGemini(aborto, "m", false, 1000) as ErrorModeloLenguaje;

        expect(cancelado.motivo).toBe("cancelado");
        expect(tiempo.motivo).toBe("tiempo_agotado");
    });

    it("Lee el codigo por forma, aunque el error no sea instancia de ApiError", () => {
        const e = traducirErrorGemini({ status: 503, message: "{}" }, "m", false, 1000) as ErrorModeloLenguaje;
        expect(e.motivo).toBe("saturado");
    });

    it("Un error ajeno al proveedor se deja pasar tal cual", () => {
        const ajeno = new RangeError("otra cosa");
        expect(traducirErrorGemini(ajeno, "m", false, 1000)).toBe(ajeno);
    });
});
