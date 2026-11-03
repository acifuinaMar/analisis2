import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { resolve } from "node:path";

import { RepositorioCarteraCsv } from "../src/adaptadores/repositorio-cartera-csv";
import { RepositorioCarteraPostgres } from "../src/adaptadores/repositorio-cartera-postgres";
import { crearApp } from "../src/api/app";
import type { RepositorioCartera } from "../src/dominio/repositorio-cartera";
import { reiniciarCartera, type BaseDatos } from "../src/persistencia/base-datos";
import { cargarPaqueteCanonico } from "../src/persistencia/cargador";
import { DirectorioClientes, LIMITE_RESULTADOS } from "../src/servicios/directorio-clientes";
import { crearBasePGlite } from "./ayudas/base-pglite";

/**
 * GET /api/clientes?buscar= (E1 · cobro en campo).
 *
 * Por HTTP real y contra los DOS adaptadores del repositorio, igual que
 * tests/api.test.ts. La base es PGlite en memoria: nunca la real.
 */

const DATOS = resolve(process.env.CV_DATA_DIR ?? "./datos");

let db: BaseDatos;
const servidores: Server[] = [];

beforeAll(async () => {
    db = await crearBasePGlite();
    await reiniciarCartera(db);
    await cargarPaqueteCanonico(db, DATOS);
}, 60_000);

afterEach(async () => {
    await Promise.all(servidores.splice(0).map(s => new Promise(r => s.close(r))));
});

afterAll(async () => { await db.cerrar(); });

function adaptadores(): Array<[string, RepositorioCartera]> {
    return [
        ["CSV", new RepositorioCarteraCsv(DATOS)],
        ["Postgres", new RepositorioCarteraPostgres(db)]
    ];
}

async function buscar(repositorio: RepositorioCartera, texto: string | null, perfil?: string) {

    const app = crearApp({ repositorio });
    const servidor = await new Promise<Server>(ok => {
        const s = app.listen(0, "127.0.0.1", () => ok(s));
    });
    servidores.push(servidor);

    const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
    const consulta = texto === null ? "" : `?buscar=${encodeURIComponent(texto)}`;

    const r = await fetch(`${base}/api/clientes${consulta}`, {
        headers: perfil ? { "X-Perfil": perfil } : {}
    });

    return { estado: r.status, cuerpo: await r.json() as any };
}

describe("GET /api/clientes: perfil y validación", { timeout: 60_000 }, () => {

    it("sin perfil: 401; gerencia: 403 (solo el asesor busca clientes)", async () => {
        const repo = new RepositorioCarteraCsv(DATOS);

        expect((await buscar(repo, "Morales")).estado).toBe(401);

        const gerencia = await buscar(repo, "Morales", "gerencia");
        expect(gerencia.estado).toBe(403);
        expect(gerencia.cuerpo.codigo).toBe("PERFIL_SIN_PERMISO");
    });

    it("texto ausente, corto o demasiado largo: 400 VALIDACION", async () => {
        const repo = new RepositorioCarteraCsv(DATOS);

        for (const texto of [null, "", " a ", "x".repeat(61)]) {
            const r = await buscar(repo, texto, "asesor");
            expect(r.estado, String(texto)).toBe(400);
            expect(r.cuerpo.codigo).toBe("VALIDACION");
        }
    });
});

