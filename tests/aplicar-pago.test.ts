import { describe, expect, it } from "vitest";
import { addDays, addMonths } from "date-fns";

import { Credito } from "../src/dominio/credito";
import { Cuota } from "../src/dominio/cuota";
import { Dinero } from "../src/dominio/dinero";
import { Pago } from "../src/dominio/pago";
import { EstadoCuota } from "../src/dominio/estado-cuota";
import { NombreEstado } from "../src/dominio/nombre-estado";
import { PlanAmortizacion } from "../src/dominio/plan-amortizacion";
import { PoliticaCredito, BaseConteo } from "../src/dominio/politica-credito";
import { TransicionInvalida } from "../src/dominio/estados/estado-credito";
import { Solicitado } from "../src/dominio/estados/estados-credito";
import { CalculoFrances } from "../src/estrategias/calculo-frances";
import {
    PagoAnticipadoDeCuotas
} from "../src/estrategias/politica-adelanto";
import { CalculadoraMora } from "../src/servicios/calculadora-mora";
import { PrelacionPago } from "../src/servicios/prelacion-pago";
import { RelojFijo } from "../src/adaptadores/reloj-fijo";

const POLITICA = new PoliticaCredito(
    "POL-2026-01", 0.36, 0.24, BaseConteo.ACTUAL_360,
    "Comite de Credito", new Date(2026, 0, 1)
);

const DESEMBOLSO = new RelojFijo(new Date(2026, 0, 15)).hoy();

function credito(estadoInicial?: Solicitado): Credito {
    return new Credito(
        "CR-001",
        Dinero.desde(10000),
        Dinero.desde(10000),
        POLITICA,
        12,
        DESEMBOLSO,
        estadoInicial
    );
}

function planDe(c: Credito): PlanAmortizacion {
    const plan = new PlanAmortizacion(c, new CalculoFrances());
    plan.generarPlan();
    return plan;
}

/** Vencimiento de la cuota n mas los dias de atraso indicados. */
function corteConAtraso(numeroCuota: number, diasAtraso: number): Date {
    return addDays(addMonths(DESEMBOLSO, numeroCuota - 1), diasAtraso);
}

/**
 * Salda una cuota por completo y deja el saldo del credito al dia.
 * Se usa para colocar el escenario antes de probar el pago siguiente.
 */
function saldarCuota(plan: PlanAmortizacion, numero: number): void {

    const cuota = plan.obtenerCuotas()[numero - 1];

    cuota.abonar(cuota.capitalPendiente(), cuota.interesPendiente());

    plan.recalcularSaldo();
}

function pagoDe(monto: number, fecha: Date): Pago {
    return new Pago(Dinero.desde(monto), fecha, "efectivo");
}

describe("aplicarPago - Escenario A: pago exacto (6.6.3)", () => {

    it("Q1,011.88 salda la cuota 2 vencida hace 15 dias", () => {

        const c = credito();
        const plan = planDe(c);
        const corte = corteConAtraso(2, 15);

        // La cuota 1 ya fue saldada previamente.
        saldarCuota(plan, 1);

        const aplicacion = plan.aplicarPago(pagoDe(1011.88, corte), corte);

        expect(aplicacion.interesMoratorio.obtenerValor()).toBe(7.26);
        expect(aplicacion.interesCorriente.obtenerValor()).toBe(278.86);
        expect(aplicacion.capital.obtenerValor()).toBe(725.76);
        expect(aplicacion.excedente.esCero()).toBe(true);
    });

    it("La cuota queda PAGADA y el credito regresa a VIGENTE", () => {

        const c = credito();
        const plan = planDe(c);
        const corte = corteConAtraso(2, 15);

        saldarCuota(plan, 1);

        plan.aplicarPago(pagoDe(1011.88, corte), corte);

        expect(plan.obtenerCuotas()[1].obtenerEstado()).toBe(EstadoCuota.PAGADA);
        expect(c.nombreEstado()).toBe(NombreEstado.VIGENTE);
    });
});

describe("aplicarPago - Escenario B: pago parcial (6.6.4)", () => {

    it("Q500 se aplica en orden hasta donde alcanza", () => {

        const c = credito();
        const plan = planDe(c);
        const corte = corteConAtraso(2, 15);

        saldarCuota(plan, 1);

        const aplicacion = plan.aplicarPago(pagoDe(500, corte), corte);

        expect(aplicacion.interesMoratorio.obtenerValor()).toBe(7.26);
        expect(aplicacion.interesCorriente.obtenerValor()).toBe(278.86);
        expect(aplicacion.capital.obtenerValor()).toBe(213.88);
        expect(aplicacion.excedente.esCero()).toBe(true);
    });

    it("La cuota queda PARCIAL: aun debe Q511.88 de capital", () => {

        const c = credito();
        const plan = planDe(c);
        const corte = corteConAtraso(2, 15);

        saldarCuota(plan, 1);

        plan.aplicarPago(pagoDe(500, corte), corte);

        const cuota2 = plan.obtenerCuotas()[1];

        expect(cuota2.obtenerEstado()).toBe(EstadoCuota.PARCIAL);
        expect(cuota2.capitalPendiente().obtenerValor()).toBe(511.88);
    });

    it("Un abono parcial NO regulariza: el credito sigue EN_MORA", () => {

        const c = credito();
        const plan = planDe(c);
        const corte = corteConAtraso(2, 15);

        saldarCuota(plan, 1);

        plan.aplicarPago(pagoDe(500, corte), corte);

        expect(c.nombreEstado()).toBe(NombreEstado.EN_MORA);
    });

    it("Nunca se rechaza un pago por insuficiente", () => {

        const c = credito();
        const plan = planDe(c);
        const corte = corteConAtraso(1, 5);

        expect(() => plan.aplicarPago(pagoDe(1, corte), corte)).not.toThrow();
    });
});

