import { describe, expect, it } from "vitest";

import { Credito } from "../src/dominio/credito";
import { Dinero } from "../src/dominio/dinero";
import { NombreEstado } from "../src/dominio/nombre-estado";
import { PoliticaCredito, BaseConteo } from "../src/dominio/politica-credito";
import { ClasificadorTramoMora, TramoMora } from "../src/dominio/tramo-mora";
import { TransicionInvalida } from "../src/dominio/estados/estado-credito";
import {
    Solicitado, Aprobado, Vigente, EnMora, Reestructurado,
    Cancelado, Incobrable
} from "../src/dominio/estados/estados-credito";

const POLITICA = new PoliticaCredito(
    "POL-2026-01", 0.36, 0.24, BaseConteo.ACTUAL_360,
    "Comite de Credito", new Date(2026, 0, 1)
);

const clasificador = new ClasificadorTramoMora();

function credito(estadoInicial = new Vigente()): Credito {
    return new Credito(
        "CR-001",
        Dinero.desde(10000),
        Dinero.desde(10000),
        POLITICA,
        12,
        new Date(2026, 0, 15),
        estadoInicial
    );
}

/** Atajo para describir la situacion con la que el estado decide. */
function situacion(diasAtraso: number, saldoEnCero = false) {
    return { diasAtraso, saldoEnCero };
}

describe("Ciclo de vida - avance normal (tabla 6.7.1)", () => {

    it("solicitado -> aprobado cuando el comite aprueba", () => {
        const c = credito(new Solicitado());
        c.aprobar();
        expect(c.nombreEstado()).toBe(NombreEstado.APROBADO);
    });

    it("solicitado -> rechazado (terminal)", () => {
        const c = credito(new Solicitado());
        c.rechazar();
        expect(c.nombreEstado()).toBe(NombreEstado.RECHAZADO);
        expect(c.obtenerEstado().esTerminal()).toBe(true);
    });

    it("aprobado -> vigente al desembolsar", () => {
        const c = credito(new Aprobado());
        c.desembolsar();
        expect(c.nombreEstado()).toBe(NombreEstado.VIGENTE);
    });

    it("aprobado -> anulado si el cliente desiste antes del desembolso", () => {
        const c = credito(new Aprobado());
        c.anular();
        expect(c.nombreEstado()).toBe(NombreEstado.ANULADO);
    });

    it("vigente -> cancelado al pagar la ultima cuota (saldo = 0.00)", () => {
        const c = credito();
        c.registrarPago(situacion(0, true));
        expect(c.nombreEstado()).toBe(NombreEstado.CANCELADO);
    });
});

describe("Ciclo de vida - deterioro (tabla 6.7.1)", () => {

    it("vigente -> en_mora cuando vence una cuota impagada", () => {
        const c = credito();
        c.evaluarAlCorte(situacion(1));
        expect(c.nombreEstado()).toBe(NombreEstado.EN_MORA);
    });

    it("en_mora -> reestructurado cuando el comite autoriza", () => {
        const c = credito(new EnMora());
        c.reestructurar();
        expect(c.nombreEstado()).toBe(NombreEstado.REESTRUCTURADO);
    });

    it("en_mora -> incobrable al superar los 120 dias", () => {
        const c = credito(new EnMora());
        c.declararIncobrable(121);
        expect(c.nombreEstado()).toBe(NombreEstado.INCOBRABLE);
    });

    it("No se puede dar de baja con 120 dias o menos", () => {
        const c = credito(new EnMora());
        expect(() => c.declararIncobrable(120)).toThrow(/120 dias/);
    });
});

/**
 * PRUEBA OBLIGATORIA DEL ENUNCIADO:
 * "un credito con 45 dias de atraso (Mora 2) que paga y queda con 10 dias
 *  clasifica en Mora 1; si paga todo lo vencido, vuelve a vigente".
 */
