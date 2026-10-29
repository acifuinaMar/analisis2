import { createInterface } from "node:readline/promises";
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
import { Orquestador } from "./orquestador";
import type { ConsultaDocumental } from "./modelo-lenguaje";

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
        console.error(
            `El perfil '${pedido}' no existe. Use `
            + `${PERFILES.join(" o ")}.`
        );
        process.exit(1);
    }

    return pedido as Perfil;
}

async function principal(): Promise<void> {

    if (!process.env.GEMINI_API_KEY?.trim()) {
        console.error(
            "Falta GEMINI_API_KEY en el .env: el chat necesita un modelo "
            + "de lenguaje.\nVea .env.example."
        );
        process.exit(1);
    }

    const perfil = perfilPedido();

    const { repo, donde, cerrar } = repositorio();

    const servidor = crearServidorMcp(repo);
    const [aCliente, aServidor] = InMemoryTransport.createLinkedPair();
    const cliente = new Client({ name: "chat-gerencial", version: "1.0.0" });

    await Promise.all([
        servidor.connect(aServidor),
        cliente.connect(aCliente)
    ]);

    const chat = new Orquestador(
        new ModeloGemini(),
        new HerramientasMcp(cliente),
        perfil,
        documental
    );

    const consola = createInterface({ input: stdin, output: stdout });

    console.log(`\n${AZUL}Credito Vecino - chat gerencial${FIN}`);
    console.log(`${GRIS}Cartera: ${donde}${FIN}`);
    console.log(
        `${GRIS}Perfil: ${perfil}`
        + `${chat.puedeAprobar() ? "" : " (consulta; no registra pagos)"}`
        + `${FIN}`
    );
    console.log(
        `${GRIS}Escriba su pregunta. "salir" termina, "nueva" empieza de `
        + `cero.${FIN}\n`
    );

    try {
        for (;;) {

            const pregunta = (await consola.question(`${AZUL}> ${FIN}`)).trim();

            if (!pregunta) continue;

            if (pregunta.toLowerCase() === "salir") break;

            if (pregunta.toLowerCase() === "nueva") {
                chat.reiniciar();
                console.log(`${GRIS}  (conversacion reiniciada)${FIN}\n`);
                continue;
            }

            let respuesta = await chat.preguntar(pregunta);

            // El pago se detiene aqui hasta que una persona decida. Es un
            // ciclo y no un if porque tras resolver una propuesta el
            // asistente podria plantear otra, y cada una necesita su
            // propia aprobacion.
            while (respuesta.tipo === "aprobacion_requerida") {

                mostrarPropuesta(respuesta.propuesta.vistaPrevia);

                const decision = (
                    await consola.question(
                        `\n  Aplicar este pago? ${GRIS}(si / no)${FIN} `
                    )
                ).trim().toLowerCase();

                respuesta = ["si", "s", "sí"].includes(decision)
                    ? await chat.aprobarPago()
                    : await chat.rechazarPago(decision === "no" ? undefined : decision);
            }

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
        consola.close();
        await cliente.close().catch(() => {});
        await servidor.close().catch(() => {});
        await cerrar().catch(() => {});
    }
}

principal().catch((error: unknown) => {
    console.error(
        "\nEl chat se detuvo: "
        + (error instanceof Error ? error.message : String(error))
    );
    process.exit(1);
});
