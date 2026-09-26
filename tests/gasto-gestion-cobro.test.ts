import { describe, expect, it } from "vitest";
import { addDays, addMonths } from "date-fns";

import { Credito } from "../src/dominio/credito";
import { Dinero } from "../src/dominio/dinero";
import { Pago } from "../src/dominio/pago";
import { GastoGestionCobro } from "../src/dominio/gasto-gestion-cobro";
import { PlanAmortizacion } from "../src/dominio/plan-amortizacion";
import { PoliticaCredito, BaseConteo } from "../src/dominio/politica-credito";
import { CalculoFrances } from "../src/estrategias/calculo-frances";

const POLITICA = new PoliticaCredito(
    "POL-2026-10", 0.36, 0.24, BaseConteo.ACTUAL_360,
    "Comite de Credito", new Date(2026, 9, 1)
);

/**
 * Credito otorgado el 10 de octubre de 2026: posterior a la vigencia de la
 * politica escalonada, asi que le aplica CP-01 (caso CV-2026-0410 de 7.6).
 */
const DESEMBOLSO = new Date(2026, 9, 10);

function planNuevo(): PlanAmortizacion {

    const credito = new Credito(
        "CV-2026-0410",
        Dinero.desde(10000),
        Dinero.desde(10000),
        POLITICA,
        12,
        DESEMBOLSO
    );

    const plan = new PlanAmortizacion(credito, new CalculoFrances());
    plan.generarPlan();

    // La cuota 1 ya fue saldada: solo la 2 queda vencida.
    const cuota1 = plan.obtenerCuotas()[0];
    cuota1.abonar(cuota1.capitalPendiente(), cuota1.interesPendiente());
    plan.recalcularSaldo();

    return plan;
}

/** Fecha de corte a N dias del vencimiento de la cuota 2. */
function corteCuota2(diasAtraso: number): Date {
    return addDays(addMonths(DESEMBOLSO, 1), diasAtraso);
}

describe("Gasto de gestion de cobro - reglas (CP-02, 7.5)", () => {

    it("Son Q25.00 fijos por cuota vencida", () => {
        expect(GastoGestionCobro.montoPorCuota().obtenerValor()).toBe(25);
    });

    it("No se cobra en Mora 1: no hubo visita", () => {

        const libro = new GastoGestionCobro();

        for (const dias of [1, 15, 30]) {
            expect(libro.evaluarAlCorte("C-1", dias).esCero()).toBe(true);
        }

        expect(libro.pendientePara("C-1").esCero()).toBe(true);
    });

    it("Se genera al dia 31, la entrada a Mora 2", () => {

        const libro = new GastoGestionCobro();

        expect(libro.evaluarAlCorte("C-1", 30).esCero()).toBe(true);
        expect(libro.evaluarAlCorte("C-1", 31).obtenerValor()).toBe(25);
    });

    it("Pasar a Mora 3 o a Vencido NO genera un gasto nuevo", () => {

        const libro = new GastoGestionCobro();

        libro.evaluarAlCorte("C-1", 31);

        // Es el mismo hecho, no uno distinto.
        expect(libro.evaluarAlCorte("C-1", 61).esCero()).toBe(true);
        expect(libro.evaluarAlCorte("C-1", 91).esCero()).toBe(true);
        expect(libro.evaluarAlCorte("C-1", 120).esCero()).toBe(true);

        expect(libro.generadoPara("C-1").obtenerValor()).toBe(25);
    });

    it("Cada cuota vencida genera el suyo, por separado", () => {

        const libro = new GastoGestionCobro();

        libro.evaluarAlCorte("CR-1-cuota-2", 45);
        libro.evaluarAlCorte("CR-1-cuota-3", 35);

        expect(libro.cuotasConGasto()).toBe(2);
        expect(libro.totalGenerado().obtenerValor()).toBe(50);
    });
});

describe("Gasto de gestion de cobro - IDEMPOTENCIA (7.5 y P1 6.10)", () => {

    it("Reejecutar el cierre del mismo dia no vuelve a cobrar la visita", () => {

        const libro = new GastoGestionCobro();

        const primera = libro.evaluarAlCorte("C-1", 31);
        const segunda = libro.evaluarAlCorte("C-1", 31);

        expect(primera.obtenerValor()).toBe(25);
        expect(segunda.esCero()).toBe(true);
        expect(libro.generadoPara("C-1").obtenerValor()).toBe(25);
    });

    it("Cien cierres seguidos generan un solo gasto", () => {

        const libro = new GastoGestionCobro();

        for (let dia = 31; dia <= 130; dia++) {
            libro.evaluarAlCorte("C-1", dia);
        }

        expect(libro.generadoPara("C-1").obtenerValor()).toBe(25);
        expect(libro.cuotasConGasto()).toBe(1);
    });

    it("El total adeudado no crece al reejecutar el cierre", () => {

        const plan = planNuevo();
        const corte = corteCuota2(31);

        const primera = plan.calcularTotalAdeudado(corte).total();
        const segunda = plan.calcularTotalAdeudado(corte).total();

        // Si no fuera idempotente, el total pasaria de Q1,047.76 a
        // Q1,072.76 y el cliente quedaria cobrado dos veces por una visita.
        expect(segunda.esIgualA(primera)).toBe(true);
    });
});

