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
import { ConsultasCartera } from "../src/servicios/consultas-cartera";
import { crearBasePGlite } from "./ayudas/base-pglite";

/**
 * API REST (E1, servidor), probada por HTTP real.
 *
 * Cada prueba levanta el servidor en un puerto efimero y le habla con
 * fetch: se ejercita todo el camino (JSON, encabezados, validacion,
 * errores, estados HTTP) y no solo las funciones. Los flujos de
 * operacion corren contra los DOS adaptadores del repositorio.
 */

const DATOS = resolve(process.env.CV_DATA_DIR ?? "./datos");
const CORTE = "2026-10-31";

let db: BaseDatos;
const servidores: Server[] = [];

beforeAll(async () => { db = await crearBasePGlite(); }, 60_000);

afterEach(async () => {
    await Promise.all(servidores.splice(0).map(s => new Promise(r => s.close(r))));
});

afterAll(async () => { await db.cerrar(); });

interface Cliente {
    get(ruta: string, perfil?: string): Promise<{ estado: number; cuerpo: any }>;
    post(ruta: string, cuerpo: unknown, perfil?: string): Promise<{ estado: number; cuerpo: any }>;
}

async function iniciar(repositorio: RepositorioCartera, registrarError?: (e: unknown) => void): Promise<Cliente> {

    const app = crearApp({ repositorio, registrarError });
    const servidor = await new Promise<Server>(ok => {
        const s = app.listen(0, "127.0.0.1", () => ok(s));
    });
    servidores.push(servidor);

    const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;

    const llamar = async (metodo: string, ruta: string, perfil?: string, cuerpo?: unknown) => {
        const r = await fetch(base + ruta, {
            method: metodo,
            headers: {
                ...(perfil ? { "X-Perfil": perfil } : {}),
                ...(cuerpo !== undefined ? { "Content-Type": "application/json" } : {})
            },
            body: cuerpo !== undefined ? (typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo)) : undefined
        });
        const texto = await r.text();
        return { estado: r.status, cuerpo: texto ? JSON.parse(texto) : undefined };
    };

    return {
        get: (ruta, perfil) => llamar("GET", ruta, perfil),
        post: (ruta, cuerpo, perfil) => llamar("POST", ruta, perfil, cuerpo)
    };
}

async function adaptadores(): Promise<Array<[string, RepositorioCartera]>> {
    await reiniciarCartera(db);
    await cargarPaqueteCanonico(db, DATOS);
    return [
        ["CSV", new RepositorioCarteraCsv(DATOS)],
        ["Postgres", new RepositorioCarteraPostgres(db)]
    ];
}

/** Lo que devolveria el servicio directamente, tal como viaja por JSON. */
const comoJson = (x: unknown) => JSON.parse(JSON.stringify(x));