describe("aplicarPago - Escenario C: pago con excedente (6.6.5)", () => {

    it("Q3,000 salda la cuota vencida y deja Q1,988.12 de excedente", () => {

        const c = credito();
        const plan = planDe(c);
        const corte = corteConAtraso(2, 15);

        saldarCuota(plan, 1);

        const aplicacion = plan.aplicarPago(pagoDe(3000, corte), corte);

        expect(aplicacion.capital.obtenerValor()).toBe(725.76);
        expect(aplicacion.excedente.obtenerValor()).toBe(1988.12);
    });

    it("El excedente abona a capital de cuotas futuras, no se pierde", () => {

        const c = credito();
        const plan = planDe(c);
        const corte = corteConAtraso(2, 15);

        saldarCuota(plan, 1);

        const saldoAntes = c.saldoCapital;
        plan.aplicarPago(pagoDe(3000, corte), corte);

        // El saldo baja por el capital de la cuota 2 MAS el excedente.
        const reduccion = saldoAntes.restar(c.saldoCapital);
        expect(reduccion.obtenerValor()).toBe(725.76 + 1988.12);
    });

    it("Con la politica alternativa el excedente cubre cuotas completas", () => {

        const c = credito();
        const plan = new PlanAmortizacion(
            c,
            new CalculoFrances(),
            new CalculadoraMora(POLITICA),
            new PrelacionPago(),
            new PagoAnticipadoDeCuotas()
        );
        plan.generarPlan();

        const corte = corteConAtraso(2, 15);
        saldarCuota(plan, 1);

        plan.aplicarPago(pagoDe(3000, corte), corte);

        // Q1,988.12 alcanza para la cuota 3 completa (Q1,004.62), no para dos.
        expect(plan.obtenerCuotas()[2].obtenerEstado()).toBe(EstadoCuota.PAGADA);
        expect(plan.obtenerCuotas()[3].obtenerEstado()).toBe(EstadoCuota.PENDIENTE);
    });
});

describe("aplicarPago - mora cuota por cuota (6.5)", () => {

    it("Con dos cuotas vencidas hay dos calculos de moratorio", () => {

        const c = credito();
        const plan = planDe(c);

        // Corte 15 dias despues del vencimiento de la cuota 2:
        // la cuota 1 lleva mas atraso que la 2.
        const corte = corteConAtraso(2, 15);

        const exigibles = plan.cuotasExigibles(corte);
        expect(exigibles).toHaveLength(2);

        const mora = new CalculadoraMora(POLITICA);
        const esperado = exigibles.reduce(
            (total, cuota) => total.sumar(
                mora.calcular(cuota.capitalPendiente(), cuota.diasAtraso(corte))
            ),
            Dinero.cero()
        );

        const aplicacion = plan.aplicarPago(pagoDe(5000, corte), corte);

        expect(aplicacion.interesMoratorio.esIgualA(esperado)).toBe(true);
    });

    it("Las cuotas exigibles van de la mas antigua a la mas nueva", () => {

        const plan = planDe(credito());
        const exigibles = plan.cuotasExigibles(corteConAtraso(3, 10));

        expect(exigibles.map(c => c.numero)).toEqual([1, 2, 3]);
    });

    it("Una cuota que aun no vence no es exigible", () => {

        const plan = planDe(credito());
        const exigibles = plan.cuotasExigibles(corteConAtraso(1, 0));

        expect(exigibles).toHaveLength(0);
    });
});

