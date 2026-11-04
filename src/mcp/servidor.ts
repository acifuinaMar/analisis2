import {
    StdioServerTransport
} from "@modelcontextprotocol/sdk/server/stdio.js";

import {
    RepositorioCarteraCsv
} from "../adaptadores/repositorio-cartera-csv";
import {
    RepositorioCarteraPostgres
} from "../adaptadores/repositorio-cartera-postgres";
import { abrirBaseDatos } from "../persistencia/base-datos";
import { RepositorioCartera } from "../dominio/repositorio-cartera";
import { crearServidorMcp } from "./servidor-mcp";

/**
 * Punto de entrada del servidor MCP (E3).
 *
 *   npm run mcp:servidor            usa PostgreSQL si hay DATABASE_URL
 *   npm run mcp:servidor -- --csv   fuerza el paquete canonico en archivos
 *
 * Habla por STDIO, que es el transporte que esperan los clientes MCP. El
 * servidor en si vive en servidor-mcp.ts y no sabe nada de transportes ni
 * de origenes de datos: aqui solo se elige el adaptador y se conecta.
 *
 * Que exista esta entrada importa por una razon concreta: permite
 * demostrar las ocho capacidades con cualquier cliente MCP sin esperar a
 * que la interfaz del E1 y el chat del E5 esten listos.
 *
 * IMPORTANTE: por STDIO, la salida estandar es el canal del protocolo.
 * Todo mensaje para la persona va por STDERR; un console.log de mas
 * corrompe la conversacion con el cliente.
 */

/**
 * Elige el adaptador. Los dos implementan el mismo puerto y devuelven lo
 * mismo para el paquete canonico, asi que la eleccion no cambia ninguna
 * cifra: cambia si los pagos que se registren PERSISTEN.
 */
function elegirRepositorio(): {
    repositorio: RepositorioCartera;
    descripcion: string;
    cerrar: () => Promise<void>;
} {

    const forzarCsv = process.argv.includes("--csv");
    const url = process.env.DATABASE_URL?.trim();

    if (!forzarCsv && url) {

        const db = abrirBaseDatos();

        return {
            repositorio: new RepositorioCarteraPostgres(db),
            descripcion: `PostgreSQL (${destino(url)})`,
            cerrar: async () => {
                await db.cerrar?.();
            }
        };
    }

    const directorio = process.env.CV_DATA_DIR?.trim();

    if (!directorio) {
        throw new Error(
            "Falta DATABASE_URL (para PostgreSQL) o CV_DATA_DIR (para "
            + "leer el paquete canonico en archivos). Vea .env.example."
        );
    }

    return {
        repositorio: new RepositorioCarteraCsv(directorio),
        descripcion: `paquete canonico en ${directorio}`,
        cerrar: async () => {}
    };
}

/** host:puerto/base, sin usuario ni contrasena. */
function destino(url: string): string {
    try {
        const u = new URL(url);
        return `${u.hostname}:${u.port || "5432"}${u.pathname}`;
    } catch {
        return "destino no reconocido";
    }
}

async function principal(): Promise<void> {

    const { repositorio, descripcion, cerrar } = elegirRepositorio();

    const servidor = crearServidorMcp(repositorio);

    // Por STDERR: STDOUT es del protocolo.
    process.stderr.write(
        `Servidor MCP credito-vecino listo sobre ${descripcion}.\n`
    );

    await servidor.connect(new StdioServerTransport());

    const despedirse = async () => {
        await servidor.close().catch(() => {});
        await cerrar().catch(() => {});
        process.exit(0);
    };

    process.on("SIGINT", despedirse);
    process.on("SIGTERM", despedirse);
}

principal().catch((error: unknown) => {
    process.stderr.write(
        "No se pudo iniciar el servidor MCP: "
        + (error instanceof Error ? error.message : String(error))
        + "\n"
    );
    process.exit(1);
});
