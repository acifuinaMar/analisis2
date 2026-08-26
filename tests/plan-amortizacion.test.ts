import { describe, expect, it } from "vitest";

import { Credito } from "../src/dominio/credito";
import { Dinero } from "../src/dominio/dinero";
import { Cuota } from "../src/dominio/cuota";
import { PlanAmortizacion } from "../src/dominio/plan-amortizacion";
import { CalculoFrances } from "../src/estrategias/calculo-frances";

// Caso de referencia obligatorio (enunciado 6.4.1):
// P = Q10,000.00 · TNA 36% nominal -> i = 3% mensual · n = 12 cuotas.
const MONTO = 10000;
const TASA_ANUAL = 0.36;
const PLAZO_MESES = 12;

// Tabla de la seccion 6.4.1, celda por celda.
// [numero, cuota, interes, amortizacion, saldoFinal]
const TABLA_REFERENCIA: ReadonlyArray<
    readonly [number, number, number, number, number]
> = [
    [1, 1004.62, 300.00, 704.62, 9295.38],
    [2, 1004.62, 278.86, 725.76, 8569.62],
    [3, 1004.62, 257.09, 747.53, 7822.09],
    [4, 1004.62, 234.66, 769.96, 7052.13],
    [5, 1004.62, 211.56, 793.06, 6259.07],
    [6, 1004.62, 187.77, 816.85, 5442.22],
    [7, 1004.62, 163.27, 841.35, 4600.87],
    [8, 1004.62, 138.03, 866.59, 3734.28],
    [9, 1004.62, 112.03, 892.59, 2841.69],
    [10, 1004.62, 85.25, 919.37, 1922.32],
    [11, 1004.62, 57.67, 946.95, 975.37],
    [12, 1004.63, 29.26, 975.37, 0.00]
];

function generarPlanDeReferencia(): Cuota[] {
    const credito = new Credito(
        "CR-001",
        Dinero.desde(MONTO),
        Dinero.desde(MONTO),
        TASA_ANUAL,
        PLAZO_MESES
    );

    return new PlanAmortizacion(credito, new CalculoFrances()).generarPlan();
}

describe("Plan de amortizacion frances - caso de referencia 6.4.1", () => {

    it("Debe generar exactamente 12 cuotas", () => {
        expect(generarPlanDeReferencia()).toHaveLength(PLAZO_MESES);
    });

    it.each(TABLA_REFERENCIA)(
        "Cuota %i: monto Q%d, interes Q%d, amortizacion Q%d, saldo final Q%d",
        (numero, montoCuota, interes, amortizacion) => {

            const cuota = generarPlanDeReferencia()[numero - 1];

            expect(cuota.numero).toBe(numero);
            expect(cuota.monto.obtenerValor()).toBe(montoCuota);
            expect(cuota.interes.obtenerValor()).toBe(interes);
            expect(cuota.capital.obtenerValor()).toBe(amortizacion);
        }
    );

    it("El saldo tras cada cuota debe coincidir con la tabla", () => {

        const cuotas = generarPlanDeReferencia();

        // Se trabaja en centavos para que la propia prueba no arrastre
        // error de punto flotante al acumular.
        let saldoCentavos = Math.round(MONTO * 100);

        TABLA_REFERENCIA.forEach(([numero, , , , saldoEsperado]) => {
            saldoCentavos -= Math.round(
                cuotas[numero - 1].capital.obtenerValor() * 100
            );
            expect(saldoCentavos / 100).toBe(saldoEsperado);
        });
    });

    it("La ultima cuota lleva el ajuste de cuadre (Q1,004.63)", () => {

        const cuotas = generarPlanDeReferencia();
        const ultima = cuotas[PLAZO_MESES - 1];
        const anterior = cuotas[PLAZO_MESES - 2];

        expect(ultima.monto.obtenerValor()).toBe(1004.63);
        expect(ultima.monto.esMayorQue(anterior.monto)).toBe(true);
    });
});

describe("Invariantes del dominio (6.10)", () => {

    it("La suma de las amortizaciones es exactamente el capital desembolsado", () => {

        const cuotas = generarPlanDeReferencia();

        const totalCentavos = cuotas.reduce(
            (acumulado, cuota) =>
                acumulado + Math.round(cuota.capital.obtenerValor() * 100),
            0
        );

        expect(totalCentavos).toBe(Math.round(MONTO * 100));
    });

    it("El saldo tras la ultima cuota es exactamente 0.00", () => {

        const cuotas = generarPlanDeReferencia();

        const saldoCentavos = cuotas.reduce(
            (saldo, cuota) =>
                saldo - Math.round(cuota.capital.obtenerValor() * 100),
            Math.round(MONTO * 100)
        );

        expect(saldoCentavos).toBe(0);
    });

    it("Ninguna cuota tiene capital o interes negativo", () => {

        for (const cuota of generarPlanDeReferencia()) {
            expect(cuota.capital.obtenerValor()).toBeGreaterThanOrEqual(0);
            expect(cuota.interes.obtenerValor()).toBeGreaterThanOrEqual(0);
        }
    });

    it("Los totales coinciden con la tabla: Q12,055.45 pagado y Q2,055.45 de interes", () => {

        const cuotas = generarPlanDeReferencia();

        const totalPagado = cuotas.reduce(
            (a, c) => a + Math.round(c.monto.obtenerValor() * 100), 0
        );
        const totalInteres = cuotas.reduce(
            (a, c) => a + Math.round(c.interes.obtenerValor() * 100), 0
        );

        expect(totalPagado / 100).toBe(12055.45);
        expect(totalInteres / 100).toBe(2055.45);
    });
});
