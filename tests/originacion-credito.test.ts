import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolve } from "node:path";

import { RepositorioCarteraCsv } from "../src/adaptadores/repositorio-cartera-csv";
import { RepositorioCarteraPostgres } from "../src/adaptadores/repositorio-cartera-postgres";
import { ErrorRepositorio, type RepositorioCartera } from "../src/dominio/repositorio-cartera";
import { reiniciarCartera, type BaseDatos } from "../src/persistencia/base-datos";
import { cargarPaqueteCanonico } from "../src/persistencia/cargador";
import { ConsultasCartera, ErrorConsulta } from "../src/servicios/consultas-cartera";
import { OriginacionCredito } from "../src/servicios/originacion-credito";
import { crearBasePGlite } from "./ayudas/base-pglite";

/**
 * Originacion y planes (E1: pantallas Solicitud y Plan de amortizacion).
 *
 * El plan sale del nucleo del Proyecto 1: aqui se comprueba contra el
 * caso de referencia obligatorio (P1 6.4.1) y se recorre OP-3 completo
 * con los DOS adaptadores del repositorio.
 */

const DATOS = resolve(process.env.CV_DATA_DIR ?? "./datos");
const OPERACION = new Date(2026, 9, 31);

const SOLICITUD = {
    capital: 10000,
    plazoMeses: 12,
    tnaAnual: 0.36,
    fechaDesembolso: OPERACION
};

let db: BaseDatos;

beforeAll(async () => { db = await crearBasePGlite(); }, 60_000);
afterAll(async () => { await db.cerrar(); });

async function adaptadores(): Promise<Array<[string, RepositorioCartera]>> {
    await reiniciarCartera(db);
    await cargarPaqueteCanonico(db, DATOS);
    return [
        ["CSV", new RepositorioCarteraCsv(DATOS)],
        ["Postgres", new RepositorioCarteraPostgres(db)]
    ];
}

describe("Simulacion del plan - caso de referencia del P1 (6.4.1)", () => {

    const servicio = new OriginacionCredito(new RepositorioCarteraCsv(DATOS));

    it("Q10,000 al 36 % en 12 cuotas: cuota Q1,004.62 y ultima Q1,004.63", () => {
        const plan = servicio.simularPlan(SOLICITUD);

        expect(plan.cuotas).toHaveLength(12);
        expect(plan.cuotas[0]!.cuota).toBe(1004.62);
        expect(plan.cuotas[10]!.cuota).toBe(1004.62);
        expect(plan.cuotas[11]!.cuota).toBe(1004.63);
    });

    it("Reproduce la fila 1 y la fila 12 de la tabla", () => {
        const [f1, , , , , , , , , , , f12] = servicio.simularPlan(SOLICITUD).cuotas;

        expect(f1).toMatchObject({ saldoInicial: 10000, interes: 300, capital: 704.62, saldoFinal: 9295.38 });
        expect(f12).toMatchObject({ saldoInicial: 975.37, interes: 29.26, capital: 975.37, saldoFinal: 0 });
    });

    it("Los totales cuadran: capital = P, intereses Q2,055.45, cuotas Q12,055.45", () => {
        const { totales } = servicio.simularPlan(SOLICITUD);

        expect(totales).toEqual({ cuotas: 12055.45, intereses: 2055.45, capital: 10000 });
    });

    it("El saldo final es exactamente 0 y nunca hay saldo negativo", () => {
        for (const cuotas of [3, 7, 18, 24]) {
            const plan = servicio.simularPlan({ ...SOLICITUD, plazoMeses: cuotas });
            expect(plan.cuotas.at(-1)!.saldoFinal).toBe(0);
            expect(plan.cuotas.every(f => f.saldoFinal >= 0)).toBe(true);
        }
    });

    it("Los vencimientos son mensuales desde el desembolso", () => {
        const plan = servicio.simularPlan(SOLICITUD);
        expect(plan.cuotas[0]!.fechaVencimiento).toBe("2026-11-30");
    });
});

describe("Simulacion - limites del producto", () => {

    const servicio = new OriginacionCredito(new RepositorioCarteraCsv(DATOS));

    const codigoDe = (entrada: Partial<typeof SOLICITUD>) => {
        try {
            servicio.simularPlan({ ...SOLICITUD, ...entrada });
            return undefined;
        } catch (e) {
            return (e as ErrorConsulta).codigo;
        }
    };

    it("Rechaza capital fuera de Q1,000 - Q25,000", () => {
        expect(codigoDe({ capital: 999.99 })).toBe("CAPITAL_FUERA_DE_RANGO");
        expect(codigoDe({ capital: 25000.01 })).toBe("CAPITAL_FUERA_DE_RANGO");
        expect(codigoDe({ capital: 1000 })).toBeUndefined();
        expect(codigoDe({ capital: 25000 })).toBeUndefined();
    });

    it("Rechaza un capital con mas de dos decimales", () => {
        expect(codigoDe({ capital: 5000.005 })).toBe("CAPITAL_FUERA_DE_RANGO");
    });

    it("Rechaza plazo fuera de 3 - 24 meses o no entero", () => {
        expect(codigoDe({ plazoMeses: 2 })).toBe("PLAZO_FUERA_DE_RANGO");
        expect(codigoDe({ plazoMeses: 25 })).toBe("PLAZO_FUERA_DE_RANGO");
        expect(codigoDe({ plazoMeses: 6.5 })).toBe("PLAZO_FUERA_DE_RANGO");
    });

    it("Rechaza tasa cero, negativa o fuera de razonabilidad (36 escrito como 36)", () => {
        expect(codigoDe({ tnaAnual: 0 })).toBe("TASA_INVALIDA");
        expect(codigoDe({ tnaAnual: -0.1 })).toBe("TASA_INVALIDA");
        expect(codigoDe({ tnaAnual: 36 })).toBe("TASA_INVALIDA");
    });
});

