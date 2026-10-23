import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolve } from "node:path";

import { Dinero } from "../src/dominio/dinero";
import {
    RepositorioCarteraCsv
} from "../src/adaptadores/repositorio-cartera-csv";
import {
    RepositorioCarteraPostgres
} from "../src/adaptadores/repositorio-cartera-postgres";
import { reiniciarCartera, type BaseDatos } from "../src/persistencia/base-datos";
import { cargarPaqueteCanonico } from "../src/persistencia/cargador";
import { ConsultasCartera } from "../src/servicios/consultas-cartera";
import type {
    CreditoRegistrado,
    PagoRegistrado,
    RepositorioCartera
} from "../src/dominio/repositorio-cartera";
import { crearBasePGlite } from "./ayudas/base-pglite";

/**
 * Pruebas del adaptador de PostgreSQL (E2).
 *
 * Mismo contrato que las de RepositorioCarteraCsv: los dos adaptadores
 * implementan el mismo puerto y deben ser INTERCAMBIABLES. La base es
 * PGlite en memoria (Postgres real, sin red ni credenciales).
 *
 * La prueba que sostiene todo lo demas es la ultima: con cualquiera de
 * los dos adaptadores, el nucleo devuelve exactamente las mismas cifras.
 * Si el tablero y el asistente leen de la misma base, no hay dos fuentes
 * de verdad (seccion 7.2 del Proyecto Final).
 */

const DATOS = resolve(process.env.CV_DATA_DIR ?? "./datos");
const CORTE = new Date(2026, 9, 31);

let db: BaseDatos;

beforeAll(async () => {
    db = await crearBasePGlite();
}, 60_000);

afterAll(async () => {
    await db.cerrar();
});

/** Base recien cargada con el paquete canonico. */
async function repositorio(): Promise<RepositorioCarteraPostgres> {
    await reiniciarCartera(db);
    await cargarPaqueteCanonico(db, DATOS);
    return new RepositorioCarteraPostgres(db);
}

/** Forma comparable (Dinero y Date no se comparan bien con toEqual). */
function planoCredito(c: CreditoRegistrado) {
    return {
        ...c,
        capital: c.capital.obtenerCentavos(),
        fechaDesembolso: c.fechaDesembolso.getTime()
    };
}

function planoPago(p: PagoRegistrado) {
    return {
        ...p,
        monto: p.monto.obtenerCentavos(),
        fecha: p.fecha.getTime()
    };
}

describe("Repositorio Postgres - conteos del paquete canonico", { timeout: 60_000 }, () => {

    it("Carga los 75 creditos", async () => {
        expect(await (await repositorio()).listarCreditos()).toHaveLength(75);
    });

    it("Los 228 eventos de pago quedan en la base y 226 se aplican", async () => {
        const repo = await repositorio();

        const r = await db.query<{ total: number; aplicados: number }>(`
            SELECT count(*)::int AS total,
                   count(*) FILTER (WHERE aplicado)::int AS aplicados
            FROM pagos`);

        expect(r.rows[0]).toEqual({ total: 228, aplicados: 226 });
        expect(await repo.listarPagos()).toHaveLength(226);
    });

    it("Los dos duplicados del paquete aparecen una sola vez", async () => {
        const pagos = await (await repositorio()).listarPagos();

        for (const clave of ["IDEM-000068", "IDEM-000127"]) {
            expect(pagos.filter(p => p.claveIdempotencia === clave)).toHaveLength(1);
        }
    });

    it("Carga los 60 clientes y cada credito apunta a uno existente", async () => {
        const repo = await repositorio();

        const r = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM clientes");
        expect(r.rows[0]!.n).toBe(60);

        for (const credito of await repo.listarCreditos()) {
            expect(await repo.obtenerCliente(credito.idCliente)).toBeDefined();
        }
    });
});

