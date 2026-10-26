import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
    InMemoryTransport
} from "@modelcontextprotocol/sdk/inMemory.js";

import {
    RepositorioCarteraCsv
} from "../adaptadores/repositorio-cartera-csv";
import { ModeloGemini } from "../adaptadores/modelo-gemini";
import { crearServidorMcp } from "../mcp/servidor-mcp";
import { responderPregunta } from "../rag/responderPregunta";
import { HerramientasMcp } from "./herramientas-mcp";
import { Orquestador } from "./orquestador";
import { CASOS_ASISTENTE } from "./casos-evaluacion";
import {
    evaluarAsistente,
    informeEnTexto,
    type ResultadoCaso
} from "./evaluar-asistente";
import type { ConsultaDocumental } from "./modelo-lenguaje";

/**
 * Evaluacion del asistente contra el modelo real (E6).
 *
 *   npm run evals:asistente
 *   npm run evals:asistente -- --caso G-7      un solo caso
 *   npm run evals:asistente -- --sin-rag       sin el modulo documental
 *
 * Corre siempre sobre el ADAPTADOR DE ARCHIVOS, no sobre PostgreSQL, y
 * con una instancia nueva por caso. Es lo que hace la evaluacion
 * repetible: la cartera arranca igual en cada caso, asi que el resultado
 * no depende del orden ni del estado en que quedo la base.
 *
 * Termina con codigo distinto de cero si algun caso falla, para que se
 * pueda enganchar a una verificacion automatica.
 */

const VERDE = "\x1b[32m";
const ROJO = "\x1b[31m";
const GRIS = "\x1b[90m";
const FIN = "\x1b[0m";

const SALIDA = resolve(
    __dirname,
    "../../reportes/asistente/evaluacion.txt"
);

/** El modulo del E4 visto por el chat. */
const documental: ConsultaDocumental = {
    consultar: async (pregunta) => {
        const r = await responderPregunta(pregunta);
        return {
            respuesta: r.respuesta,
            fuentes: r.fuentesRecuperadas.map((f) => f.id)
        };
    }
};

/**
 * Un orquestador nuevo por caso: conversacion limpia y cartera recien
 * cargada. El adaptador de archivos se reconstruye entero, asi que si un
 * caso escribiera, el siguiente no lo veria.
 */
async function nuevoChat(conRag: boolean): Promise<Orquestador> {

    const servidor = crearServidorMcp(
        new RepositorioCarteraCsv(process.env.CV_DATA_DIR ?? "")
    );

    const [aCliente, aServidor] = InMemoryTransport.createLinkedPair();
    const cliente = new Client({ name: "evals", version: "1.0.0" });

    await Promise.all([
        servidor.connect(aServidor),
        cliente.connect(aCliente)
    ]);

    return new Orquestador(
        new ModeloGemini(),
        new HerramientasMcp(cliente),
        conRag ? documental : undefined
    );
}

function pintar(r: ResultadoCaso): void {

    const marca = r.aprobado
        ? `${VERDE}PASA ${FIN}`
        : `${ROJO}FALLA${FIN}`;

    console.log(
        `  ${marca} ${r.id.padEnd(11)} ${GRIS}${r.duracionMs} ms${FIN}`
    );

    for (const fallo of r.fallos) {
        console.log(`         ${ROJO}- ${fallo}${FIN}`);
    }
}

function valorDe(bandera: string): string | undefined {
    const i = process.argv.indexOf(bandera);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

async function principal(): Promise<void> {

    if (!process.env.GEMINI_API_KEY?.trim()) {
        console.error(
            "Falta GEMINI_API_KEY en el .env: la evaluacion necesita un "
            + "modelo de lenguaje.\n"
            + "Las pruebas del conjunto de casos si corren sin clave, con "
            + "npm test."
        );
        process.exit(1);
    }

    const conRag = !process.argv.includes("--sin-rag");
    const soloCaso = valorDe("--caso");

    const casos = soloCaso
        ? CASOS_ASISTENTE.filter((c) => c.id === soloCaso)
        : CASOS_ASISTENTE;

    if (casos.length === 0) {
        console.error(
            `No hay ningun caso con identificador ${soloCaso}. `
            + `Los disponibles son: `
            + CASOS_ASISTENTE.map((c) => c.id).join(", ")
        );
        process.exit(1);
    }

    console.log(
        `\nEvaluacion del asistente - ${casos.length} caso(s)`
        + `${conRag ? "" : " - sin modulo documental"}\n`
    );

    const informe = await evaluarAsistente(
        () => nuevoChat(conRag),
        {
            casos,
            modelo: new ModeloGemini().nombre,
            alTerminarCaso: pintar
        }
    );

    const texto = informeEnTexto(informe);

    console.log(texto);

    mkdirSync(dirname(SALIDA), { recursive: true });
    writeFileSync(SALIDA, texto, "utf-8");

    console.log(`${GRIS}Informe guardado en ${SALIDA}${FIN}\n`);

    if (informe.fallidos > 0) {
        process.exit(1);
    }
}

principal().catch((error: unknown) => {
    console.error(
        "\nLa evaluacion se detuvo: "
        + (error instanceof Error ? error.message : String(error))
    );
    process.exit(1);
});
