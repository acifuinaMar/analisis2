import { Dinero } from "../dominio/dinero";

/**
 * Calculo del interes moratorio (seccion 6.5).
 *
 * Se aplica EXCLUSIVAMENTE sobre el capital en mora, nunca sobre el total
 * de la cuota: el Codigo Civil de Guatemala prohibe el anatocismo, es decir,
 * que los intereses vencidos generen nuevos intereses.
 */
export class CalculadoraMora {

    private static readonly TASA_MORATORIA_ANUAL = 0.24;
    private static readonly BASE_DIAS = 360;

    public calcular(
        capitalEnMora: Dinero,
        diasAtraso: number
    ): Dinero {

        if (diasAtraso <= 0) {
            return Dinero.cero(capitalEnMora.obtenerMoneda());
        }

        const tasaDiaria =
            CalculadoraMora.TASA_MORATORIA_ANUAL /
            CalculadoraMora.BASE_DIAS;

        return capitalEnMora.multiplicar(tasaDiaria * diasAtraso);
    }
}