describe("Repositorio Postgres - conversion de los datos", { timeout: 60_000 }, () => {

    it("Los basis points se convierten a decimal", async () => {
        const credito = await (await repositorio()).obtenerCredito("CV-2026-0001");
        expect(credito?.tnaAnual).toBe(0.36);
    });

    it("El capital llega en centavos exactos", async () => {
        const credito = await (await repositorio()).obtenerCredito("CV-2026-0001");

        expect(credito?.capital.obtenerCentavos()).toBe(2500000);
        expect(credito?.capital.obtenerValor()).toBe(25000);
    });

    it("Las fechas no se corren un dia por zona horaria", async () => {
        const credito = await (await repositorio()).obtenerCredito("CV-2026-0001");

        expect(credito?.fechaDesembolso.getFullYear()).toBe(2026);
        expect(credito?.fechaDesembolso.getMonth()).toBe(0);
        expect(credito?.fechaDesembolso.getDate()).toBe(14);
    });

    it("La marca de reestructurado se lee como booleano", async () => {
        const repo = await repositorio();
        for (const c of await repo.listarCreditos()) {
            expect(typeof c.reestructurado).toBe("boolean");
        }
        expect((await repo.obtenerCredito("CV-2026-0201"))?.reestructurado).toBe(true);
    });

    it("Hay creditos de ambas politicas de mora", async () => {
        const creditos = await (await repositorio()).listarCreditos();
        const vigencia = new Date(2026, 9, 1);

        expect(creditos.filter(c => c.fechaDesembolso < vigencia).length).toBeGreaterThan(0);
        expect(creditos.filter(c => c.fechaDesembolso >= vigencia).length).toBeGreaterThan(0);
    });

    it("Un credito o cliente inexistente devuelve undefined", async () => {
        const repo = await repositorio();
        expect(await repo.obtenerCredito("CV-NO-EXISTE")).toBeUndefined();
        expect(await repo.obtenerCliente("CL-NO-EXISTE")).toBeUndefined();
    });
});

describe("Repositorio Postgres - pagos por credito", { timeout: 60_000 }, () => {

    it("Devuelve los pagos de un credito en orden cronologico", async () => {
        const pagos = await (await repositorio()).pagosDe("CV-2026-0001");

        expect(pagos.length).toBeGreaterThan(0);

        for (let i = 1; i < pagos.length; i++) {
            expect(pagos[i]!.fecha.getTime())
                .toBeGreaterThanOrEqual(pagos[i - 1]!.fecha.getTime());
        }
    });

    it("Todos los pagos pertenecen a un credito existente", async () => {
        const repo = await repositorio();
        const ids = new Set((await repo.listarCreditos()).map(c => c.idCredito));

        for (const pago of await repo.listarPagos()) {
            expect(ids.has(pago.idCredito)).toBe(true);
        }
    });

    it("Las claves de idempotencia de los pagos aplicados son unicas", async () => {
        const pagos = await (await repositorio()).listarPagos();
        expect(new Set(pagos.map(p => p.claveIdempotencia)).size).toBe(pagos.length);
    });
});

describe("Repositorio Postgres - registro idempotente (P1 6.10)", { timeout: 60_000 }, () => {

    const nuevo = (clave: string): PagoRegistrado => ({
        claveIdempotencia: clave,
        idCredito: "CV-2026-0001",
        fecha: new Date(2026, 9, 31),
        monto: Dinero.desde(1000),
        canal: "agencia"
    });

    it("Registra un pago nuevo", async () => {
        const repo = await repositorio();

        const r = await repo.registrarPago(nuevo("IDEM-PRUEBA-001"));

        expect(r.registrado).toBe(true);
        expect(r.duplicado).toBe(false);
        expect(await repo.listarPagos()).toHaveLength(227);
    });

    it("La misma clave dos veces no altera el saldo", async () => {
        const repo = await repositorio();

        await repo.registrarPago(nuevo("IDEM-PRUEBA-002"));
        const segundo = await repo.registrarPago(nuevo("IDEM-PRUEBA-002"));

        expect(segundo.registrado).toBe(false);
        expect(segundo.duplicado).toBe(true);
        expect(await repo.listarPagos()).toHaveLength(227);
    });

    it("Una clave que ya venia en el paquete se detecta como duplicada", async () => {
        const repo = await repositorio();

        const r = await repo.registrarPago({ ...nuevo("IDEM-000001"), monto: Dinero.desde(9999) });

        expect(r.duplicado).toBe(true);
        // Devuelve el pago original, no el que se intento registrar.
        expect(r.pago.monto.obtenerCentavos()).toBe(251155);
    });

    it("Rechaza un pago de un credito que no existe", async () => {
        const repo = await repositorio();

        await expect(repo.registrarPago({
            ...nuevo("IDEM-PRUEBA-003"), idCredito: "CV-NO-EXISTE"
        })).rejects.toThrow(/no existe/);
    });

    it("El pago registrado PERSISTE: otra instancia sobre la misma base lo ve", async () => {
        const repo = await repositorio();
        await repo.registrarPago(nuevo("IDEM-PRUEBA-004"));

        const otra = new RepositorioCarteraPostgres(db);
        const pagos = await otra.listarPagos();

        expect(pagos).toHaveLength(227);
        expect(pagos.some(p => p.claveIdempotencia === "IDEM-PRUEBA-004")).toBe(true);
    });

    it("La fecha del pago se guarda sin correrse un dia", async () => {
        const repo = await repositorio();
        await repo.registrarPago(nuevo("IDEM-PRUEBA-005"));

        const r = await db.query<{ fecha: string }>(
            "SELECT fecha::text AS fecha FROM pagos WHERE clave_idempotencia = 'IDEM-PRUEBA-005'"
        );
        expect(r.rows[0]!.fecha).toBe("2026-10-31");
    });
});

