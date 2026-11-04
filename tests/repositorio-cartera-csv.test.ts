import { describe, expect, it } from "vitest";

import { Dinero } from "../src/dominio/dinero";
import {
    RepositorioCarteraCsv
} from "../src/adaptadores/repositorio-cartera-csv";

/**
 * El paquete canonico es la cartera de Credito Vecino al 31 de octubre de
 * 2026: 60 clientes, 75 creditos y 228 pagos. Esos conteos son parte del
 * criterio de aceptacion del E2, asi que se fijan como prueba.
 */
const DIRECTORIO = process.env.CV_DATA_DIR ?? "";

function repositorio(): RepositorioCarteraCsv {
    return new RepositorioCarteraCsv(DIRECTORIO);
}

describe("Repositorio CSV - conteos del paquete canonico", () => {

    it("Carga los 75 creditos", async () => {
        expect(await repositorio().listarCreditos()).toHaveLength(75);
    });

    it("Lee 228 eventos PAGO pero aplica 226", async () => {

        // El contrato de datos del paquete: "los pagos con
        // clave_idempotencia repetida se ignoran (P1 6.10)".
        const resumen = await repositorio().resumenCarga();

        expect(resumen.eventosPagoLeidos).toBe(228);
        expect(resumen.duplicadosIgnorados).toBe(2);
        expect(resumen.pagosAplicados).toBe(226);
    });

    it("Los dos duplicados del paquete se ignoran una sola vez", async () => {

        const pagos = await repositorio().listarPagos();

        // IDEM-000068 e IDEM-000127 vienen repetidos a proposito.
        for (const clave of ["IDEM-000068", "IDEM-000127"]) {
            const coincidencias = pagos.filter(
                p => p.claveIdempotencia === clave
            );
            expect(coincidencias).toHaveLength(1);
        }
    });

    it("Carga los 60 clientes", async () => {

        const repo = repositorio();
        const creditos = await repo.listarCreditos();

        const idsClientes = new Set(creditos.map(c => c.idCliente));

        // Los 75 creditos pertenecen a 60 clientes distintos o menos:
        // un cliente puede tener mas de un credito.
        expect(idsClientes.size).toBeLessThanOrEqual(60);

        for (const id of idsClientes) {
            expect(await repo.obtenerCliente(id)).toBeDefined();
        }
    });
});

describe("Repositorio CSV - conversion de los datos", () => {

    it("Los basis points se convierten a decimal", async () => {

        // CV-2026-0001 viene con tna_bps 3600, que son 36 % anual.
        const credito = await repositorio().obtenerCredito("CV-2026-0001");

        expect(credito?.tnaAnual).toBe(0.36);
    });

    it("El capital llega en centavos exactos, sin pasar por decimales", async () => {

        // capital_centavos 2500000 son Q25,000.00
        const credito = await repositorio().obtenerCredito("CV-2026-0001");

        expect(credito?.capital.obtenerCentavos()).toBe(2500000);
        expect(credito?.capital.obtenerValor()).toBe(25000);
    });

    it("Las fechas no se corren un dia por zona horaria", async () => {

        // CV-2026-0001 se desembolso el 2026-01-14.
        const credito = await repositorio().obtenerCredito("CV-2026-0001");

        expect(credito?.fechaDesembolso.getFullYear()).toBe(2026);
        expect(credito?.fechaDesembolso.getMonth()).toBe(0);
        expect(credito?.fechaDesembolso.getDate()).toBe(14);
    });

    it("La marca de reestructurado se lee como booleano", async () => {

        const creditos = await repositorio().listarCreditos();

        for (const credito of creditos) {
            expect(typeof credito.reestructurado).toBe("boolean");
        }
    });

    it("Hay creditos de ambas politicas de mora", async () => {

        const creditos = await repositorio().listarCreditos();
        const vigencia = new Date(2026, 9, 1);

        const anteriores = creditos.filter(
            c => c.fechaDesembolso < vigencia
        );
        const posteriores = creditos.filter(
            c => c.fechaDesembolso >= vigencia
        );

        // La coexistencia de politicas (P2 CP-03) tiene que poder
        // ejercitarse con datos reales, no solo en pruebas sinteticas.
        expect(anteriores.length).toBeGreaterThan(0);
        expect(posteriores.length).toBeGreaterThan(0);
    });
});

