import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
    InMemoryTransport
} from "@modelcontextprotocol/sdk/inMemory.js";

import { PERFILES, type Perfil } from "../acceso/perfil";
import {
    RepositorioCarteraCsv
} from "../adaptadores/repositorio-cartera-csv";
import {
    RepositorioCarteraPostgres
} from "../adaptadores/repositorio-cartera-postgres";
import { ModeloGemini } from "../adaptadores/modelo-gemini";
import { abrirBaseDatos } from "../persistencia/base-datos";
import { RepositorioCartera } from "../dominio/repositorio-cartera";
import { crearServidorMcp } from "../mcp/servidor-mcp";
import { responderPregunta } from "../rag/responderPregunta";
import { HerramientasMcp } from "./herramientas-mcp";
import { crearLector } from "./lector-lineas";
import { ErrorTrasAplicarPago, Orquestador, type RespuestaChat } from "./orquestador";
import { ErrorModeloLenguaje, type ConsultaDocumental } from "./modelo-lenguaje";

/**
 * ARNES DE CONSOLA del chat gerencial.
 *
 *   npm run chat            sobre PostgreSQL, si hay DATABASE_URL
 *   npm run chat -- --csv   sobre el paquete en archivos
 *
 * OJO: esto NO es el entregable del E5, que pide el chat dentro de la
 * misma aplicacion del E1 y no una terminal. Es la herramienta con la que
 * se maneja y se demuestra el orquestador mientras la interfaz se
 * construye, y la que deja comprobar que las consultas G-1 a G-7 se
 * responden con las cifras del nucleo.
 *
 * La pantalla del E1 consumira el MISMO Orquestador: la logica del chat
 * -elegir herramienta, recordar la conversacion, detener el pago hasta
 * que alguien lo apruebe- no vive aqui, vive en el orquestador. Esta
 * clase solo pinta y pregunta.
 *
 * Errores y cierre:
 *  - Un fallo del modelo (saturado, sin respuesta a tiempo, sin cuota...)
 *    NO detiene el chat: se explica y se sigue. El orquestador deshace la
 *    pregunta fallida, asi que la conversacion queda como estaba.
 *  - El proceso termina SOLO, cuando ya no queda nada abierto: nunca con
 *    process.exit() en el camino normal ni en el de error. Llamarlo justo
 *    despues de cerrar la consola, con la entrada estandar todavia
 *    cerrandose, es lo que en Windows aborta Node con
 *    "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)".
 */

const AZUL = "\x1b[36m";
const VERDE = "\x1b[32m";
const AMARILLO = "\x1b[33m";
const GRIS = "\x1b[90m";
const FIN = "\x1b[0m";

function repositorio(): {
    repo: RepositorioCartera;
    donde: string;
    cerrar: () => Promise<void>;
} {

    const url = process.env.DATABASE_URL?.trim();

    if (!process.argv.includes("--csv") && url) {
        const db = abrirBaseDatos();
        return {
            repo: new RepositorioCarteraPostgres(db),
            donde: "PostgreSQL",
            cerrar: async () => {
                await db.cerrar?.();
            }
        };
    }

    const dir = process.env.CV_DATA_DIR?.trim();

    if (!dir) {
        throw new Error(
            "Falta DATABASE_URL o CV_DATA_DIR. Vea .env.example."
        );
    }

    return {
        repo: new RepositorioCarteraCsv(dir),
        donde: "paquete canonico en archivos",
        cerrar: async () => {}
    };
}

/** El modulo del E4, visto por el chat como consulta documental. */
const documental: ConsultaDocumental = {
    consultar: async (pregunta) => {
        const r = await responderPregunta(pregunta);
        return {
            respuesta: r.respuesta,
            fuentes: r.fuentesRecuperadas.map((f) => f.id)
        };
    }
};

function money(valor: unknown): string {
    return typeof valor === "number" ? `Q${valor.toFixed(2)}` : String(valor);
}