describe("Paridad: Postgres y CSV son intercambiables", { timeout: 120_000 }, () => {

    it("Devuelven los mismos creditos, en el mismo orden", async () => {
        const pg = await repositorio();
        const csv = new RepositorioCarteraCsv(DATOS);

        expect((await pg.listarCreditos()).map(planoCredito))
            .toEqual((await csv.listarCreditos()).map(planoCredito));
    });

    it("Devuelven los mismos pagos, en el mismo orden", async () => {
        const pg = await repositorio();
        const csv = new RepositorioCarteraCsv(DATOS);

        expect((await pg.listarPagos()).map(planoPago))
            .toEqual((await csv.listarPagos()).map(planoPago));
    });

    it("Devuelven los mismos clientes", async () => {
        const pg = await repositorio();
        const csv = new RepositorioCarteraCsv(DATOS);

        for (const credito of await csv.listarCreditos()) {
            expect(await pg.obtenerCliente(credito.idCliente))
                .toEqual(await csv.obtenerCliente(credito.idCliente));
        }
    });

    it("El nucleo da las mismas cifras con cualquiera de los dos (G-5, G-7, OP-1/OP-2)", async () => {
        const pg = new ConsultasCartera(await repositorio());
        const csv = new ConsultasCartera(new RepositorioCarteraCsv(DATOS));

        const FUTURA = new Date(2027, 0, 24); // G-7: fecha de corte futura

        // G-5: estado del credito y como se formo la mora de su cuota 3.
        expect(await pg.consultarCredito("CV-2026-0030", CORTE))
            .toEqual(await csv.consultarCredito("CV-2026-0030", CORTE));
        expect(await pg.explicarMora("CV-2026-0030", 3, CORTE))
            .toEqual(await csv.explicarMora("CV-2026-0030", 3, CORTE));

        // G-7: interes moratorio de la cuota 2, con corte a futuro.
        expect(await pg.explicarMora("CV-2026-0410", 2, FUTURA))
            .toEqual(await csv.explicarMora("CV-2026-0410", 2, FUTURA));

        // OP-1 y OP-2: deuda de las cuotas vencidas, cuota por cuota.
        for (const id of ["CV-2026-0043", "CV-2026-0035", "CV-2026-0030"]) {
            for (let cuota = 1; cuota <= 6; cuota++) {
                expect(await pg.calcularDeudaDeCuota(id, cuota, CORTE))
                    .toEqual(await csv.calcularDeudaDeCuota(id, cuota, CORTE));
            }
        }
    });

    it("Tras registrar el mismo pago, el nucleo sigue dando las mismas cifras (OP-1)", async () => {
        const repoPg = await repositorio();
        const repoCsv = new RepositorioCarteraCsv(DATOS);
        const pg = new ConsultasCartera(repoPg);
        const csv = new ConsultasCartera(repoCsv);

        // OP-1: pagar la cuota vencida de CV-2026-0043 por lo que el
        // sistema calcula como exigible.
        const estado = await csv.consultarCredito("CV-2026-0043", CORTE);
        const cuota = estado.proximaCuota!.numero;
        const deuda = await csv.calcularDeudaDeCuota("CV-2026-0043", cuota, CORTE);

        const pago: PagoRegistrado = {
            claveIdempotencia: "IDEM-OP1-PRUEBA",
            idCredito: "CV-2026-0043",
            fecha: CORTE,
            monto: Dinero.desde(deuda.totalExigible),
            canal: "agencia"
        };

        await repoPg.registrarPago(pago);
        await repoCsv.registrarPago(pago);

        expect(await pg.consultarCredito("CV-2026-0043", CORTE))
            .toEqual(await csv.consultarCredito("CV-2026-0043", CORTE));

        // Y el reintento con la misma clave (OP-4) no cambia nada en ninguno.
        const antes = await pg.consultarCredito("CV-2026-0043", CORTE);
        expect((await repoPg.registrarPago(pago)).duplicado).toBe(true);
        expect(await pg.consultarCredito("CV-2026-0043", CORTE)).toEqual(antes);
    });
});
