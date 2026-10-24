import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { reiniciarCartera, type BaseDatos } from "../src/persistencia/base-datos";
import { crearBasePGlite } from "./ayudas/base-pglite";
import { cargarPaqueteCanonico } from "../src/persistencia/cargador";
import { ErrorCarga } from "../src/persistencia/errores";
import {
    calcularHuella,
    leerHuellaEsperada,
    resolverDirectorioDatos
} from "../src/persistencia/paquete";

/**
 * Pruebas del cargador canonico (E2 / E6).
 *
 * Verifican lo que el enunciado exige del cargador: conteos correctos
 * (60 clientes, 75 creditos, 228 pagos), idempotencia, y verificacion de
 * la huella SHA-256 con parada si no coincide. Corren contra el paquete
 * REAL de datos/ y contra copias alteradas en un directorio temporal;
 * la base es PGlite en memoria, sin servidor.
 */

const DATOS = resolve(__dirname, "../datos");
const ARCHIVOS_PAQUETE = [
    "eventos.jsonl", "eventos.sha256", "clientes.csv", "creditos.csv",
    "pagos.csv", "asesores.csv", "politicas.json"
];

const temporales: string[] = [];
const bases: BaseDatos[] = [];

/** Instancia compartida para las pruebas que mutan la base. */
let compartida: BaseDatos | undefined;

/**
 * Devuelve una base VACIA. Crear una instancia de PGlite cuesta
 * segundos, asi que se reutiliza una sola y se le borran las tablas de
 * la cartera entre pruebas (equivale a una base nueva). Es la misma
 * funcion que usa `npm run cargar -- --reiniciar`.
 */
async function baseNueva(): Promise<BaseDatos> {
    if (!compartida) {
        compartida = await crearBasePGlite();
        bases.push(compartida);
    }
    await reiniciarCartera(compartida);
    return compartida;
}

/** Copia el paquete a un temporal y permite alterarlo. */
function copiarPaquete(
    alterar?: (dir: string) => void
): string {
    const dir = mkdtempSync(join(tmpdir(), "cv-paquete-"));
    temporales.push(dir);
    mkdirSync(dir, { recursive: true });
    for (const a of ARCHIVOS_PAQUETE) {
        copyFileSync(join(DATOS, a), join(dir, a));
    }
    alterar?.(dir);
    return dir;
}

/** Reescribe eventos.jsonl y deja eventos.sha256 consistente con el. */
function reescribirEventos(dir: string, transformar: (lineas: string[]) => string[]) {
    const lineas = readFileSync(join(dir, "eventos.jsonl"), "utf-8")
        .split("\n").filter((l) => l.trim() !== "");
    const nuevo = transformar(lineas).join("\n") + "\n";
    writeFileSync(join(dir, "eventos.jsonl"), nuevo);
    writeFileSync(
        join(dir, "eventos.sha256"),
        `${calcularHuella(Buffer.from(nuevo))}  eventos.jsonl\n`
    );
}

function csv(archivo: string): string[][] {
    return readFileSync(join(DATOS, archivo), "utf-8")
        .split(/\r?\n/).filter((l) => l.trim() !== "")
        .slice(1).map((l) => l.split(","));
}

afterAll(async () => {
    for (const db of bases) await db.cerrar();
    for (const d of temporales) rmSync(d, { recursive: true, force: true });
});

describe("huella SHA-256", { timeout: 60_000 }, () => {

    it("la huella del paquete real coincide con eventos.sha256", () => {
        const calculada = calcularHuella(readFileSync(join(DATOS, "eventos.jsonl")));
        const esperada = leerHuellaEsperada(readFileSync(join(DATOS, "eventos.sha256"), "utf-8"));
        expect(calculada).toBe(esperada);
    });

    it("rechaza un eventos.sha256 mal formado", () => {
        expect(() => leerHuellaEsperada("no-es-una-huella  eventos.jsonl"))
            .toThrowError(ErrorCarga);
    });

    it("se detiene y no escribe nada si eventos.jsonl fue alterado", async () => {
        const dir = copiarPaquete((d) => {
            // Altera un byte de eventos.jsonl sin tocar eventos.sha256.
            const original = readFileSync(join(d, "eventos.jsonl"), "utf-8");
            writeFileSync(join(d, "eventos.jsonl"), original.replace("Miguel", "Miguelito"));
        });
        const db = await baseNueva();

        await expect(cargarPaqueteCanonico(db, dir)).rejects.toMatchObject({
            codigo: "HUELLA_NO_COINCIDE"
        });

        // Ni siquiera se aplico el esquema: no se toco la base.
        const r = await db.query<{ t: string | null }>("SELECT to_regclass('clientes')::text AS t");
        expect(r.rows[0]!.t).toBeNull();
    });
});