describe("OP-3 - alta de cliente y desembolso (ambos adaptadores)", { timeout: 60_000 }, () => {

    const cliente = {
        idCliente: "CL-9001",
        nombreCompleto: "Gerencia Demostración Gálvez",
        dpi: "DPI-FICT-009001",
        telefono: "5555-9001",
        municipio: "Guatemala",
        fechaAlta: OPERACION
    };

    const desembolso = {
        ...SOLICITUD,
        idCredito: "CV-2026-9001",
        idCliente: "CL-9001",
        idAsesor: "AS-01"
    };

    it("Recorre el flujo completo y el credito queda consultable", async () => {
        for (const [nombre, repo] of await adaptadores()) {

            const originacion = new OriginacionCredito(repo);

            await originacion.registrarCliente(cliente);
            const resultado = await originacion.desembolsarCredito(desembolso);

            expect(resultado.plan.cuotas, nombre).toHaveLength(12);

            const estado = await new ConsultasCartera(repo)
                .consultarCredito("CV-2026-9001", OPERACION);

            expect(estado.idCredito, nombre).toBe("CV-2026-9001");
            expect(estado.proximaCuota?.numero, nombre).toBe(1);
        }
    });

    it("El plan mostrado al desembolsar es el mismo que luego entrega obtenerPlan", async () => {
        for (const [nombre, repo] of await adaptadores()) {

            const originacion = new OriginacionCredito(repo);
            await originacion.registrarCliente(cliente);
            const { plan } = await originacion.desembolsarCredito(desembolso);

            const guardado = await originacion.obtenerPlan("CV-2026-9001", OPERACION);

            expect(guardado.cuotas.map(({ numero, cuota, interes, capital, saldoFinal, fechaVencimiento }) =>
                ({ numero, cuota, interes, capital, saldoFinal, fechaVencimiento })), nombre)
                .toEqual(plan.cuotas.map(({ numero, cuota, interes, capital, saldoFinal, fechaVencimiento }) =>
                    ({ numero, cuota, interes, capital, saldoFinal, fechaVencimiento })));
        }
    });

    it("No guarda nada si la solicitud es invalida", async () => {
        for (const [nombre, repo] of await adaptadores()) {

            const originacion = new OriginacionCredito(repo);
            await originacion.registrarCliente(cliente);

            await expect(originacion.desembolsarCredito({ ...desembolso, capital: 50 }), nombre)
                .rejects.toMatchObject({ codigo: "CAPITAL_FUERA_DE_RANGO" });

            expect(await repo.obtenerCredito("CV-2026-9001"), nombre).toBeUndefined();
        }
    });

    it("Rechaza duplicados y referencias inexistentes con ErrorRepositorio", async () => {
        for (const [nombre, repo] of await adaptadores()) {

            const originacion = new OriginacionCredito(repo);
            await originacion.registrarCliente(cliente);

            const codigo = async (tarea: Promise<unknown>) => {
                try { await tarea; return undefined; }
                catch (e) { return e instanceof ErrorRepositorio ? e.codigo : "OTRO"; }
            };

            expect(await codigo(originacion.registrarCliente(cliente)), nombre)
                .toBe("CLIENTE_DUPLICADO");

            expect(await codigo(originacion.registrarCliente({ ...cliente, idCliente: "CL-9002" })), nombre)
                .toBe("DPI_DUPLICADO");

            await originacion.desembolsarCredito(desembolso);

            expect(await codigo(originacion.desembolsarCredito(desembolso)), nombre)
                .toBe("CREDITO_DUPLICADO");

            expect(await codigo(originacion.desembolsarCredito({ ...desembolso, idCredito: "CV-2026-9002", idCliente: "CL-NO" })), nombre)
                .toBe("CLIENTE_INEXISTENTE");

            expect(await codigo(originacion.desembolsarCredito({ ...desembolso, idCredito: "CV-2026-9003", idAsesor: "AS-99" })), nombre)
                .toBe("ASESOR_INEXISTENTE");
        }
    });

    it("Un credito nuevo con fecha de octubre usa la mora escalonada", async () => {
        const [, repo] = (await adaptadores())[0]!;
        void repo;
        for (const [nombre, r] of await adaptadores()) {
            const originacion = new OriginacionCredito(r);
            await originacion.registrarCliente(cliente);
            await originacion.desembolsarCredito(desembolso);

            // 40 dias despues del primer vencimiento: la mora ya tiene tramos.
            const mora = await new ConsultasCartera(r)
                .explicarMora("CV-2026-9001", 1, new Date(2027, 0, 9));

            expect(JSON.stringify(mora), nombre).toContain("mora_2");
        }
    });
});

describe("Plan de un credito existente", { timeout: 60_000 }, () => {

    it("CV-2026-0030 devuelve sus 6 cuotas con estado y dias de atraso", async () => {
        for (const [nombre, repo] of await adaptadores()) {

            const plan = await new OriginacionCredito(repo)
                .obtenerPlan("CV-2026-0030", OPERACION);

            expect(plan.cuotas, nombre).toHaveLength(6);
            expect(plan.cuotas.at(-1)!.saldoFinal, nombre).toBe(0);
            expect(plan.cuotas.some(c => c.vencida), nombre).toBe(true);
        }
    });

    it("Un credito inexistente da CREDITO_INEXISTENTE", async () => {
        const servicio = new OriginacionCredito(new RepositorioCarteraCsv(DATOS));

        await expect(servicio.obtenerPlan("CV-2026-0000", OPERACION))
            .rejects.toMatchObject({ codigo: "CREDITO_INEXISTENTE" });
    });
});
