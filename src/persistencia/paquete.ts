import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

import { ErrorCarga } from "./errores";

/**
 * Lectura y validacion del paquete de datos canonico.
 *
 * El paquete se lee de un directorio que llega como parametro; la ruta
 * real viene de la variable de entorno CV_DATA_DIR, nunca incrustada en
 * el codigo (seccion 5.3 del enunciado). Nada aqui escribe en el
 * paquete: se trata como solo lectura.
 *
 * Contrato de datos (LEEME.md): un objeto JSON por linea; dinero en
 * centavos enteros; tasas en puntos basicos; fechas AAAA-MM-DD; `seq`
 * es el orden de reproduccion.
 */

const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "fecha AAAA-MM-DD");
const Centavos = z.number().int().positive();

const EventoCliente = z.object({
    seq: z.number().int().positive(),
    tipo: z.literal("CLIENTE"),
    id_cliente: z.string().min(1),
    nombre_completo: z.string().min(1),
    dpi: z.string().min(1),
    telefono: z.string().min(1),
    municipio: z.string().min(1),
    fecha_alta: Fecha
}).strict();

const EventoDesembolso = z.object({
    seq: z.number().int().positive(),
    tipo: z.literal("DESEMBOLSO"),
    id_credito: z.string().min(1),
    id_cliente: z.string().min(1),
    id_asesor: z.string().min(1),
    fecha: Fecha,
    capital_centavos: Centavos,
    plazo_meses: z.number().int().positive(),
    tna_bps: z.number().int().nonnegative(),
    reestructurado: z.boolean()
}).strict();

const EventoPago = z.object({
    seq: z.number().int().positive(),
    tipo: z.literal("PAGO"),
    clave_idempotencia: z.string().min(1),
    id_credito: z.string().min(1),
    fecha: Fecha,
    monto_centavos: Centavos,
    canal: z.string().min(1)
}).strict();

export const EventoEsquema = z.discriminatedUnion("tipo", [
    EventoCliente,
    EventoDesembolso,
    EventoPago
]);

export type Evento = z.infer<typeof EventoEsquema>;
export type EventoClienteT = z.infer<typeof EventoCliente>;
export type EventoDesembolsoT = z.infer<typeof EventoDesembolso>;
export type EventoPagoT = z.infer<typeof EventoPago>;

const PoliticasEsquema = z.object({
    version: z.string(),
    moneda: z.string(),
    base_conteo: z.string(),
    politicas_mora: z.record(z.string(), z.record(z.string(), z.unknown())),
    gasto_gestion_cobro: z.record(z.string(), z.unknown()),
    regla_incobrable_dias: z.number().int(),
    regla_riesgo_dias: z.number().int()
}).passthrough();

export type Politicas = z.infer<typeof PoliticasEsquema>;

export interface Asesor {
    readonly id_asesor: string;
    readonly nombre_completo: string;
}

export interface PaqueteCanonico {
    readonly directorio: string;
    readonly huella: string;
    readonly eventos: readonly Evento[];
    readonly asesores: readonly Asesor[];
    readonly politicas: Politicas;
}

const ARCHIVOS_REQUERIDOS = [
    "eventos.jsonl",
    "eventos.sha256",
    "asesores.csv",
    "politicas.json"
] as const;

/** Resuelve el directorio del paquete desde CV_DATA_DIR. */
export function resolverDirectorioDatos(
    entorno: NodeJS.ProcessEnv = process.env
): string {

    const dir = entorno.CV_DATA_DIR?.trim();

    if (!dir) {
        throw new ErrorCarga(
            "DIRECTORIO_NO_DEFINIDO",
            "Falta la variable de entorno CV_DATA_DIR con la ruta del "
            + "paquete de datos (p. ej. CV_DATA_DIR=./datos)."
        );
    }

    return dir;
}

/** SHA-256 (hex) de los bytes exactos del archivo. */
export function calcularHuella(contenido: Buffer): string {
    return createHash("sha256").update(contenido).digest("hex");
}

/**
 * Lee la huella esperada de eventos.sha256 (formato de sha256sum:
 * "<hex>  <archivo>").
 */
export function leerHuellaEsperada(texto: string): string {

    const primera = texto.trim().split(/\s+/)[0] ?? "";

    if (!/^[0-9a-f]{64}$/i.test(primera)) {
        throw new ErrorCarga(
            "HUELLA_MAL_FORMADA",
            "eventos.sha256 no contiene una huella SHA-256 valida "
            + "(se esperaban 64 caracteres hexadecimales)."
        );
    }

    return primera.toLowerCase();
}

/** CSV simple, sin comillas ni comas dentro de los campos (asesores.csv). */
function leerCsvSimple(texto: string): Record<string, string>[] {

    const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== "");
    const cabecera = (lineas[0] ?? "").split(",").map((c) => c.trim());

    return lineas.slice(1).map((linea) => {
        const celdas = linea.split(",").map((c) => c.trim());
        return Object.fromEntries(cabecera.map((c, i) => [c, celdas[i] ?? ""]));
    });
}

/**
 * Lee el paquete y VERIFICA la huella antes de interpretar nada. Si la
 * huella no coincide, se detiene: es la prueba de que se cargan los
 * datos correctos y sin alterar (seccion 5.2).
 */
export function leerPaquete(directorio: string): PaqueteCanonico {

    for (const archivo of ARCHIVOS_REQUERIDOS) {
        if (!existsSync(join(directorio, archivo))) {
            throw new ErrorCarga(
                "PAQUETE_INCOMPLETO",
                `No se encontro '${archivo}' en ${directorio}.`
            );
        }
    }

    const bytes = readFileSync(join(directorio, "eventos.jsonl"));
    const esperada = leerHuellaEsperada(
        readFileSync(join(directorio, "eventos.sha256"), "utf-8")
    );
    const huella = calcularHuella(bytes);

    if (huella !== esperada) {
        throw new ErrorCarga(
            "HUELLA_NO_COINCIDE",
            "La huella SHA-256 de eventos.jsonl no coincide con "
            + "eventos.sha256: el paquete fue alterado o es otro.\n"
            + `  esperada: ${esperada}\n  calculada: ${huella}`
        );
    }

    const eventos = bytes
        .toString("utf-8")
        .split(/\r?\n/)
        .filter((l) => l.trim() !== "")
        .map((linea, i) => {
            let json: unknown;
            try {
                json = JSON.parse(linea);
            } catch {
                throw new ErrorCarga(
                    "EVENTO_INVALIDO",
                    `Linea ${i + 1} de eventos.jsonl: JSON invalido.`
                );
            }
            const r = EventoEsquema.safeParse(json);
            if (!r.success) {
                throw new ErrorCarga(
                    "EVENTO_INVALIDO",
                    `Linea ${i + 1} de eventos.jsonl: `
                    + r.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")
                );
            }
            return r.data;
        });

    eventos.forEach((e, i) => {
        if (e.seq !== i + 1) {
            throw new ErrorCarga(
                "EVENTO_INVALIDO",
                `La secuencia no es contigua: se esperaba seq=${i + 1} `
                + `y se encontro seq=${e.seq}.`
            );
        }
    });

    const asesores = leerCsvSimple(
        readFileSync(join(directorio, "asesores.csv"), "utf-8")
    ).map((f) => ({
        id_asesor: f.id_asesor ?? "",
        nombre_completo: f.nombre_completo ?? ""
    }));

    const politicas = PoliticasEsquema.parse(
        JSON.parse(readFileSync(join(directorio, "politicas.json"), "utf-8"))
    );

    return { directorio, huella, eventos, asesores, politicas };
}
