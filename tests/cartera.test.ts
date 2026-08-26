import { describe, expect, it } from "vitest";

import { Cartera } from "../src/servicios/cartera";
import { PosicionCartera } from "../src/dominio/posicion-cartera";
import { Dinero } from "../src/dominio/dinero";
import { NombreEstado } from "../src/dominio/nombre-estado";

/**
 * Caso de referencia obligatorio (seccion 6.8.1).
 *
 * Credito   Saldo (Q)    Dias   Reestructurado   En riesgo
 * C-001     620,000.00      0   No               No
 * C-002     124,000.00      8   No               No  (no supera 30 dias)
 * C-003      24,000.00     45   No               Si
 * C-004      18,000.00     75   No               Si
 * C-005       8,000.00    100   No               Si
 * C-006       6,000.00      0   Si               Si  (al dia, pero marcado)
 * C-007      15,000.00    210   Incobrable       Excluido de ambas sumas
 */
function carteraDeReferencia(): Cartera {
    return new Cartera([
        new PosicionCartera("C-001", Dinero.desde(620000), 0, NombreEstado.VIGENTE),
        new PosicionCartera("C-002", Dinero.desde(124000), 8, NombreEstado.EN_MORA),
        new PosicionCartera("C-003", Dinero.desde(24000), 45, NombreEstado.EN_MORA),
        new PosicionCartera("C-004", Dinero.desde(18000), 75, NombreEstado.EN_MORA),
        new PosicionCartera("C-005", Dinero.desde(8000), 100, NombreEstado.EN_MORA),
        new PosicionCartera("C-006", Dinero.desde(6000), 0, NombreEstado.VIGENTE, true),
        new PosicionCartera("C-007", Dinero.desde(15000), 210, NombreEstado.INCOBRABLE)
    ]);
}

function comoPorcentaje(proporcion: number): number {
    return Number((proporcion * 100).toFixed(2));
}

describe("Cartera en riesgo - caso de referencia 6.8.1", () => {

    it("La cartera activa es Q800,000.00 (C-007 incobrable queda fuera)", () => {
        expect(carteraDeReferencia().carteraActiva().obtenerValor()).toBe(800000);
    });

    it("El monto en riesgo es Q56,000.00", () => {
        expect(carteraDeReferencia().montoEnRiesgo().obtenerValor()).toBe(56000);
    });

    it("La cartera en riesgo es 7.00%", () => {
        expect(comoPorcentaje(carteraDeReferencia().porcentajeEnRiesgo())).toBe(7.00);
    });
});

describe("Cartera en riesgo - los tres matices del calculo", () => {

    it("C-002 con 8 dias de atraso NO entra: en mora no es lo mismo que en riesgo", () => {

        const c002 = carteraDeReferencia()
            .obtenerPosiciones()
            .find(p => p.creditoId === "C-002")!;

        expect(c002.estado).toBe(NombreEstado.EN_MORA);
        expect(c002.estaEnRiesgo()).toBe(false);
    });

    it("C-006 al dia pero reestructurado SI entra", () => {

        const c006 = carteraDeReferencia()
            .obtenerPosiciones()
            .find(p => p.creditoId === "C-006")!;

        expect(c006.diasAtraso).toBe(0);
        expect(c006.estaEnRiesgo()).toBe(true);
    });

    it("C-007 incobrable sale de la base Y del riesgo, no solo de uno", () => {

        const cartera = carteraDeReferencia();

        // Si solo saliera del riesgo, la base seria 815,000.
        expect(cartera.carteraActiva().obtenerValor()).toBe(800000);
        expect(cartera.dadoPorIncobrable().obtenerValor()).toBe(15000);
    });
});

describe("Cartera en riesgo - la trampa de dar por incobrable (6.8)", () => {

    it("Declarar incobrable C-005 baja el indicador a 6.06% sin cobrar nada", () => {

        const despues = carteraDeReferencia().declararIncobrable("C-005");

        expect(despues.carteraActiva().obtenerValor()).toBe(792000);
        expect(despues.montoEnRiesgo().obtenerValor()).toBe(48000);
        expect(comoPorcentaje(despues.porcentajeEnRiesgo())).toBe(6.06);
    });

    it("El reporte delata la mejora ficticia: sube lo dado por incobrable", () => {

        const antes = carteraDeReferencia().generarReporte();
        const despues = carteraDeReferencia()
            .declararIncobrable("C-005")
            .generarReporte();

        expect(comoPorcentaje(antes.porcentajeEnRiesgo)).toBe(7.00);
        expect(comoPorcentaje(despues.porcentajeEnRiesgo)).toBe(6.06);

        // El indicador "mejora", pero la baja contable crece Q8,000.
        expect(antes.dadoPorIncobrable.obtenerValor()).toBe(15000);
        expect(despues.dadoPorIncobrable.obtenerValor()).toBe(23000);
    });

    it("Declarar incobrable no muta la cartera original", () => {

        const original = carteraDeReferencia();
        original.declararIncobrable("C-005");

        expect(comoPorcentaje(original.porcentajeEnRiesgo())).toBe(7.00);
    });

    it("Rechaza dar de baja un credito que no existe", () => {
        expect(
            () => carteraDeReferencia().declararIncobrable("C-999")
        ).toThrow(/no existe/);
    });
});

describe("Cartera en riesgo - invariantes (6.10)", () => {

    it("El porcentaje siempre esta entre 0 y 1", () => {

        const porcentaje = carteraDeReferencia().porcentajeEnRiesgo();

        expect(porcentaje).toBeGreaterThanOrEqual(0);
        expect(porcentaje).toBeLessThanOrEqual(1);
    });

    it("Una cartera vacia da 0% y no divide entre cero", () => {
        expect(new Cartera([]).porcentajeEnRiesgo()).toBe(0);
    });

    it("Una cartera donde todo es incobrable da 0% y no divide entre cero", () => {

        const cartera = new Cartera([
            new PosicionCartera("C-001", Dinero.desde(1000), 200, NombreEstado.INCOBRABLE)
        ]);

        expect(cartera.carteraActiva().esCero()).toBe(true);
        expect(cartera.porcentajeEnRiesgo()).toBe(0);
    });

    it("El monto en riesgo nunca supera la cartera activa", () => {

        const cartera = carteraDeReferencia();

        expect(
            cartera.montoEnRiesgo().esMenorOIgualA(cartera.carteraActiva())
        ).toBe(true);
    });

    it("Rechaza dias de atraso negativos o fraccionarios", () => {

        expect(
            () => new PosicionCartera("X", Dinero.desde(1), -1, NombreEstado.VIGENTE)
        ).toThrow(/negativos/);

        expect(
            () => new PosicionCartera("X", Dinero.desde(1), 1.5, NombreEstado.VIGENTE)
        ).toThrow(/entero/);
    });
});