describe("Ciclo de vida - REVERSIBILIDAD (seccion 6.7)", () => {

    it("45 dias (Mora 2) -> paga y queda con 10 dias -> Mora 1, sigue en mora", () => {

        const c = credito();

        c.evaluarAlCorte(situacion(45));
        expect(c.nombreEstado()).toBe(NombreEstado.EN_MORA);
        expect(clasificador.clasificar(45)).toBe(TramoMora.MORA_2);

        c.registrarPago(situacion(10));

        // El ESTADO sigue en_mora: un abono parcial no regulariza.
        expect(c.nombreEstado()).toBe(NombreEstado.EN_MORA);
        // El TRAMO si baja: es una clasificacion derivada.
        expect(clasificador.clasificar(10)).toBe(TramoMora.MORA_1);
    });

    it("Si paga TODO lo vencido vuelve a vigente (regularizacion)", () => {

        const c = credito();
        c.evaluarAlCorte(situacion(45));

        c.registrarPago(situacion(0));

        expect(c.nombreEstado()).toBe(NombreEstado.VIGENTE);
        expect(clasificador.clasificar(0)).toBe(TramoMora.AL_DIA);
    });

    it("Un credito Vencido (100 dias) tambien puede regularizar", () => {

        const c = credito();
        c.evaluarAlCorte(situacion(100));
        expect(clasificador.clasificar(100)).toBe(TramoMora.VENCIDO);

        c.registrarPago(situacion(0));
        expect(c.nombreEstado()).toBe(NombreEstado.VIGENTE);
    });

    it("El credito puede deteriorarse y recuperarse muchas veces", () => {

        const c = credito();

        for (const dias of [40, 0, 70, 0, 15, 0]) {
            c.evaluarAlCorte(situacion(dias));
            c.registrarPago(situacion(dias));

            expect(c.nombreEstado()).toBe(
                dias === 0 ? NombreEstado.VIGENTE : NombreEstado.EN_MORA
            );
        }
    });

    it("reestructurado -> vigente al cumplir, pero la marca no se borra", () => {

        const c = credito(new EnMora());
        c.reestructurar();

        c.registrarPago(situacion(0));

        expect(c.nombreEstado()).toBe(NombreEstado.VIGENTE);
        expect(c.estaMarcadoReestructurado()).toBe(true);
    });

    it("reestructurado -> en_mora si se atrasa en el nuevo plan", () => {

        const c = credito(new Reestructurado());
        c.evaluarAlCorte(situacion(5));

        expect(c.nombreEstado()).toBe(NombreEstado.EN_MORA);
    });

    it("reestructurado -> cancelado al pagar la ultima cuota nueva", () => {

        const c = credito(new Reestructurado());
        c.registrarPago(situacion(0, true));

        expect(c.nombreEstado()).toBe(NombreEstado.CANCELADO);
    });
});

/**
 * "Las transiciones invalidas deben ser imposibles por diseno (patron
 *  State), no evitadas con un if."
 */
describe("Ciclo de vida - transiciones invalidas (6.7 y 6.10)", () => {

    it("Un credito solicitado NO puede recibir un pago", () => {

        const c = credito(new Solicitado());

        expect(() => c.registrarPago(situacion(0)))
            .toThrow(TransicionInvalida);
        expect(c.admitePagos()).toBe(false);
    });

    it("Un credito rechazado tampoco puede recibir un pago (invariante 6.10)", () => {

        const c = credito(new Solicitado());
        c.rechazar();

        expect(() => c.registrarPago(situacion(0)))
            .toThrow(TransicionInvalida);
    });

    it("Un credito cancelado no puede entrar en mora", () => {

        const c = credito(new Cancelado());
        c.evaluarAlCorte(situacion(60));

        expect(c.nombreEstado()).toBe(NombreEstado.CANCELADO);
    });

    it("Un incobrable NO regresa a la cartera si el cliente paga despues", () => {

        const c = credito(new Incobrable());

        expect(() => c.registrarPago(situacion(0)))
            .toThrow(TransicionInvalida);
        expect(c.nombreEstado()).toBe(NombreEstado.INCOBRABLE);
    });

    it("Un credito vigente no puede aprobarse ni desembolsarse otra vez", () => {

        const c = credito();

        expect(() => c.aprobar()).toThrow(TransicionInvalida);
        expect(() => c.desembolsar()).toThrow(TransicionInvalida);
    });

    it("El error dice que estado y que evento se intento", () => {

        const c = credito(new Solicitado());

        try {
            c.registrarPago(situacion(0));
            throw new Error("debio lanzar TransicionInvalida");
        } catch (error) {
            expect(error).toBeInstanceOf(TransicionInvalida);
            expect((error as TransicionInvalida).estado)
                .toBe(NombreEstado.SOLICITADO);
            expect((error as TransicionInvalida).evento)
                .toBe("registrarPago");
        }
    });

    it("No existe ningun setter que salte a un estado arbitrario", () => {

        const sinTipar = credito() as unknown as Record<string, unknown>;

        expect(sinTipar.actualizarEstado).toBeUndefined();
    });
});
