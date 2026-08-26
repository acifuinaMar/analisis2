import { describe, expect, it } from "vitest";

import { Credito } from "../src/dominio/credito";
import { Dinero } from "../src/dominio/dinero";
import { PlanAmortizacion } from "../src/dominio/plan-amortizacion";
import { CalculoFrances } from "../src/estrategias/calculo-frances";

describe("Plan de amortización francés", () => {

    it("Debe generar 12 cuotas para un crédito a 12 meses", () => {

        const credito = new Credito(
            "CR-001",
            Dinero.desde(10000),
            Dinero.desde(10000),
            0.36,
            12
        );

        const plan = new PlanAmortizacion(
            credito,
            new CalculoFrances()
        );

        const cuotas = plan.generarPlan();

        expect(cuotas[0].monto.obtenerValor()).toBeCloseTo(1004.62, 2);
        console.log(cuotas[0]);
        console.log(cuotas[1]);
        console.log(cuotas[2]);
        console.log(cuotas[3]);
        console.log(cuotas[4]);
        console.log(cuotas[5]);
        console.log(cuotas[6]);
        console.log(cuotas[7]);
        console.log(cuotas[8]);
        console.log(cuotas[9]);
        console.log(cuotas[10]);
        console.log(cuotas[11]);
    });

});