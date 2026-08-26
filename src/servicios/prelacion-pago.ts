import { Dinero } from "../dominio/dinero";

export class PrelacionPago {

    public aplicar(
        pago: Dinero,
        gastos: Dinero,
        interesMoratorio: Dinero,
        interesCorriente: Dinero,
        capital: Dinero
    ) {

        let restante = pago.obtenerValor();

        const aplicadoGastos =
            Math.min(restante, gastos.obtenerValor());

        restante -= aplicadoGastos;

        const aplicadoMoratorio =
            Math.min(restante, interesMoratorio.obtenerValor());

        restante -= aplicadoMoratorio;

        const aplicadoInteres =
            Math.min(restante, interesCorriente.obtenerValor());

        restante -= aplicadoInteres;

        const aplicadoCapital =
            Math.min(restante, capital.obtenerValor());

        restante -= aplicadoCapital;

        return {

            gastos: Dinero.desde(aplicadoGastos),

            interesMoratorio:
                Dinero.desde(aplicadoMoratorio),

            interesCorriente:
                Dinero.desde(aplicadoInteres),

            capital:
                Dinero.desde(aplicadoCapital),

            excedente:
                Dinero.desde(restante)

        };

    }

}