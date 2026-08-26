import { Dinero } from "../dominio/dinero";
import { PoliticaCredito } from "../dominio/politica-credito";

/**
 * Calculo del interes moratorio (seccion 6.5).
 *
 * Se aplica EXCLUSIVAMENTE sobre el capital en mora, nunca sobre el total
 * de la cuota: el Codigo Civil de Guatemala prohibe el anatocismo, es decir,
 * que los intereses vencidos generen nuevos intereses.
 *
 * La tasa y la base de conteo llegan desde la politica de credito, no como
 * constantes de este archivo (seccion 6.3.1).
 */
export class CalculadoraMora {

    constructor(private readonly politica: PoliticaCredito) {}

    public calcular(
        capitalEnMora: Dinero,
        diasAtraso: number
    ): Dinero {

        if (!Number.isInteger(diasAtraso)) {
            throw new Error("Los dias de atraso deben ser un numero entero.");
        }

        if (diasAtraso <= 0) {
            return Dinero.cero(capitalEnMora.obtenerMoneda());
        }

        return capitalEnMora.multiplicar(
            this.politica.tasaMoratoriaDiaria() * diasAtraso
        );
    }
}