describe("Salud, perfiles y errores uniformes", { timeout: 60_000 }, () => {

    it("/api/salud responde sin perfil", async () => {
        const api = await iniciar(new RepositorioCarteraCsv(DATOS));
        expect(await api.get("/api/salud")).toEqual({ estado: 200, cuerpo: { estado: "ok" } });
    });

    it("Sin X-Perfil: 401 PERFIL_REQUERIDO", async () => {
        const api = await iniciar(new RepositorioCarteraCsv(DATOS));
        const r = await api.get(`/api/cartera?fechaCorte=${CORTE}`);
        expect(r.estado).toBe(401);
        expect(r.cuerpo).toMatchObject({ error: true, codigo: "PERFIL_REQUERIDO" });
    });

    it("Perfil desconocido: 400 PERFIL_INVALIDO", async () => {
        const api = await iniciar(new RepositorioCarteraCsv(DATOS));
        const r = await api.get(`/api/cartera?fechaCorte=${CORTE}`, "administrador");
        expect(r.estado).toBe(400);
        expect(r.cuerpo.codigo).toBe("PERFIL_INVALIDO");
    });

    it("Menor privilegio: el asesor no ve tablero ni cierres", async () => {
        const api = await iniciar(new RepositorioCarteraCsv(DATOS));
        for (const ruta of [
            `/api/cartera?fechaCorte=${CORTE}`,
            `/api/cierres/diario?fechaCorte=${CORTE}`,
            "/api/cierres/mensual?periodo=2026-10"
        ]) {
            const r = await api.get(ruta, "asesor");
            expect(r.estado, ruta).toBe(403);
            expect(r.cuerpo.codigo).toBe("PERFIL_SIN_PERMISO");
        }
    });

    it("Menor privilegio: gerencia consulta pero no mueve dinero ni origina", async () => {
        const api = await iniciar(new RepositorioCarteraCsv(DATOS));

        const pago = await api.post("/api/creditos/CV-2026-0043/pagos", {
            monto: 1, claveIdempotencia: "IDEM-X-0001", fechaOperacion: CORTE, confirmado: true
        }, "gerencia");
        expect(pago.estado).toBe(403);

        const alta = await api.post("/api/clientes", {}, "gerencia");
        expect(alta.estado).toBe(403);
    });

    it("La fecha de corte es obligatoria: la API no usa el reloj del sistema", async () => {
        const api = await iniciar(new RepositorioCarteraCsv(DATOS));
        const r = await api.get("/api/creditos/CV-2026-0030", "asesor");
        expect(r.estado).toBe(400);
        expect(r.cuerpo.codigo).toBe("VALIDACION");
        expect(r.cuerpo.detalle.campos[0].campo).toBe("fechaCorte");
    });

    it("Una fecha inexistente en el calendario da 400 FECHA_INVALIDA", async () => {
        const api = await iniciar(new RepositorioCarteraCsv(DATOS));
        const r = await api.get("/api/creditos/CV-2026-0030?fechaCorte=2026-02-30", "asesor");
        expect(r.estado).toBe(400);
        expect(r.cuerpo.codigo).toBe("FECHA_INVALIDA");
    });

    it("Credito inexistente: 404 CREDITO_INEXISTENTE", async () => {
        const api = await iniciar(new RepositorioCarteraCsv(DATOS));
        const r = await api.get(`/api/creditos/CV-2026-0999?fechaCorte=${CORTE}`, "asesor");
        expect(r.estado).toBe(404);
        expect(r.cuerpo.codigo).toBe("CREDITO_INEXISTENTE");
    });

    it("JSON malformado: 400 JSON_INVALIDO; ruta desconocida: 404", async () => {
        const api = await iniciar(new RepositorioCarteraCsv(DATOS));
        const malo = await api.post("/api/clientes", "{no es json", "asesor");
        expect(malo.estado).toBe(400);
        expect(malo.cuerpo.codigo).toBe("JSON_INVALIDO");

        const nada = await api.get("/api/no-existe", "asesor");
        expect(nada.estado).toBe(404);
        expect(nada.cuerpo.codigo).toBe("RUTA_INEXISTENTE");
    });

    it("Un fallo interno da 500 sin filtrar el mensaje (SQL, rutas)", async () => {
        const registrados: unknown[] = [];
        const roto = new RepositorioCarteraCsv(DATOS);
        roto.obtenerCredito = async () => { throw new Error("SELECT password FROM secretos"); };

        const api = await iniciar(roto, e => registrados.push(e));
        const r = await api.get(`/api/creditos/CV-2026-0030?fechaCorte=${CORTE}`, "asesor");

        expect(r.estado).toBe(500);
        expect(r.cuerpo.codigo).toBe("ERROR_INTERNO");
        expect(JSON.stringify(r.cuerpo)).not.toContain("password");
        expect(registrados).toHaveLength(1);
    });

    it("Las respuestas no se guardan en cache", async () => {
        const api = await iniciar(new RepositorioCarteraCsv(DATOS));
        const r = await fetch(`${(servidores[0]!.address() as AddressInfo).port ? "http://127.0.0.1:" + (servidores[0]!.address() as AddressInfo).port : ""}/api/salud`);
        expect(r.headers.get("cache-control")).toBe("no-store");
        expect(r.headers.get("x-powered-by")).toBeNull();
        void api;
    });
});

