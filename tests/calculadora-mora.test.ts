import { describe, expect, it } from "vitest";

import { CalculadoraMora } from "../src/servicios/calculadora-mora";
import { Dinero } from "../src/dominio/dinero";

describe("Calculadora de mora", () => {

    it("Debe calcular el interés moratorio del caso de referencia", () => {

        const calculadora = new CalculadoraMora();

        const mora = calculadora.calcular(

            Dinero.desde(725.76),

            15

        );

        expect(mora.obtenerValor()).toBe(7.26);

    });

});