describe("variable de entorno CV_DATA_DIR", () => {

    it("la ruta del paquete se recibe por entorno, nunca incrustada", () => {
        expect(resolverDirectorioDatos({ CV_DATA_DIR: "./datos" })).toBe("./datos");
    });

    it("sin CV_DATA_DIR falla con un error claro", () => {
        expect(() => resolverDirectorioDatos({})).toThrowError(ErrorCarga);
        expect(() => resolverDirectorioDatos({ CV_DATA_DIR: "  " })).toThrowError(ErrorCarga);
    });
});

describe("carga del paquete canonico", { timeout: 60_000 }, () => {

    let db: BaseDatos;

    beforeAll(async () => {
        db = await crearBasePGlite();
        bases.push(db);
        await cargarPaqueteCanonico(db, DATOS);
    }, 60_000);

    it("deja 60 clientes, 75 creditos y 228 pagos", async () => {
        const r = await db.query<{ c: number; k: number; p: number }>(`
            SELECT (SELECT count(*) FROM clientes)::int AS c,
                   (SELECT count(*) FROM creditos)::int AS k,
                   (SELECT count(*) FROM pagos)::int    AS p`);
        expect(r.rows[0]).toEqual({ c: 60, k: 75, p: 228 });
    });

    it("conserva los 363 eventos de la bitacora", async () => {
        const r = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM eventos");
        expect(r.rows[0]!.n).toBe(363);
    });

    it("marca como no aplicados los pagos con clave de idempotencia repetida", async () => {
        const r = await db.query<{ clave: string; seq: number }>(
            "SELECT clave_idempotencia AS clave, seq_evento AS seq FROM pagos WHERE NOT aplicado ORDER BY seq_evento"
        );
        expect(r.rows).toEqual([
            { clave: "IDEM-000068", seq: 164 },
            { clave: "IDEM-000127", seq: 297 }
        ]);

        const aplicados = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM pagos WHERE aplicado");
        expect(aplicados.rows[0]!.n).toBe(226);
    });

    it("la base impide dos pagos aplicados con la misma clave (invariante 6.10)", async () => {
        await expect(db.query(
            `INSERT INTO pagos (clave_idempotencia, id_credito, fecha, monto_centavos, canal)
             VALUES ('IDEM-000001', 'CV-2026-0001', '2026-10-31', 100, 'agencia')`
        )).rejects.toThrow();
    });

    it("las vistas CSV equivalen exactamente a la bitacora cargada", async () => {

        const clientes = await db.query<Record<string, string>>(`
            SELECT id_cliente, nombre_completo, dpi, telefono, municipio,
                   fecha_alta::text AS fecha_alta
            FROM clientes ORDER BY id_cliente`);
        expect(clientes.rows.map((r) => Object.values(r)))
            .toEqual(csv("clientes.csv").sort((a, b) => a[0]!.localeCompare(b[0]!)));

        const creditos = await db.query<Record<string, string>>(`
            SELECT id_credito, id_cliente, id_asesor, fecha_desembolso::text,
                   capital_centavos::text, plazo_meses::text, tna_bps::text,
                   reestructurado::text
            FROM creditos ORDER BY id_credito`);
        expect(creditos.rows.map((r) => Object.values(r)))
            .toEqual(csv("creditos.csv").sort((a, b) => a[0]!.localeCompare(b[0]!)));

        // pagos.csv tiene los 228 eventos de pago, en orden de seq.
        const pagos = await db.query<Record<string, string>>(`
            SELECT clave_idempotencia, id_credito, fecha::text,
                   monto_centavos::text, canal
            FROM pagos ORDER BY seq_evento`);
        expect(pagos.rows.map((r) => Object.values(r))).toEqual(csv("pagos.csv"));
    });

    it("carga las politicas de mora y parametros como datos, no como codigo", async () => {
        const pol = await db.query<{ id: string }>("SELECT id FROM politicas_mora ORDER BY id");
        expect(pol.rows.map((r) => r.id)).toEqual(["POL-2024-01", "POL-2026-10"]);

        const par = await db.query<{ clave: string; valor: unknown }>(
            "SELECT clave, valor FROM parametros WHERE clave IN ('regla_incobrable_dias','regla_riesgo_dias','base_conteo')"
        );
        const m = Object.fromEntries(par.rows.map((r) => [r.clave, r.valor]));
        expect(m).toEqual({ regla_incobrable_dias: 120, regla_riesgo_dias: 30, base_conteo: "Actual/360" });
    });

    it("carga los 6 asesores", async () => {
        const r = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM asesores");
        expect(r.rows[0]!.n).toBe(6);
    });

    it("no modifica el paquete: la huella de datos/ sigue intacta", () => {
        const calculada = calcularHuella(readFileSync(join(DATOS, "eventos.jsonl")));
        const esperada = leerHuellaEsperada(readFileSync(join(DATOS, "eventos.sha256"), "utf-8"));
        expect(calculada).toBe(esperada);
    });
});

