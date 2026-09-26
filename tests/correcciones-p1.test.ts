import { describe, expect, it } from "vitest";
import { addDays, addMonths } from "date-fns";

import { Credito } from "../src/dominio/credito";
import { Dinero } from "../src/dominio/dinero";
import { Pago } from "../src/dominio/pago";
import { DevengoInteres } from "../src/dominio/devengo-interes";
import { NombreEstado } from "../src/dominio/nombre-estado";
import { PlanAmortizacion } from "../src/dominio/plan-amortizacion";
import { PoliticaCredito, BaseConteo } from "../src/dominio/politica-credito";
import { EnMora, Solicitado } from "../src/dominio/estados/estados-credito";
import { TransicionInvalida } from "../src/dominio/estados/estado-credito";
import { CalculoFrances } from "../src/estrategias/calculo-frances";

const POLITICA = new PoliticaCredito(
    "POL-2026-10", 0.36, 0.24, BaseConteo.ACTUAL_360,
    "Comite de Credito", new Date(2026, 9, 1)
);

const DESEMBOLSO = new Date(2026, 9, 10);

function planCon(estadoInicial?: EnMora): PlanAmortizacion {

    const credito = new Credito(
        "CV-2026-0410",
        Dinero.desde(10000),
        Dinero.desde(10000),
        POLITICA,
        12,
        DESEMBOLSO,
        estadoInicial
    );

    const plan = new PlanAmortizacion(credito, new CalculoFrances());
    plan.generarPlan();

    return plan;
}

function creditoDe(plan: PlanAmortizacion): Credito {
    return (plan as unknown as { credito: Credito }).credito;
}

/** Corte a N dias del vencimiento de la ultima cuota. */
function corteFinal(dias: number): Date {
    return addDays(addMonths(DESEMBOLSO, 11), dias);
}

describe("CP-04.1 · transicion en_mora -> cancelado", () => {

    it("Un credito EN MORA que liquida todo su saldo queda CANCELADO", () => {

        // La tabla 6.7.1 del P1 no contemplaba esta transicion, pero el
        // escenario C de pago de mas (6.6.5) la exige. Un credito en mora
        // que paga todo no tenia a donde ir.
        const plan = planCon(new EnMora());
        const credito = creditoDe(plan);
        const corte = corteFinal(30);

        expect(credito.nombreEstado()).toBe(NombreEstado.EN_MORA);

        plan.aplicarPago(new Pago(Dinero.desde(30000), corte, "efectivo"), corte);

        expect(credito.saldoCapital.esCero()).toBe(true);
        expect(credito.nombreEstado()).toBe(NombreEstado.CANCELADO);
    });

    it("La guarda exige saldo cero Y sin cuotas vencidas pendientes", () => {

        const plan = planCon(new EnMora());
        const credito = creditoDe(plan);
        const corte = corteFinal(30);

        // Un pago que liquida el capital pero deja intereses vencidos sin
        // pagar NO cancela: el credito sigue debiendo.
        plan.aplicarPago(new Pago(Dinero.desde(10000), corte, "efectivo"), corte);

        expect(credito.nombreEstado()).not.toBe(NombreEstado.CANCELADO);
        expect(plan.cuotasExigibles(corte).length).toBeGreaterThan(0);
    });

    it("Cancelado es terminal: no vuelve a mora aunque pase el tiempo", () => {

        const plan = planCon(new EnMora());
        const credito = creditoDe(plan);
        const corte = corteFinal(30);

        plan.aplicarPago(new Pago(Dinero.desde(30000), corte, "efectivo"), corte);
        plan.actualizarEstado(corteFinal(400));

        expect(credito.nombreEstado()).toBe(NombreEstado.CANCELADO);
        expect(credito.obtenerEstado().esTerminal()).toBe(true);
    });

    it("Sigue siendo imposible pagar un credito solicitado", () => {

        const credito = new Credito(
            "CV-X", Dinero.desde(10000), Dinero.desde(10000),
            POLITICA, 12, DESEMBOLSO, new Solicitado()
        );

        const plan = new PlanAmortizacion(credito, new CalculoFrances());
        plan.generarPlan();

        const corte = addDays(DESEMBOLSO, 40);

        expect(() => plan.aplicarPago(
            new Pago(Dinero.desde(1000), corte, "efectivo"), corte
        )).toThrow(TransicionInvalida);
    });
});