describe("recalcularSaldo - el saldo se deriva, no se sobrescribe (6.9)", () => {

    it("Al generar el plan el saldo es el monto completo", () => {

        const c = credito();
        planDe(c);

        expect(c.saldoCapital.obtenerValor()).toBe(10000);
    });

    it("El saldo baja exactamente lo amortizado", () => {

        const c = credito();
        const plan = planDe(c);
        const corte = corteConAtraso(1, 5);

        plan.aplicarPago(pagoDe(1004.62, corte), corte);

        // Capital de la cuota 1 = Q704.62, menos la mora que se cobro aparte.
        const amortizado = plan.obtenerCuotas()[0].capitalPagado();
        expect(c.saldoCapital.obtenerValor())
            .toBe(10000 - amortizado.obtenerValor());
    });

    it("Pagar todas las cuotas deja el saldo en 0.00 exacto", () => {

        const c = credito();
        const plan = planDe(c);
        const corte = addDays(addMonths(DESEMBOLSO, 11), 1);

        plan.aplicarPago(pagoDe(20000, corte), corte);

        expect(c.saldoCapital.obtenerValor()).toBe(0);
        expect(c.saldoCapital.esCero()).toBe(true);
    });

    it("El saldo nunca queda negativo (invariante 6.10)", () => {

        const c = credito();
        const plan = planDe(c);
        const corte = addDays(addMonths(DESEMBOLSO, 11), 1);

        plan.aplicarPago(pagoDe(99999, corte), corte);

        expect(c.saldoCapital.obtenerValor()).toBeGreaterThanOrEqual(0);
    });
});

describe("actualizarEstado - delega en el patron State (6.7)", () => {

    it("Vence una cuota impagada y el credito pasa a EN_MORA", () => {

        const c = credito();
        const plan = planDe(c);

        plan.actualizarEstado(corteConAtraso(1, 1));

        expect(c.nombreEstado()).toBe(NombreEstado.EN_MORA);
    });

    it("Saldar todo el credito lo deja CANCELADO", () => {

        const c = credito();
        const plan = planDe(c);
        const corte = addDays(addMonths(DESEMBOLSO, 11), 1);

        plan.aplicarPago(pagoDe(20000, corte), corte);

        expect(c.nombreEstado()).toBe(NombreEstado.CANCELADO);
    });

    it("Pagar todo lo vencido regulariza a VIGENTE", () => {

        const c = credito();
        const plan = planDe(c);
        const corte = corteConAtraso(1, 20);

        plan.actualizarEstado(corte);
        expect(c.nombreEstado()).toBe(NombreEstado.EN_MORA);

        plan.aplicarPago(pagoDe(1100, corte), corte);

        expect(c.nombreEstado()).toBe(NombreEstado.VIGENTE);
    });

    it("Un credito solicitado NO puede recibir un pago (invariante 6.10)", () => {

        const c = credito(new Solicitado());
        const plan = planDe(c);
        const corte = corteConAtraso(1, 5);

        expect(() => plan.aplicarPago(pagoDe(1000, corte), corte))
            .toThrow(TransicionInvalida);
    });

    it("Un pago rechazado no deja cuotas modificadas a medias", () => {

        const c = credito(new Solicitado());
        const plan = planDe(c);
        const corte = corteConAtraso(1, 5);

        try {
            plan.aplicarPago(pagoDe(1000, corte), corte);
        } catch {
            // esperado
        }

        for (const cuota of plan.obtenerCuotas()) {
            expect(cuota.obtenerEstado()).toBe(EstadoCuota.PENDIENTE);
        }
    });
});

describe("Cuota - abonos y atraso", () => {

    it("El estado se deriva de los abonos, no se guarda aparte", () => {

        const cuota = new Cuota(
            1,
            Dinero.desde(1004.62),
            Dinero.desde(704.62),
            Dinero.desde(300),
            DESEMBOLSO
        );

        expect(cuota.obtenerEstado()).toBe(EstadoCuota.PENDIENTE);

        cuota.abonar(Dinero.desde(100), Dinero.cero());
        expect(cuota.obtenerEstado()).toBe(EstadoCuota.PARCIAL);

        cuota.abonar(cuota.capitalPendiente(), cuota.interesPendiente());
        expect(cuota.obtenerEstado()).toBe(EstadoCuota.PAGADA);
    });

    it("No admite un abono mayor a lo pendiente", () => {

        const cuota = new Cuota(
            1,
            Dinero.desde(1004.62),
            Dinero.desde(704.62),
            Dinero.desde(300),
            DESEMBOLSO
        );

        expect(() => cuota.abonar(Dinero.desde(999), Dinero.cero()))
            .toThrow(/mayor a su saldo pendiente/);
    });

    it("Una cuota saldada no acumula dias de atraso", () => {

        const cuota = new Cuota(
            1,
            Dinero.desde(1004.62),
            Dinero.desde(704.62),
            Dinero.desde(300),
            DESEMBOLSO
        );

        cuota.abonar(Dinero.desde(704.62), Dinero.desde(300));

        expect(cuota.diasAtraso(addDays(DESEMBOLSO, 100))).toBe(0);
        expect(cuota.estaVencida(addDays(DESEMBOLSO, 100))).toBe(false);
    });

    it("Los dias de atraso se cuentan en dias calendario (6.5)", () => {

        const cuota = new Cuota(
            1,
            Dinero.desde(1004.62),
            Dinero.desde(704.62),
            Dinero.desde(300),
            DESEMBOLSO
        );

        expect(cuota.diasAtraso(addDays(DESEMBOLSO, 15))).toBe(15);
        expect(cuota.diasAtraso(addDays(DESEMBOLSO, -5))).toBe(0);
    });
});
