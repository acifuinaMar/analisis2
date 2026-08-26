import { describe, expect, it } from "vitest";

import { Dinero, Moneda } from "../src/dominio/dinero";

describe("Dinero - representacion en centavos (6.2)", () => {

    it("Guarda el importe como entero en la unidad minima", () => {

        const importe = Dinero.desde(1004.62);

        expect(importe.obtenerCentavos()).toBe(100462);
        expect(Number.isInteger(importe.obtenerCentavos())).toBe(true);
    });

    it("No arrastra error de punto flotante al sumar", () => {

        // Con Number crudo, 0.1 + 0.2 da 0.30000000000000004.
        const resultado = Dinero.desde(0.1).sumar(Dinero.desde(0.2));

        expect(resultado.obtenerCentavos()).toBe(30);
        expect(resultado.obtenerValor()).toBe(0.3);
    });

    it("No acumula error al sumar mil veces un centavo", () => {

        let total = Dinero.cero();

        for (let i = 0; i < 1000; i++) {
            total = total.sumar(Dinero.desde(0.01));
        }

        expect(total.obtenerValor()).toBe(10);
    });

    it("Redondea medio hacia arriba, no medio hacia abajo", () => {

        // toFixed(2) daba 1.00 y 2.67 por el ruido binario de IEEE-754.
        expect(Dinero.desde(1.005).obtenerValor()).toBe(1.01);
        expect(Dinero.desde(2.675).obtenerValor()).toBe(2.68);
        expect(Dinero.desde(0.125).obtenerValor()).toBe(0.13);
    });
});

describe("Dinero - moneda", () => {

    it("Prohibe sumar quetzales con dolares", () => {

        const quetzales = Dinero.desde(100, Moneda.GTQ);
        const dolares = Dinero.desde(100, Moneda.USD);

        expect(() => quetzales.sumar(dolares)).toThrow(/distinta moneda/);
        expect(() => quetzales.restar(dolares)).toThrow(/distinta moneda/);
        expect(() => quetzales.esMayorQue(dolares)).toThrow(/distinta moneda/);
    });

    it("Mismo importe en distinta moneda no es igual", () => {

        expect(
            Dinero.desde(100, Moneda.GTQ)
                .esIgualA(Dinero.desde(100, Moneda.USD))
        ).toBe(false);
    });

    it("Las operaciones conservan la moneda del operando", () => {

        const dolares = Dinero.desde(50, Moneda.USD);

        expect(dolares.multiplicar(2).obtenerMoneda()).toBe(Moneda.USD);
        expect(dolares.toString()).toBe("USD 50.00");
    });
});

describe("Dinero - inmutabilidad", () => {

    it("sumar() devuelve un objeto nuevo y no muta el original", () => {

        const original = Dinero.desde(100);
        const resultado = original.sumar(Dinero.desde(50));

        expect(original.obtenerValor()).toBe(100);
        expect(resultado.obtenerValor()).toBe(150);
        expect(resultado).not.toBe(original);
    });
});

describe("Dinero - invariantes", () => {

    it("Rechaza importes negativos", () => {
        expect(() => Dinero.desde(-1)).toThrow(/negativo/);
    });

    it("Rechaza valores no numericos", () => {
        expect(() => Dinero.desde(NaN)).toThrow(/valido/);
        expect(() => Dinero.desde(Infinity)).toThrow(/valido/);
    });

    it("Impide que una resta produzca un saldo negativo (6.10)", () => {
        expect(
            () => Dinero.desde(100).restar(Dinero.desde(150))
        ).toThrow(/negativo/);
    });

    it("Rechaza centavos fraccionarios", () => {
        expect(() => Dinero.desdeCentavos(10.5)).toThrow(/entero/);
    });

    it("No permite dividir entre cero", () => {
        expect(() => Dinero.desde(100).dividir(0)).toThrow(/cero/);
    });
});
