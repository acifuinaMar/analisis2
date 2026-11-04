import { resolve } from "node:path";

import {
    abrirBaseDatos,
    reiniciarCartera
} from "./base-datos";
import { cargarPaqueteCanonico } from "./cargador";
import { ErrorCarga } from "./errores";
import { resolverDirectorioDatos } from "./paquete";

/**
 * Comando de carga canonica (E2).
 *
 *   npm run cargar                 carga (o confirma que ya estaba cargado)
 *   npm run cargar -- --reiniciar  borra las tablas de la cartera y carga
 *
 * Variables de entorno (ver .env.example):
 *   CV_DATA_DIR   Ruta del paquete de datos (obligatoria).
 *   DATABASE_URL  Cadena de conexion a PostgreSQL (obligatoria).
 *
 * --reiniciar borra SOLO las tablas de la cartera (pagos, creditos,
 * clientes, ...). No toca rag_fragmentos. Como la base es compartida por
 * todo el equipo, el comando dice contra que servidor actua antes de
 * hacerlo.
 */

const usarColor = !process.env.NO_COLOR;
const verde = (t: string) => (usarColor ? `\x1b[32m${t}\x1b[0m` : t);
const rojo = (t: string) => (usarColor ? `\x1b[31m${t}\x1b[0m` : t);

/** host:puerto/base de DATABASE_URL, sin usuario ni contrasena. */
function destino(): string {
    try {
        const u = new URL(process.env.DATABASE_URL ?? "");
        return `${u.hostname}:${u.port || "5432"}${u.pathname}`;
    } catch {
        return "(DATABASE_URL no definida o mal formada)";
    }
}

async function principal(): Promise<void> {

    const dirDatos = resolve(resolverDirectorioDatos());

    console.log(`Paquete de datos: ${dirDatos}`);
    console.log(`Base de datos:    ${destino()}\n`);

    const db = abrirBaseDatos();

    try {
        if (process.argv.includes("--reiniciar")) {
            await reiniciarCartera(db);
            console.log("Tablas de la cartera reiniciadas (el RAG no se tocó).\n");
        }

        const resultado = await cargarPaqueteCanonico(db, dirDatos, (p) => {
            switch (p.paso) {
                case "huella":
                    console.log(
                        verde("✔ Huella SHA-256 verificada")
                        + " — coincide con eventos.sha256"
                    );
                    console.log(`  ${p.huella}`);
                    break;
                case "esquema":
                    console.log("✔ Esquema de la cartera aplicado");
                    break;
                case "cargando":
                    console.log("… Cargando la cartera");
                    break;
                case "conteos":
                    break;
            }
        });

        if (resultado.estado === "ya_cargado") {
            console.log(
                "\nLa carga canónica ya estaba hecha con esta misma huella: "
                + "no se volvió a cargar nada (idempotente)."
            );
        } else {
            console.log(verde("✔ Carga completada"));
        }

        console.log("\nConteos en la base:");
        console.log(`  clientes : ${resultado.clientes}`);
        console.log(`  créditos : ${resultado.creditos}`);
        console.log(
            `  pagos    : ${resultado.pagos}`
            + ` (${resultado.pagosAplicados} aplicados, `
            + `${resultado.pagosDuplicados} repetidos por clave de idempotencia)`
        );
    } finally {
        await db.cerrar();
    }
}

principal().catch((error: unknown) => {

    if (error instanceof ErrorCarga) {
        console.error(rojo(`\n✘ ${error.codigo}`));
        console.error(error.message);
    } else {
        console.error(error);
    }

    process.exit(1);
});
