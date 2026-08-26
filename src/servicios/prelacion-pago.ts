import { Dinero } from "../dominio/dinero";

/**
 * Orden de aplicacion de un pago (seccion 6.6.2):
 *
 *   1. Gastos y comisiones
 *   2. Interes moratorio
 *   3. Interes corriente
 *   4. Capital
 *
 * Cada rubro consume lo que le corresponde y pasa el remanente al siguiente.
 * Lo que sobra al final es el excedente del cliente, que nunca se pierde.
 */
export class PrelacionPago {

    public aplicar(
        pago: Dinero,
        gastos: Dinero,
        interesMoratorio: Dinero,
        interesCorriente: Dinero,
        capital: Dinero
    ) {

        let restante = pago;

        const aplicadoGastos = Dinero.minimo(restante, gastos);
        restante = restante.restar(aplicadoGastos);

        const aplicadoMoratorio = Dinero.minimo(restante, interesMoratorio);
        restante = restante.restar(aplicadoMoratorio);

        const aplicadoInteres = Dinero.minimo(restante, interesCorriente);
        restante = restante.restar(aplicadoInteres);

        const aplicadoCapital = Dinero.minimo(restante, capital);
        restante = restante.restar(aplicadoCapital);

        return {

            gastos: aplicadoGastos,

            interesMoratorio: aplicadoMoratorio,

            interesCorriente: aplicadoInteres,

            capital: aplicadoCapital,

            excedente: restante

        };
    }
}