/** Pinta el desglose de la prelacion antes de pedir la aprobacion. */
function mostrarPropuesta(previa: Record<string, unknown>): void {

    const d = (previa.desglosePrelacion ?? {}) as Record<string, unknown>;
    const antes = (previa.estadoAntes ?? {}) as Record<string, unknown>;

    console.log(`\n${AMARILLO}  APROBACION REQUERIDA${FIN}`);
    console.log(`${GRIS}  ${"-".repeat(52)}${FIN}`);
    console.log(`  Credito          ${previa.idCredito}`);
    console.log(`  Cliente          ${previa.nombreCliente}`);
    console.log(`  Fecha            ${previa.fechaOperacion}`);
    console.log(`  Clave            ${previa.claveIdempotencia}`);
    console.log(
        `  Cuotas           ${(previa.cuotasCubiertas as number[] ?? [])
            .join(", ")}`
    );
    console.log(`${GRIS}  ${"-".repeat(52)}${FIN}`);
    console.log(`  Gastos de gestion    ${money(d.gastos).padStart(12)}`);
    console.log(`  Interes moratorio    ${money(d.interesMoratorio).padStart(12)}`);
    console.log(`  Interes corriente    ${money(d.interesCorriente).padStart(12)}`);
    console.log(`  Capital              ${money(d.capital).padStart(12)}`);
    console.log(`${GRIS}  ${"-".repeat(52)}${FIN}`);
    console.log(`  TOTAL                ${money(d.total).padStart(12)}`);
    console.log(
        `${GRIS}  Estado actual: ${antes.estado} · ${antes.diasAtraso} dias `
        + `· saldo ${money(antes.saldoCapital)}${FIN}`
    );
}

/**
 * El perfil con el que se abre el chat: `-- --perfil asesor`.
 *
 * Por omision GERENCIA, que es el perfil del chat gerencial y tambien el
 * que menos puede: si alguien olvida la bandera, el chat queda en solo
 * consulta. Equivocarse hacia el lado que no mueve dinero.
 */
function perfilPedido(): Perfil {

    const i = process.argv.indexOf("--perfil");
    const pedido = i >= 0 ? process.argv[i + 1] : undefined;

    if (pedido === undefined) {
        return "gerencia";
    }

    if (!(PERFILES as readonly string[]).includes(pedido)) {
        throw new Error(
            `El perfil '${pedido}' no existe. Use ${PERFILES.join(" o ")}.`
        );
    }

    return pedido as Perfil;
}

/**
 * Lo que se le dice a la persona cuando el modelo no pudo responder. El
 * motivo lo decide el adaptador; aqui solo se elige el texto.
 */
function explicarErrorModelo(error: ErrorModeloLenguaje): string {
    switch (error.motivo) {
        case "saturado":
            return "Gemini esta saturado en este momento (se reintento varias veces). "
                + "Vuelva a preguntar en un minuto; la conversacion se conserva.";
        case "tiempo_agotado":
            return "Gemini no respondio a tiempo. Vuelva a preguntar; la conversacion se conserva.";
        case "red":
            return "No hubo conexion con Gemini. Revise la conexion a internet y vuelva a preguntar.";
        case "cuota":
            return "Se agoto la cuota de la clave de Gemini. Espere a que se renueve o use otra clave.";
        case "credencial":
            return "La clave GEMINI_API_KEY no es valida o no tiene permiso. "
                + "Revisela y compruebe con: npm run chat:diagnostico";
        case "modelo_inexistente":
            return `${error.message} Compruebe que modelos tiene disponibles con: npm run chat:diagnostico`;
        case "cancelado":
            return "Consulta cancelada.";
        case "rechazo":
        default:
            return error.message;
    }
}

