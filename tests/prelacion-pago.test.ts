import { describe, expect, it } from "vitest";

import { PrelacionPago } from "../src/servicios/prelacion-pago";
import { Dinero } from "../src/dominio/dinero";
import { RubrosAdeudados } from "../src/dominio/rubros-adeudados";
import {
    EslabonCapital,
    EslabonGastos,
    EslabonInteresCorriente,
    EslabonInteresMoratorio
} from "../src/servicios/prelacion/eslabones";

/**
 * Rubros de la cuota 2 del caso de referencia, vencida hace 15 dias
 * (seccion 6.6.1). Total adeudado: Q1,011.88.
 */
function deudaDeReferencia(): RubrosAdeudados {
    return new RubrosAdeudados(
        Dinero.desde(0),
        Dinero.desde(7.26),
        Dinero.desde(278.86),
        Dinero.desde(725.76)
    );
}

const prelacion = new PrelacionPago();

describe("Prelacion de pagos - los tres escenarios (6.6)", () => {

    it("Escenario A - Pago exacto", () => {

        const resultado = prelacion.aplicar(
            Dinero.desde(1011.88),
            deudaDeReferencia()
        );

        expect(resultado.gastos.obtenerValor()).toBe(0);
        expect(resultado.interesMoratorio.obtenerValor()).toBe(7.26);
        expect(resultado.interesCorriente.obtenerValor()).toBe(278.86);
        expect(resultado.capital.obtenerValor()).toBe(725.76);
        expect(resultado.excedente.obtenerValor()).toBe(0);
    });

    it("Escenario B - Pago parcial", () => {

        const resultado = prelacion.aplicar(
            Dinero.desde(500),
            deudaDeReferencia()
        );

        expect(resultado.gastos.obtenerValor()).toBe(0);
        expect(resultado.interesMoratorio.obtenerValor()).toBe(7.26);
        expect(resultado.interesCorriente.obtenerValor()).toBe(278.86);
        expect(resultado.capital.obtenerValor()).toBe(213.88);
        expect(resultado.excedente.obtenerValor()).toBe(0);
    });

    it("Escenario C - Pago con excedente", () => {

        const resultado = prelacion.aplicar(
            Dinero.desde(3000),
            deudaDeReferencia()
        );

        expect(resultado.gastos.obtenerValor()).toBe(0);
        expect(resultado.interesMoratorio.obtenerValor()).toBe(7.26);
        expect(resultado.interesCorriente.obtenerValor()).toBe(278.86);
        expect(resultado.capital.obtenerValor()).toBe(725.76);
        expect(resultado.excedente.obtenerValor()).toBe(1988.12);
    });

    it("El total adeudado de la cuota vencida es Q1,011.88", () => {
        expect(deudaDeReferencia().total().obtenerValor()).toBe(1011.88);
    });
});

describe("Prelacion de pagos - la cadena recorre en orden (6.6.2)", () => {

    it("Un pago que solo alcanza para gastos no toca los demas rubros", () => {

        const deuda = new RubrosAdeudados(
            Dinero.desde(50),
            Dinero.desde(7.26),
            Dinero.desde(278.86),
            Dinero.desde(725.76)
        );

        const resultado = prelacion.aplicar(Dinero.desde(30), deuda);

        expect(resultado.gastos.obtenerValor()).toBe(30);
        expect(resultado.interesMoratorio.esCero()).toBe(true);
        expect(resultado.interesCorriente.esCero()).toBe(true);
        expect(resultado.capital.esCero()).toBe(true);
    });

    it("Los gastos se cobran ANTES que el moratorio", () => {

        const deuda = new RubrosAdeudados(
            Dinero.desde(50),
            Dinero.desde(7.26),
            Dinero.desde(278.86),
            Dinero.desde(725.76)
        );

        const resultado = prelacion.aplicar(Dinero.desde(55), deuda);

        expect(resultado.gastos.obtenerValor()).toBe(50);
        expect(resultado.interesMoratorio.obtenerValor()).toBe(5);
    });

    it("Un pago de cero no aplica nada y no falla", () => {

        const resultado = prelacion.aplicar(
            Dinero.cero(),
            deudaDeReferencia()
        );

        expect(resultado.totalAplicado().esCero()).toBe(true);
        expect(resultado.excedente.esCero()).toBe(true);
    });

    it("Sin deuda, todo el pago queda como excedente", () => {

        const resultado = prelacion.aplicar(
            Dinero.desde(500),
            RubrosAdeudados.ninguno()
        );

        expect(resultado.totalAplicado().esCero()).toBe(true);
        expect(resultado.excedente.obtenerValor()).toBe(500);
    });
});

/**
 * El enunciado advierte que "el orden de aplicacion es una regla de
 * negocio, no un detalle de implementacion: cambiarlo altera cuanto debe
 * el cliente y cuanto reconoce la institucion como ingreso".
 *
 * Con Chain of Responsibility, cambiar esa regla es rearmar la cadena.
 * No se toca ni una linea de PrelacionPago (Open/Closed).
 */
describe("Prelacion de pagos - el orden es configurable, no esta quemado", () => {

    it("Anteponer capital cambia el resultado sin tocar PrelacionPago", () => {

        // Cadena alternativa: capital primero, contra lo que manda 6.6.2.
        const capitalPrimero = new EslabonCapital();
        capitalPrimero
            .encadenarCon(new EslabonGastos())
            .encadenarCon(new EslabonInteresMoratorio())
            .encadenarCon(new EslabonInteresCorriente());

        const alternativa = new PrelacionPago(capitalPrimero);

        const resultado = alternativa.aplicar(
            Dinero.desde(500),
            deudaDeReferencia()
        );

        // Con esta cadena el pago se come el capital y no cubre intereses.
        expect(resultado.capital.obtenerValor()).toBe(500);
        expect(resultado.interesMoratorio.esCero()).toBe(true);

        // La reglamentaria da un resultado distinto con el mismo pago.
        const reglamentaria = prelacion.aplicar(
            Dinero.desde(500),
            deudaDeReferencia()
        );
        expect(reglamentaria.capital.obtenerValor()).toBe(213.88);
    });

    it("Una cadena de un solo eslabon tambien funciona", () => {

        const soloCapital = new PrelacionPago(new EslabonCapital());

        const resultado = soloCapital.aplicar(
            Dinero.desde(1000),
            deudaDeReferencia()
        );

        expect(resultado.capital.obtenerValor()).toBe(725.76);
        expect(resultado.excedente.obtenerValor()).toBe(274.24);
    });
});

describe("Prelacion de pagos - invariantes (6.10)", () => {

    it.each([0, 100, 500, 1011.88, 3000])(
        "Con un pago de Q%d, lo aplicado mas el excedente da el pago exacto",
        (monto) => {

            const resultado = prelacion.aplicar(
                Dinero.desde(monto),
                deudaDeReferencia()
            );

            expect(resultado.totalRecibido().obtenerValor()).toBe(monto);
        }
    );

    it("Nunca se aplica mas de lo adeudado en ningun rubro", () => {

        const deuda = deudaDeReferencia();
        const resultado = prelacion.aplicar(Dinero.desde(99999), deuda);

        expect(resultado.totalAplicado().esIgualA(deuda.total())).toBe(true);
    });

    it("El excedente nunca se pierde: pertenece al cliente (6.6.5)", () => {

        const resultado = prelacion.aplicar(
            Dinero.desde(3000),
            deudaDeReferencia()
        );

        expect(resultado.hayExcedente()).toBe(true);
        expect(resultado.excedente.obtenerValor()).toBe(1988.12);
    });
});