describe("Caso M-5 · total adeudado de la cuota 2 (7.5)", () => {

    it("Con 45 dias de atraso el total es Q1,047.76", () => {

        const deuda = planNuevo().deudaDeCuota(2, corteCuota2(45));

        expect(deuda.gastos.obtenerValor()).toBe(25.00);
        expect(deuda.interesMoratorio.obtenerValor()).toBe(18.14);
        expect(deuda.interesCorriente.obtenerValor()).toBe(278.86);
        expect(deuda.capital.obtenerValor()).toBe(725.76);

        expect(deuda.total().obtenerValor()).toBe(1047.76);
    });

    it("Con 15 dias, sin gasto y en Mora 1, el total es Q1,010.06", () => {

        const deuda = planNuevo().deudaDeCuota(2, corteCuota2(15));

        expect(deuda.gastos.esCero()).toBe(true);
        expect(deuda.interesMoratorio.obtenerValor()).toBe(5.44);
        expect(deuda.interesCorriente.obtenerValor()).toBe(278.86);
        expect(deuda.capital.obtenerValor()).toBe(725.76);

        expect(deuda.total().obtenerValor()).toBe(1010.06);
    });

    it("La diferencia entre ambos cortes es el gasto mas la mora extra", () => {

        const a15 = planNuevo().deudaDeCuota(2, corteCuota2(15)).total();
        const a45 = planNuevo().deudaDeCuota(2, corteCuota2(45)).total();

        // Q25.00 de visita + Q12.70 de mora adicional.
        expect(a45.restar(a15).obtenerValor()).toBe(37.70);
    });
});

describe("Caso M-5 - el gasto es el PRIMER eslabon de la prelacion", () => {

    it("Un pago exacto de Q1,047.76 salda los cuatro rubros", () => {

        // A 45 dias del vencimiento de la cuota 2, la cuota 3 ya lleva 15
        // dias vencida. Para aislar el caso M-5 se salda tambien la 3.
        const plan = planNuevo();
        const corte = corteCuota2(45);
        const cuota3 = plan.obtenerCuotas()[2];
        cuota3.abonar(cuota3.capitalPendiente(), cuota3.interesPendiente());
        plan.recalcularSaldo();

        const aplicacion = plan.aplicarPago(
            new Pago(Dinero.desde(1047.76), corte, "efectivo"),
            corte
        );

        expect(aplicacion.gastos.obtenerValor()).toBe(25.00);
        expect(aplicacion.interesMoratorio.obtenerValor()).toBe(18.14);
        expect(aplicacion.interesCorriente.obtenerValor()).toBe(278.86);
        expect(aplicacion.capital.obtenerValor()).toBe(725.76);
        expect(aplicacion.excedente.esCero()).toBe(true);
    });

    it("Un pago de Q25.00 se va integro al gasto, antes que a la mora", () => {

        const plan = planNuevo();
        const corte = corteCuota2(45);

        const aplicacion = plan.aplicarPago(
            new Pago(Dinero.desde(25), corte, "efectivo"),
            corte
        );

        // Los gastos se consumen primero, completos, antes que la mora.
        expect(aplicacion.gastos.obtenerValor()).toBe(25.00);
        expect(aplicacion.interesMoratorio.esCero()).toBe(true);
        expect(aplicacion.capital.esCero()).toBe(true);
    });

    it("Pagado el gasto, deja de aparecer en la deuda", () => {

        const plan = planNuevo();
        const corte = corteCuota2(45);

        plan.aplicarPago(new Pago(Dinero.desde(25), corte, "efectivo"), corte);

        const deuda = plan.deudaDeCuota(2, corte);

        expect(deuda.gastos.esCero()).toBe(true);
        expect(deuda.total().obtenerValor()).toBe(1047.76 - 25);
    });

    it("El libro de gastos deja el rastro de lo generado y lo abonado", () => {

        const plan = planNuevo();
        const corte = corteCuota2(45);

        plan.aplicarPago(new Pago(Dinero.desde(25), corte, "efectivo"), corte);

        const libro = plan.librodeGastos();
        const clave = "CV-2026-0410-2";

        expect(libro.generadoPara(clave).obtenerValor()).toBe(25);
        expect(libro.abonadoPara(clave).obtenerValor()).toBe(25);
        expect(libro.pendientePara(clave).esCero()).toBe(true);
    });
});

describe("Coexistencia: el credito viejo no cambia (CP-03)", () => {

    it("Un credito anterior al 1/10/2026 sigue con la mora plana", () => {

        const credito = new Credito(
            "CV-2026-0100",
            Dinero.desde(10000),
            Dinero.desde(10000),
            POLITICA,
            12,
            new Date(2026, 7, 15)
        );

        const plan = new PlanAmortizacion(credito, new CalculoFrances());
        plan.generarPlan();

        const cuota1 = plan.obtenerCuotas()[0];
        cuota1.abonar(cuota1.capitalPendiente(), cuota1.interesPendiente());
        plan.recalcularSaldo();

        const corte = addDays(addMonths(new Date(2026, 7, 15), 1), 45);
        const deuda = plan.deudaDeCuota(2, corte);

        // Plana 24 %: Q21.77, contra los Q18.14 de la escalonada.
        expect(deuda.interesMoratorio.obtenerValor()).toBe(21.77);

        // El gasto de gestion si aplica a ambos: es politica de cobranza,
        // no de tasa.
        expect(deuda.gastos.obtenerValor()).toBe(25.00);
    });
});