describe("idempotencia del cargador", { timeout: 60_000 }, () => {

    it("ejecutarlo dos (o tres) veces no duplica la cartera", async () => {
        const db = await baseNueva();

        const primera = await cargarPaqueteCanonico(db, DATOS);
        const segunda = await cargarPaqueteCanonico(db, DATOS);
        const tercera = await cargarPaqueteCanonico(db, DATOS);

        expect(primera.estado).toBe("cargado");
        expect(segunda.estado).toBe("ya_cargado");
        expect(tercera.estado).toBe("ya_cargado");

        for (const r of [primera, segunda, tercera]) {
            expect({ c: r.clientes, k: r.creditos, p: r.pagos }).toEqual({ c: 60, k: 75, p: 228 });
        }

        const ev = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM eventos");
        expect(ev.rows[0]!.n).toBe(363);
    });

    it("se niega a cargar sobre una carga previa con otra huella", async () => {
        const db = await baseNueva();
        await cargarPaqueteCanonico(db, DATOS);

        // Paquete coherente (huella valida) pero distinto del canonico.
        const otro = copiarPaquete((d) =>
            reescribirEventos(d, (l) => l.slice(0, 3)));

        await expect(cargarPaqueteCanonico(db, otro)).rejects.toMatchObject({
            codigo: "CARGA_PREVIA_DISTINTA"
        });

        const r = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM clientes");
        expect(r.rows[0]!.n).toBe(60);
    });
});

describe("validacion del paquete y atomicidad", { timeout: 60_000 }, () => {

    it("rechaza un evento que no cumple el contrato de datos", async () => {
        // Dinero con decimales: viola 'dinero = entero en centavos'.
        const dir = copiarPaquete((d) => reescribirEventos(d, (l) =>
            l.map((x) => x.includes('"seq":15,') ? x.replace('"monto_centavos":251155', '"monto_centavos":2511.55') : x)));
        const db = await baseNueva();

        await expect(cargarPaqueteCanonico(db, dir)).rejects.toMatchObject({
            codigo: "EVENTO_INVALIDO"
        });
    });

    it("rechaza una secuencia no contigua", async () => {
        const dir = copiarPaquete((d) => reescribirEventos(d, (l) => [l[0]!, ...l.slice(2)]));
        const db = await baseNueva();

        await expect(cargarPaqueteCanonico(db, dir)).rejects.toMatchObject({
            codigo: "EVENTO_INVALIDO"
        });
    });

    it("rechaza un paquete incompleto", async () => {
        const dir = copiarPaquete((d) => rmSync(join(d, "politicas.json")));
        const db = await baseNueva();

        await expect(cargarPaqueteCanonico(db, dir)).rejects.toMatchObject({
            codigo: "PAQUETE_INCOMPLETO"
        });
    });

    it("es atomico: si un evento falla a mitad de la carga, no queda nada", async () => {
        // Un pago a un credito que no existe viola la llave foranea
        // cuando ya se habian insertado asesores, clientes y creditos.
        const dir = copiarPaquete((d) => reescribirEventos(d, (l) =>
            l.map((x) => x.includes('"seq":363,') ? x.replace("CV-2026-0056", "CV-2026-9999") : x)));
        const db = await baseNueva();

        await expect(cargarPaqueteCanonico(db, dir)).rejects.toThrow();

        const r = await db.query<{ c: number; k: number; e: number; reg: number }>(`
            SELECT (SELECT count(*) FROM clientes)::int AS c,
                   (SELECT count(*) FROM creditos)::int AS k,
                   (SELECT count(*) FROM eventos)::int  AS e,
                   (SELECT count(*) FROM carga_canonica)::int AS reg`);
        expect(r.rows[0]).toEqual({ c: 0, k: 0, e: 0, reg: 0 });
    });
});
