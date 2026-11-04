import { GoogleGenAI } from "@google/genai";

import {
    LIMITE_RESPUESTA_MS,
    ModeloGemini,
    modeloGeminiConfigurado,
    traducirErrorGemini
} from "../adaptadores/modelo-gemini";
import { ErrorModeloLenguaje } from "./modelo-lenguaje";

/**
 * DIAGNOSTICO de Gemini para el chat:  npm run chat:diagnostico
 *
 * Responde, con la clave del .env y sin mostrarla nunca:
 *   1. si la clave esta configurada;
 *   2. que modelos de Gemini puede usar esa clave, y si el configurado
 *      (GEMINI_MODELO o el de omision) esta entre ellos;
 *   3. si una llamada REAL, con la misma configuracion del chat (una
 *      herramienta declarada, reintentos, limite local), responde, y en
 *      cuanto tiempo.
 *
 * Es la forma de comprobar que un modelo existe para la clave ANTES de
 * cambiar GEMINI_MODELO, y de distinguir "el modelo no existe" de "esta
 * saturado" o "la clave no sirve". Solo hace lecturas a Gemini: no toca
 * la cartera ni la base de datos.
 */

const VERDE = "\x1b[32m";
const AMARILLO = "\x1b[33m";
const ROJO = "\x1b[31m";
const GRIS = "\x1b[90m";
const FIN = "\x1b[0m";

const bien = (t: string) => console.log(`${VERDE}  ✓ ${t}${FIN}`);
const mal = (t: string) => console.log(`${ROJO}  ✗ ${t}${FIN}`);
const aviso = (t: string) => console.log(`${AMARILLO}  ! ${t}${FIN}`);
const nota = (t: string) => console.log(`${GRIS}    ${t}${FIN}`);

async function principal(): Promise<void> {

    console.log("\nDiagnostico de Gemini para el chat gerencial\n");

    const clave = process.env.GEMINI_API_KEY?.trim();
    if (!clave) {
        mal("Falta GEMINI_API_KEY en el .env.");
        process.exitCode = 1;
        return;
    }
    bien("GEMINI_API_KEY configurada (no se muestra).");

    const modelo = modeloGeminiConfigurado();
    nota(`Modelo configurado: ${modelo}${process.env.GEMINI_MODELO?.trim() ? " (GEMINI_MODELO)" : " (por omision)"}`);

    // 1. Modelos disponibles para la clave
    console.log("\n1. Modelos disponibles para esta clave");
    let disponibles: string[] = [];
    try {
        const ai = new GoogleGenAI({ apiKey: clave });
        const pagina = await ai.models.list({ config: { pageSize: 200, abortSignal: AbortSignal.timeout(30_000) } });
        for await (const m of pagina) {
            const acciones = m.supportedActions ?? [];
            const nombre = (m.name ?? "").replace(/^models\//, "");
            if (nombre && (acciones.length === 0 || acciones.includes("generateContent"))) {
                disponibles.push(nombre);
            }
        }
        disponibles = [...new Set(disponibles)].sort();
        bien(`${disponibles.length} modelos con generateContent.`);
    } catch (error) {
        const e = traducirErrorGemini(error, modelo, false, 30_000);
        mal(`No se pudo listar los modelos: ${e instanceof Error ? e.message : String(e)}`);
        if (e instanceof ErrorModeloLenguaje && e.motivo === "credencial") {
            process.exitCode = 1;
            return;
        }
    }

    if (disponibles.length > 0) {
        if (disponibles.includes(modelo)) {
            bien(`${modelo} esta disponible para esta clave.`);
        } else {
            mal(`${modelo} NO aparece entre los modelos de esta clave.`);
        }
        const flash = disponibles.filter(n => /^gemini-.*flash/.test(n));
        nota(`Modelos "flash" disponibles: ${flash.join(", ") || "(ninguno)"}`);
    }

    // 2. Llamada real con la configuracion del chat
    console.log(`\n2. Llamada real a ${modelo} con la configuracion del chat`);
    nota(`Reintentos del SDK ante 408/5xx; limite local ${LIMITE_RESPUESTA_MS / 1000} s; sin X-Server-Timeout.`);

    const inicio = Date.now();
    try {
        const turno = await new ModeloGemini(modelo, clave).responder(
            "Sos un asistente de prueba. Si te preguntan por la cartera, "
            + "llama a la herramienta consultar_cartera con fechaCorte 2026-10-31.",
            [{ papel: "usuario", texto: "¿Cuantos creditos hay en cartera?" }],
            [{
                nombre: "consultar_cartera",
                descripcion: "Estado de la cartera a una fecha de corte. Solo lectura.",
                esquema: {
                    type: "object",
                    properties: { fechaCorte: { type: "string", description: "AAAA-MM-DD" } },
                    required: ["fechaCorte"]
                }
            }]
        );
        const s = ((Date.now() - inicio) / 1000).toFixed(1);
        if (turno.tipo === "llamadas") {
            bien(`Respondio en ${s} s y eligio la herramienta: ${turno.llamadas.map(l => l.nombre).join(", ")}.`);
        } else {
            aviso(`Respondio en ${s} s, pero con texto y sin llamar a la herramienta: "${turno.texto.slice(0, 120)}"`);
        }
    } catch (error) {
        const s = ((Date.now() - inicio) / 1000).toFixed(1);
        if (error instanceof ErrorModeloLenguaje) {
            mal(`Fallo a los ${s} s · motivo: ${error.motivo}`);
            nota(error.message);
            if (error.motivo === "modelo_inexistente") {
                nota("Elija uno de la lista de arriba y pongalo en GEMINI_MODELO en el .env.");
            } else if (error.esTemporal()) {
                nota("Es una falla temporal del servicio: pruebe de nuevo en unos minutos o con otro modelo de la lista.");
            }
        } else {
            mal(`Fallo a los ${s} s: ${error instanceof Error ? error.message : String(error)}`);
        }
        process.exitCode = 1;
        return;
    }

    console.log(`\n${VERDE}Gemini responde con la configuracion del chat.${FIN}\n`);
}

principal().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
