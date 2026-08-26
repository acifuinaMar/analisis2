import { describe, expect, it } from "vitest";

import { CalculadoraMora } from "../src/servicios/calculadora-mora";
import { Dinero } from "../src/dominio/dinero";
import { PoliticaCredito, BaseConteo } from "../src/dominio/politica-credito";

const POLITICA = new PoliticaCredito(
    "POL-2026-01",
    0.36,
    0.24,
    BaseConteo.ACTUAL_360,
    "Comite de Credito",
    new Date(2026, 0, 1)
);

describe("Calculadora de mora", () => {

    it("Debe calcular el interés moratorio del caso de referencia", () => {

        const calculadora = new CalculadoraMora(POLITICA);

        const mora = calculadora.calcular(

            Dinero.desde(725.76),

            15

        );

        expect(mora.obtenerValor()).toBe(7.26);

    });

});