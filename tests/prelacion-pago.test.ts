import { describe, expect, it } from "vitest";

import { PrelacionPago } from "../src/servicios/prelacion-pago";
import { Dinero } from "../src/dominio/dinero";

describe("Prelación de pagos", () => {

    it("Escenario A - Pago exacto", () => {

        const prelacion = new PrelacionPago();

        const resultado = prelacion.aplicar(

            Dinero.desde(1011.88),

            Dinero.desde(0),

            Dinero.desde(7.26),

            Dinero.desde(278.86),

            Dinero.desde(725.76)

        );

        expect(resultado.gastos.obtenerValor()).toBe(0);

        expect(resultado.interesMoratorio.obtenerValor()).toBe(7.26);

        expect(resultado.interesCorriente.obtenerValor()).toBe(278.86);

        expect(resultado.capital.obtenerValor()).toBe(725.76);

        expect(resultado.excedente.obtenerValor()).toBe(0);

    });

    it("Escenario B - Pago parcial", () => {
        const prelacion = new PrelacionPago();

        const resultado = prelacion.aplicar(

            Dinero.desde(500),

            Dinero.desde(0),

            Dinero.desde(7.26),

            Dinero.desde(278.86),

            Dinero.desde(725.76)

        );

        expect(resultado.gastos.obtenerValor()).toBe(0);

        expect(resultado.interesMoratorio.obtenerValor()).toBe(7.26);

        expect(resultado.interesCorriente.obtenerValor()).toBe(278.86);

        expect(resultado.capital.obtenerValor()).toBe(213.88);

        expect(resultado.excedente.obtenerValor()).toBe(0);
    });
    it("Escenario C - Pago con excedente", () => {
        const prelacion = new PrelacionPago();

        const resultado = prelacion.aplicar(

            Dinero.desde(3000),

            Dinero.desde(0),

            Dinero.desde(7.26),

            Dinero.desde(278.86),

            Dinero.desde(725.76)

        );

        expect(resultado.gastos.obtenerValor()).toBe(0);

        expect(resultado.interesMoratorio.obtenerValor()).toBe(7.26);

        expect(resultado.interesCorriente.obtenerValor()).toBe(278.86);

        expect(resultado.capital.obtenerValor()).toBe(725.76);

        expect(resultado.excedente.obtenerValor()).toBe(1988.12);

    });
});