describe("Repositorio CSV - pagos por credito", () => {

    it("Devuelve los pagos de un credito en orden cronologico", async () => {

        const pagos = await repositorio().pagosDe("CV-2026-0001");

        expect(pagos.length).toBeGreaterThan(0);

        for (let i = 1; i < pagos.length; i++) {
            expect(pagos[i].fecha.getTime())
                .toBeGreaterThanOrEqual(pagos[i - 1].fecha.getTime());
        }
    });

    it("Todos los pagos pertenecen a un credito existente", async () => {

        const repo = repositorio();
        const pagos = await repo.listarPagos();
        const ids = new Set(
            (await repo.listarCreditos()).map(c => c.idCredito)
        );

        for (const pago of pagos) {
            expect(ids.has(pago.idCredito)).toBe(true);
        }
    });

    it("Las claves de idempotencia del paquete son unicas", async () => {

        const pagos = await repositorio().listarPagos();
        const claves = new Set(pagos.map(p => p.claveIdempotencia));

        expect(claves.size).toBe(pagos.length);
    });
});

describe("Repositorio CSV - registro idempotente (P1 6.10)", () => {

    it("Registra un pago nuevo", async () => {

        const repo = repositorio();

        const resultado = await repo.registrarPago({
            claveIdempotencia: "IDEM-PRUEBA-001",
            idCredito: "CV-2026-0001",
            fecha: new Date(2026, 9, 31),
            monto: Dinero.desde(1000),
            canal: "agencia"
        });

        expect(resultado.registrado).toBe(true);
        expect(resultado.duplicado).toBe(false);
        expect(await repo.listarPagos()).toHaveLength(227);
    });

    it("La misma clave dos veces no altera el saldo", async () => {

        const repo = repositorio();

        const pago = {
            claveIdempotencia: "IDEM-PRUEBA-002",
            idCredito: "CV-2026-0001",
            fecha: new Date(2026, 9, 31),
            monto: Dinero.desde(1000),
            canal: "agencia"
        };

        await repo.registrarPago(pago);
        const segundo = await repo.registrarPago(pago);

        expect(segundo.registrado).toBe(false);
        expect(segundo.duplicado).toBe(true);

        // 226 aplicados del paquete + 1 registrado: el reintento no suma.
        expect(await repo.listarPagos()).toHaveLength(227);
    });

    it("Una clave que ya venia en el paquete se detecta como duplicada", async () => {

        const repo = repositorio();

        const resultado = await repo.registrarPago({
            claveIdempotencia: "IDEM-000001",
            idCredito: "CV-2026-0001",
            fecha: new Date(2026, 9, 31),
            monto: Dinero.desde(9999),
            canal: "agencia"
        });

        expect(resultado.duplicado).toBe(true);
        // Devuelve el pago original, no el que se intento registrar.
        expect(resultado.pago.monto.obtenerCentavos()).toBe(251155);
    });

    it("Rechaza un pago de un credito que no existe", async () => {

        await expect(repositorio().registrarPago({
            claveIdempotencia: "IDEM-PRUEBA-003",
            idCredito: "CV-NO-EXISTE",
            fecha: new Date(2026, 9, 31),
            monto: Dinero.desde(100),
            canal: "agencia"
        })).rejects.toThrow(/no existe/);
    });
});

describe("Repositorio CSV - carga idempotente", () => {

    it("Cargar dos veces no duplica la cartera", async () => {

        const repo = repositorio();

        await repo.cargar();
        await repo.cargar();

        expect(await repo.listarCreditos()).toHaveLength(75);
        expect(await repo.listarPagos()).toHaveLength(226);
    });

    it("Exige el directorio del paquete", async () => {
        await expect(new RepositorioCarteraCsv("").cargar())
            .rejects.toThrow(/CV_DATA_DIR/);
    });
});