describe("GET /api/clientes: coincidencias (CSV y PostgreSQL)", { timeout: 60_000 }, () => {

    it("por nombre, sin importar mayúsculas ni tildes, con todas las palabras", async () => {
        for (const [nombre, repo] of adaptadores()) {
            const r = await buscar(repo, "oscar JUAREZ", "asesor");
            expect(r.estado, nombre).toBe(200);
            expect(r.cuerpo.resultados.map((c: any) => c.idCliente), nombre).toEqual(["CL-0079"]);
            expect(r.cuerpo.resultados[0].nombreCompleto).toBe("Óscar Byron Juárez Solís");
        }
    });

    it("por identificador de cliente y por DPI", async () => {
        for (const [nombre, repo] of adaptadores()) {
            const porId = await buscar(repo, "cl-0050", "asesor");
            expect(porId.cuerpo.resultados.map((c: any) => c.idCliente), nombre).toEqual(["CL-0050"]);

            const porDpi = await buscar(repo, "DPI-FICT-000062", "asesor");
            expect(porDpi.cuerpo.resultados.map((c: any) => c.idCliente), nombre).toEqual(["CL-0062"]);
        }
    });

    it("por identificador de crédito: devuelve a su titular", async () => {
        for (const [nombre, repo] of adaptadores()) {
            const r = await buscar(repo, "CV-2026-0043", "asesor");
            expect(r.cuerpo.resultados.map((c: any) => c.idCliente), nombre).toEqual(["CL-0060"]);
            expect(r.cuerpo.resultados[0].creditos.map((c: any) => c.idCredito)).toContain("CV-2026-0043");
        }
    });

    it("cada cliente trae TODOS sus créditos, en orden", async () => {
        for (const [nombre, repo] of adaptadores()) {
            const r = await buscar(repo, "CL-0079", "asesor");
            const creditos = r.cuerpo.resultados[0].creditos.map((c: any) => c.idCredito);
            expect(creditos.length, nombre).toBe(2);
            expect([...creditos].sort(), nombre).toEqual(creditos);
        }
    });

    it("sin coincidencias: lista vacía, no error", async () => {
        const r = await buscar(new RepositorioCarteraCsv(DATOS), "zzzz-no-existe", "asesor");
        expect(r.estado).toBe(200);
        expect(r.cuerpo).toEqual({ buscar: "zzzz-no-existe", total: 0, truncado: false, resultados: [] });
    });

    it("CSV y PostgreSQL devuelven exactamente lo mismo", async () => {
        const [[, csv], [, pg]] = adaptadores();
        for (const texto of ["Morales", "Sonia", "0030", "CV-2026"]) {
            expect((await buscar(pg, texto, "asesor")).cuerpo, texto)
                .toEqual((await buscar(csv, texto, "asesor")).cuerpo);
        }
    });
});

describe("GET /api/clientes: límite, orden y privacidad", { timeout: 60_000 }, () => {

    it("limita los resultados, informa el total y ordena por identificador", async () => {
        // "CV-2026" coincide con el crédito de todos los clientes.
        const r = await buscar(new RepositorioCarteraCsv(DATOS), "CV-2026", "asesor");
        const ids = r.cuerpo.resultados.map((c: any) => c.idCliente);

        expect(ids.length).toBe(LIMITE_RESULTADOS);
        expect(r.cuerpo.total).toBeGreaterThan(LIMITE_RESULTADOS);
        expect(r.cuerpo.truncado).toBe(true);
        expect([...ids].sort()).toEqual(ids);
    });

    it("no expone teléfono, fecha de alta ni el DPI completo", async () => {
        const r = await buscar(new RepositorioCarteraCsv(DATOS), "Morales", "asesor");
        expect(r.cuerpo.resultados.length).toBeGreaterThan(0);

        for (const cliente of r.cuerpo.resultados) {
            expect(Object.keys(cliente).sort())
                .toEqual(["creditos", "dpiTerminacion", "idCliente", "municipio", "nombreCompleto"]);
            expect(cliente.dpiTerminacion).toHaveLength(4);
        }

        const texto = JSON.stringify(r.cuerpo);
        expect(texto).not.toMatch(/DPI-FICT/);
        expect(texto).not.toMatch(/5555-/);
    });

    it("un fragmento de DPI de menos de 4 caracteres no busca por DPI", async () => {
        const directorio = new DirectorioClientes(new RepositorioCarteraCsv(DATOS));
        // "79" no está en ningún nombre; sí en CL-0079 (identificador).
        const r = await directorio.buscar("79");
        expect(r.resultados.every(c => c.idCliente.includes("79")
            || c.creditos.some(k => k.idCredito.includes("79")))).toBe(true);
    });
});