describe("CP-04.2 · suspension del devengo de interes corriente", () => {

    const devengo = new DevengoInteres();

    it("El devengo se suspende pasados los 90 dias, no a los 90", () => {
        expect(devengo.estaSuspendido(90)).toBe(false);
        expect(devengo.estaSuspendido(91)).toBe(true);
    });

    it("Entre el corte al dia 90 y el del dia 100, el ingreso NO aumenta", () => {

        const plan = planCon();
        const cuotas = plan.obtenerCuotas();

        const corte90 = addDays(addMonths(DESEMBOLSO, 1), 90);
        const corte100 = addDays(addMonths(DESEMBOLSO, 1), 100);

        // Los dias de atraso del credito se pasan explicitos, como los
        // plantea el enunciado: un corte al dia 90 y otro al dia 100.
        const ingreso90 = devengo.ingresoPorInteresCorriente(
            cuotas, corte90, 90
        );

        const ingreso100 = devengo.ingresoPorInteresCorriente(
            cuotas, corte100, 100
        );

        expect(ingreso100.esMenorOIgualA(ingreso90)).toBe(true);
    });

    it("...y el interes en suspenso SI aumenta", () => {

        const plan = planCon();
        const cuotas = plan.obtenerCuotas();

        const corte90 = addDays(addMonths(DESEMBOLSO, 1), 90);
        const corte100 = addDays(addMonths(DESEMBOLSO, 1), 100);

        const suspenso90 = devengo.interesEnSuspenso(cuotas, corte90, 90);

        const suspenso100 = devengo.interesEnSuspenso(cuotas, corte100, 100);

        expect(suspenso90.esCero()).toBe(true);
        expect(suspenso100.esMayorQue(Dinero.cero())).toBe(true);
    });

    it("Lo suspendido es cuenta de orden: nunca es ingreso a la vez", () => {

        const plan = planCon();
        const cuotas = plan.obtenerCuotas();
        const corte = addDays(addMonths(DESEMBOLSO, 1), 100);

        const ingreso = devengo.ingresoPorInteresCorriente(cuotas, corte, 100);
        const suspenso = devengo.interesEnSuspenso(cuotas, corte, 100);

        // Un mismo quetzal no puede estar en las dos cuentas.
        expect(ingreso.esCero()).toBe(true);
        expect(suspenso.esMayorQue(Dinero.cero())).toBe(true);
    });

    it("Al regularizar, el devengo se reactiva y lo acumulado se reconoce", () => {

        const plan = planCon();
        const cuotas = plan.obtenerCuotas();
        const corte = addDays(addMonths(DESEMBOLSO, 1), 100);

        const enSuspenso = devengo.interesEnSuspenso(cuotas, corte, 100);
        expect(enSuspenso.esMayorQue(Dinero.cero())).toBe(true);

        // Mismo corte, mismas cuotas, pero el credito ya regularizo.
        const ingresoTrasRegularizar = devengo
            .ingresoPorInteresCorriente(cuotas, corte, 0);

        expect(ingresoTrasRegularizar.esIgualA(enSuspenso)).toBe(true);
        expect(devengo.interesEnSuspenso(cuotas, corte, 0).esCero()).toBe(true);
    });

    it("El interes de una cuota que aun no vence no se ha devengado", () => {

        const plan = planCon();
        const cuotas = plan.obtenerCuotas();

        // Corte antes del vencimiento de la cuota 1.
        const corte = addDays(DESEMBOLSO, -1);

        expect(
            devengo.ingresoPorInteresCorriente(cuotas, corte, 0).esCero()
        ).toBe(true);
    });
});