async function principal(): Promise<void> {

    if (!process.env.GEMINI_API_KEY?.trim()) {
        throw new Error(
            "Falta GEMINI_API_KEY en el .env: el chat necesita un modelo "
            + "de lenguaje.\nVea .env.example."
        );
    }

    const perfil = perfilPedido();

    const { repo, donde, cerrar } = repositorio();

    const servidor = crearServidorMcp(repo);
    const [aCliente, aServidor] = InMemoryTransport.createLinkedPair();
    const cliente = new Client({ name: "chat-gerencial", version: "1.0.0" });

    // Senal de la sesion: al salir (o con Ctrl+C) corta la consulta en
    // curso y el SDK deja de reintentar.
    const sesion = new AbortController();

    const modelo = new ModeloGemini(undefined, undefined, { senal: sesion.signal });

    const consola = createInterface({ input: stdin, output: stdout });
    const leer = crearLector(consola);

    // Ctrl+C: salir con orden. Se cancela la consulta en curso y se cierra
    // la consola; el ciclo termina y el bloque finally cierra el resto.
    // Si una espera entre reintentos del SDK demora la salida, se fuerza
    // a los pocos segundos, ya con la consola cerrada del todo.
    consola.on("SIGINT", () => {
        console.log(`\n${GRIS}  (saliendo...)${FIN}`);
        sesion.abort();
        consola.close();
        setTimeout(() => process.exit(130), 5_000).unref();
    });

    try {
        await Promise.all([
            servidor.connect(aServidor),
            cliente.connect(aCliente)
        ]);

        const chat = new Orquestador(
            modelo,
            new HerramientasMcp(cliente),
            perfil,
            documental
        );

        console.log(`\n${AZUL}Credito Vecino - chat gerencial${FIN}`);
        console.log(`${GRIS}Cartera: ${donde} · Modelo: ${modelo.nombre}${FIN}`);
        console.log(
            `${GRIS}Perfil: ${perfil}`
            + `${chat.puedeAprobar() ? "" : " (consulta; no registra pagos)"}`
            + `${FIN}`
        );
        console.log(
            `${GRIS}Escriba su pregunta. "salir" termina, "nueva" empieza de `
            + `cero.${FIN}\n`
        );

        /**
         * Corre una accion del orquestador. Si el modelo falla, lo explica
         * y devuelve undefined para seguir con la siguiente pregunta.
         */
        const turno = async (
            accion: () => Promise<RespuestaChat>
        ): Promise<RespuestaChat | undefined> => {
            try {
                return await accion();
            } catch (error) {
                if (error instanceof ErrorTrasAplicarPago) {
                    console.log(
                        `\n${AMARILLO}El pago del credito ${error.idCredito} YA se proceso; `
                        + `lo que fallo fue la redaccion de la respuesta. NO lo vuelva a aprobar.${FIN}`
                    );
                    console.log(`${GRIS}  Resultado del nucleo: ${error.resultado}${FIN}`);
                    const causa = error.cause;
                    if (causa instanceof ErrorModeloLenguaje) {
                        console.log(`${GRIS}  (${explicarErrorModelo(causa)})${FIN}\n`);
                    }
                    return undefined;
                }
                if (error instanceof ErrorModeloLenguaje) {
                    if (error.motivo !== "cancelado") {
                        console.log(`\n${AMARILLO}${explicarErrorModelo(error)}${FIN}`);
                        console.log(`${GRIS}  detalle: ${error.message}${FIN}\n`);
                    }
                    return undefined;
                }
                throw error;
            }
        };

        while (!sesion.signal.aborted) {

            const pregunta = await leer(`${AZUL}> ${FIN}`);

            if (pregunta === undefined || pregunta.toLowerCase() === "salir") break;

            if (!pregunta) continue;

            if (pregunta.toLowerCase() === "nueva") {
                chat.reiniciar();
                console.log(`${GRIS}  (conversacion reiniciada)${FIN}\n`);
                continue;
            }

            let respuesta = await turno(() => chat.preguntar(pregunta));

            // El pago se detiene aqui hasta que una persona decida. Es un
            // ciclo y no un if porque tras resolver una propuesta el
            // asistente podria plantear otra, y cada una necesita su
            // propia aprobacion.
            while (respuesta?.tipo === "aprobacion_requerida") {

                mostrarPropuesta(respuesta.propuesta.vistaPrevia);

                const decision = (
                    await leer(`\n  Aplicar este pago? ${GRIS}(si / no)${FIN} `)
                )?.toLowerCase();

                if (decision === undefined) {
                    // La consola se cerro con un pago pendiente: no se
                    // aplica nada.
                    respuesta = undefined;
                    break;
                }

                respuesta = ["si", "s", "sí"].includes(decision)
                    ? await turno(() => chat.aprobarPago())
                    : await turno(() => chat.rechazarPago(decision === "no" ? undefined : decision));
            }

            if (!respuesta) continue;

            console.log(`\n${VERDE}${respuesta.texto}${FIN}`);

            if (respuesta.herramientasUsadas.length > 0) {
                console.log(
                    `${GRIS}  herramientas: `
                    + `${respuesta.herramientasUsadas.join(", ")}${FIN}`
                );
            }

            console.log();
        }
    } finally {
        // Orden: primero cortar lo que pueda seguir en vuelo, despues cerrar
        // MCP y la base, y la consola al final.
        sesion.abort();
        await cliente.close().catch(() => {});
        await servidor.close().catch(() => {});
        await cerrar().catch(() => {});
        consola.close();
    }
}

// Sin process.exit(): se fija el codigo de salida y el proceso termina
// solo cuando todo quedo cerrado (ver el comentario del encabezado).
principal().catch((error: unknown) => {
    console.error(
        "\nEl chat se detuvo: "
        + (error instanceof Error ? error.message : String(error))
    );
    process.exitCode = 1;
});