describe("Consultas gerenciales G-1 a G-7: la API da lo mismo que el nucleo", { timeout: 120_000 }, () => {

    it("Tablero G-1, morosos G-4, cierres G-2/G-3, credito G-5 y mora G-7", async () => {
        for (const [nombre, repo] of await adaptadores()) {

            const api = await iniciar(repo);
            const directo = new ConsultasCartera(repo);
            const dia = new Date(2026, 9, 31);

            expect((await api.get(`/api/cartera?fechaCorte=${CORTE}`, "gerencia")).cuerpo, `G-1 ${nombre}`)
                .toEqual(comoJson(await directo.consultarCartera(dia)));

            expect((await api.get(`/api/cartera/mora?fechaCorte=${CORTE}&tramo=mora_3`, "gerencia")).cuerpo, `G-4 ${nombre}`)
                .toEqual(comoJson(await directo.listarCreditosEnMora(dia, "mora_3" as never)));

            expect((await api.get("/api/cierres/mensual?periodo=2026-10", "gerencia")).cuerpo, `G-2 ${nombre}`)
                .toEqual(comoJson(await directo.consultarCierreMensual("2026-10")));

            expect((await api.get(`/api/cierres/diario?fechaCorte=${CORTE}`, "gerencia")).cuerpo, `G-3 ${nombre}`)
                .toEqual(comoJson(await directo.consultarCierreDiario(dia)));

            expect((await api.get(`/api/creditos/CV-2026-0030?fechaCorte=${CORTE}`, "gerencia")).cuerpo, `G-5 ${nombre}`)
                .toEqual(comoJson(await directo.consultarCredito("CV-2026-0030", dia)));

            expect((await api.get(`/api/creditos/CV-2026-0030/cuotas/3/mora?fechaCorte=${CORTE}`, "gerencia")).cuerpo, `G-5b ${nombre}`)
                .toEqual(comoJson(await directo.explicarMora("CV-2026-0030", 3, dia)));

            // G-7: fecha de corte futura. Prueba de que no se usa el reloj.
            const g7 = await api.get("/api/creditos/CV-2026-0410/cuotas/2/mora?fechaCorte=2027-01-24", "gerencia");
            expect(g7.estado, `G-7 ${nombre}`).toBe(200);
            expect(g7.cuerpo, `G-7 ${nombre}`)
                .toEqual(comoJson(await directo.explicarMora("CV-2026-0410", 2, new Date(2027, 0, 24))));
        }
    });

    it("Vencimientos G-6: 7 y 30 dias", async () => {
        for (const [nombre, repo] of await adaptadores()) {
            const api = await iniciar(repo);
            const directo = new ConsultasCartera(repo);

            for (const dias of [7, 30]) {
                const r = await api.get(`/api/vencimientos?fechaCorte=${CORTE}&ventanaDias=${dias}`, "gerencia");
                expect(r.cuerpo, `${nombre} ${dias}d`)
                    .toEqual(comoJson(await directo.proximosVencimientos(new Date(2026, 9, 31), dias)));
            }

            const mala = await api.get(`/api/vencimientos?fechaCorte=${CORTE}&ventanaDias=0`, "gerencia");
            expect(mala.estado, nombre).toBe(400);
        }
    });

    it("El asesor puede ver morosos y vencimientos (cobro en campo)", async () => {
        const api = await iniciar(new RepositorioCarteraCsv(DATOS));
        expect((await api.get(`/api/cartera/mora?fechaCorte=${CORTE}`, "asesor")).estado).toBe(200);
        expect((await api.get(`/api/vencimientos?fechaCorte=${CORTE}&ventanaDias=7`, "asesor")).estado).toBe(200);
    });
});

describe("Operaciones OP-1 a OP-6 por HTTP (con aprobacion humana)", { timeout: 120_000 }, () => {

    const pagar = (api: Cliente, id: string, extra: Record<string, unknown>) =>
        api.post(`/api/creditos/${id}/pagos`, {
            fechaOperacion: CORTE, canal: "agencia", ...extra
        }, "asesor");

    it("OP-1 y OP-4: deuda -> vista previa -> aprobacion -> reintento idempotente", async () => {
        for (const [nombre, repo] of await adaptadores()) {

            const api = await iniciar(repo);
            const id = "CV-2026-0043";

            // El sistema calcula el monto; nadie lo escribe.
            const deuda = await api.get(`/api/creditos/${id}/deuda?fechaCorte=${CORTE}`, "asesor");
            expect(deuda.estado, nombre).toBe(200);
            expect(deuda.cuerpo.montoExacto, nombre).toBeGreaterThan(0);
            const monto = deuda.cuerpo.montoExacto;

            const antes = (await api.get(`/api/creditos/${id}?fechaCorte=${CORTE}`, "asesor")).cuerpo;

            // Sin confirmado: solo la vista previa (200), nada se mueve.
            const previa = await pagar(api, id, { monto, claveIdempotencia: "IDEM-OP-1" });
            expect(previa.estado, nombre).toBe(200);
            expect(previa.cuerpo.aplicado, nombre).toBe(false);
            expect(previa.cuerpo.desglosePrelacion.total, nombre).toBe(monto);
            expect((await api.get(`/api/creditos/${id}?fechaCorte=${CORTE}`, "asesor")).cuerpo, nombre)
                .toEqual(antes);

            // Con aprobacion: se aplica (201).
            const aprobado = await pagar(api, id, { monto, claveIdempotencia: "IDEM-OP-1", confirmado: true });
            expect(aprobado.estado, nombre).toBe(201);
            expect(aprobado.cuerpo.aplicado, nombre).toBe(true);
            expect(aprobado.cuerpo.estadoDespues.cuotasVencidas, nombre).toBe(0);

            const despues = (await api.get(`/api/creditos/${id}?fechaCorte=${CORTE}`, "asesor")).cuerpo;
            expect(despues.saldoCapital, nombre).toBeLessThan(antes.saldoCapital);

            // OP-4: misma clave. 200, duplicado, y el saldo no se mueve.
            const reintento = await pagar(api, id, { monto, claveIdempotencia: "IDEM-OP-1", confirmado: true });
            expect(reintento.estado, nombre).toBe(200);
            expect(reintento.cuerpo.duplicado, nombre).toBe(true);
            expect(reintento.cuerpo.aplicado, nombre).toBe(false);
            expect((await api.get(`/api/creditos/${id}?fechaCorte=${CORTE}`, "asesor")).cuerpo, nombre)
                .toEqual(despues);
        }
    });

    it("OP-2: detalle de la mora antes de pagar, y el pago se aplica", async () => {
        for (const [nombre, repo] of await adaptadores()) {

            const api = await iniciar(repo);
            const id = "CV-2026-0035";

            const deuda = await api.get(`/api/creditos/${id}/deuda?fechaCorte=${CORTE}`, "asesor");
            const cuota = deuda.cuerpo.cuotasExigibles[0];

            const mora = await api.get(`/api/creditos/${id}/cuotas/${cuota}/mora?fechaCorte=${CORTE}`, "asesor");
            expect(mora.estado, nombre).toBe(200);

            const r = await pagar(api, id, {
                monto: deuda.cuerpo.montoExacto, claveIdempotencia: "IDEM-OP-2", confirmado: true
            });
            expect(r.estado, nombre).toBe(201);
        }
    });

    it("OP-5: monto no exacto -> 422 con el monto correcto", async () => {
        for (const [nombre, repo] of await adaptadores()) {

            const api = await iniciar(repo);
            const id = "CV-2026-0061";

            const deuda = await api.get(`/api/creditos/${id}/deuda?fechaCorte=${CORTE}`, "asesor");

            const r = await pagar(api, id, { monto: 500, claveIdempotencia: "IDEM-OP-5", confirmado: true });

            expect(r.estado, nombre).toBe(422);
            expect(r.cuerpo.codigo, nombre).toBe("MONTO_NO_EXACTO");
            // El monto que la pantalla muestra es el mismo que ofrece /deuda.
            expect(r.cuerpo.detalle.montoCorrecto, nombre).toBe(deuda.cuerpo.montoExacto);
            expect(r.cuerpo.detalle.montoRecibido, nombre).toBe(500);

            // No se registro nada.
            const otra = await pagar(api, id, { monto: deuda.cuerpo.montoExacto, claveIdempotencia: "IDEM-OP-5", confirmado: true });
            expect(otra.estado, nombre).toBe(201);
        }
    });

    it("OP-6: credito incobrable -> 409", async () => {
        for (const [nombre, repo] of await adaptadores()) {

            const api = await iniciar(repo);

            const r = await pagar(api, "CV-2026-0015", { monto: 100, claveIdempotencia: "IDEM-OP-6", confirmado: true });

            expect(r.estado, nombre).toBe(409);
            expect(r.cuerpo.codigo, nombre).toBe("CREDITO_INCOBRABLE");
        }
    });

    it("El cuerpo del pago se valida: monto negativo, clave corta, campos de mas", async () => {
        const api = await iniciar(new RepositorioCarteraCsv(DATOS));
        const id = "CV-2026-0043";

        expect((await pagar(api, id, { monto: -5, claveIdempotencia: "IDEM-OK-1" })).estado).toBe(400);
        expect((await pagar(api, id, { monto: 5, claveIdempotencia: "x" })).estado).toBe(400);
        expect((await pagar(api, id, { monto: 5, claveIdempotencia: "IDEM-OK-2", intruso: true })).estado).toBe(400);
        expect((await api.post("/api/creditos/NOEXISTE/pagos", {}, "asesor")).estado).toBe(400);
    });
});

describe("OP-3 por HTTP: originacion completa", { timeout: 120_000 }, () => {

    const cliente = {
        idCliente: "CL-9001",
        nombreCompleto: "Gerencia Demostración Gálvez",
        dpi: "DPI-FICT-009001",
        telefono: "5555-9001",
        municipio: "Guatemala",
        fechaOperacion: CORTE
    };

    const solicitud = { capital: 10000, plazoMeses: 12, tnaAnual: 0.36, fechaDesembolso: CORTE };

    it("Alta, simulacion, desembolso y plan guardado", async () => {
        for (const [nombre, repo] of await adaptadores()) {

            const api = await iniciar(repo);

            const asesores = await api.get("/api/asesores", "asesor");
            expect(asesores.cuerpo.asesores.map((a: any) => a.idAsesor), nombre).toContain("AS-01");

            expect((await api.post("/api/clientes", cliente, "asesor")).estado, nombre).toBe(201);

            // Plan simulado: no guarda nada.
            const sim = await api.post("/api/creditos/simulacion", solicitud, "asesor");
            expect(sim.estado, nombre).toBe(200);
            expect(sim.cuerpo.cuotas[0].cuota, nombre).toBe(1004.62);
            expect(sim.cuerpo.cuotas[11].cuota, nombre).toBe(1004.63);
            expect(sim.cuerpo.totales.intereses, nombre).toBe(2055.45);
            expect(await repo.obtenerCredito("CV-2026-9001"), nombre).toBeUndefined();

            const desembolso = await api.post("/api/creditos", {
                ...solicitud, idCredito: "CV-2026-9001", idCliente: "CL-9001", idAsesor: "AS-01"
            }, "asesor");
            expect(desembolso.estado, nombre).toBe(201);
            expect(desembolso.cuerpo.plan, nombre).toEqual(sim.cuerpo);

            const plan = await api.get(`/api/creditos/CV-2026-9001/plan?fechaCorte=${CORTE}`, "asesor");
            expect(plan.estado, nombre).toBe(200);
            expect(plan.cuerpo.cuotas, nombre).toHaveLength(12);
            expect(plan.cuerpo.cuotas.every((c: any) => c.estado === "pendiente"), nombre).toBe(true);
        }
    });

    it("Rechaza duplicados (409), referencias inexistentes (422) y limites (400)", async () => {
        for (const [nombre, repo] of await adaptadores()) {

            const api = await iniciar(repo);
            await api.post("/api/clientes", cliente, "asesor");

            expect((await api.post("/api/clientes", cliente, "asesor")).cuerpo.codigo, nombre).toBe("CLIENTE_DUPLICADO");
            expect((await api.post("/api/clientes", { ...cliente, idCliente: "CL-9002" }, "asesor")).cuerpo.codigo, nombre).toBe("DPI_DUPLICADO");

            const base = { ...solicitud, idCredito: "CV-2026-9001", idCliente: "CL-9001", idAsesor: "AS-01" };

            expect((await api.post("/api/creditos", { ...base, idCliente: "CL-7777" }, "asesor")).estado, nombre).toBe(422);
            expect((await api.post("/api/creditos", { ...base, idAsesor: "AS-99" }, "asesor")).estado, nombre).toBe(422);
            expect((await api.post("/api/creditos", { ...base, capital: 500 }, "asesor")).cuerpo.codigo, nombre).toBe("CAPITAL_FUERA_DE_RANGO");
            expect((await api.post("/api/creditos", { ...base, plazoMeses: 30 }, "asesor")).cuerpo.codigo, nombre).toBe("PLAZO_FUERA_DE_RANGO");
            expect((await api.post("/api/creditos", { ...base, tnaAnual: 36 }, "asesor")).cuerpo.codigo, nombre).toBe("TASA_INVALIDA");

            expect((await api.post("/api/creditos", base, "asesor")).estado, nombre).toBe(201);
            expect((await api.post("/api/creditos", base, "asesor")).estado, nombre).toBe(409);
        }
    });
});
